import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  createInitializeImmutableOwnerInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { ethers } from 'ethers';
import { getSAId, parseBase58SecretKeyToUint8Array, parseSolanaKeypair } from '../utils';
import { BaseSmartAccountExecutor } from '../base_smart_account_executor';
import { 
  createTokenAddressRow, 
} from '../template-renderer';
import { SOLANA_RPC_URL } from '../consts';
import { 
  validateSolanaTransactionInput, 
  validateEnvironmentVariable,
  ValidationError,
  formatNumberWithoutScientificNotation
} from '../helpers/validation';

// ----- helper functions -----
function getAAWalletAddress(): string {
  return validateEnvironmentVariable('SOL_DEXTRADING_ADDRESS', process.env.SOL_DEXTRADING_ADDRESS);
}

function createConnection(): Connection {
  return new Connection(SOLANA_RPC_URL, 'confirmed');
}

function getKeypair(): Keypair {
  try {
    const secretKeyString = parseBase58SecretKeyToUint8Array(
      validateEnvironmentVariable('SOL_EOA_PRIVATE_KEY', process.env.SOL_EOA_PRIVATE_KEY)
    );
    return parseSolanaKeypair(secretKeyString);
  } catch {
    throw new ValidationError('Invalid SOL_EOA_PRIVATE_KEY format', 'SOL_EOA_PRIVATE_KEY');
  }
}

// ----- user input state -----
interface SolanaTransactionState {
  assetType: string;
  mintAddress?: string;
  recipient: string;
  amount: number;
  amountStr: string;
}

// ----- main functions -----
export async function processSolanaTransaction(
  assetType: string,
  mintAddress: string,
  recipient: string,
  amount: string
): Promise<{
  balanceInfo: string;
  estimatedFee: string;
  templateData: any;
}> {
  //1. Validate user inputs
  const validatedInput = validateSolanaTransactionInput({
    assetType,
    mintAddress,
    recipient,
    amount
  });

  //2. Get AA wallet, connection, keypair
  const AAWalletAddress = getAAWalletAddress();
  const connection = createConnection();
  const keypair = getKeypair();

  const saId = await getSAId(AAWalletAddress, keypair);
  const executor = new BaseSmartAccountExecutor(saId);
  const vaultPda = executor.smartAccountHelper.getVaultPda();

  let balanceInfo = '';
  let estimatedFee = '';

  //3. Check if AA has enough balance, update balanceInfo
  if (validatedInput.assetType === 'Native SOL') {
    const balance = await connection.getBalance(vaultPda);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    balanceInfo = `Current Balance: ${balanceSOL} SOL`;
    
    if (balance < validatedInput.amount * LAMPORTS_PER_SOL) {
      throw new ValidationError(`Insufficient balance! Need ${validatedInput.amount} SOL, have ${balanceSOL} SOL`, 'balance');
    }
  } else {
    const tokenMintPubkey = new PublicKey(validatedInput.mintAddress!);

    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      executor.smartAccountHelper.vault,
      true,
      TOKEN_PROGRAM_ID
    );

    try {
      const vaultAccount = await connection.getTokenAccountBalance(vaultTokenAccount);
      const decimals = vaultAccount.value.decimals;
      const tokenBalance = ethers.formatUnits(BigInt(vaultAccount.value.amount), decimals);
      balanceInfo = `Current Token Balance: ${tokenBalance} tokens`;
      
      if (Number(tokenBalance) < validatedInput.amount) {
        throw new ValidationError(`Insufficient token balance! Need ${validatedInput.amount}, have ${tokenBalance}`, 'balance');
      }
    } catch (err) {
      balanceInfo = 'Cannot fetch Token account balance.';
      throw new ValidationError(`Insufficient balance in vault token account. ${balanceInfo}`, 'balance');
    }
  }

  // 4.Estimate transaction fee, update estimatedFee
  try {
    const { blockhash } = await connection.getLatestBlockhash();
    const dummyTx = new Transaction({ feePayer: keypair.publicKey, recentBlockhash: blockhash });
    const feeInfo = await connection.getFeeForMessage(dummyTx.compileMessage());
    if (feeInfo && feeInfo.value) {
      estimatedFee = `~${feeInfo.value / LAMPORTS_PER_SOL} SOL`;
    }
  } catch (err) {
    estimatedFee = 'Could not estimate';
  }

  const templateData = {
    ASSET_TYPE: validatedInput.assetType,
    TOKEN_ADDRESS_ROW: createTokenAddressRow(validatedInput.mintAddress),
    RECIPIENT: validatedInput.recipient,
    AMOUNT: formatNumberWithoutScientificNotation(validatedInput.amount),
    UNIT: validatedInput.assetType === 'Native SOL' ? 'SOL' : 'tokens',
    BALANCE_INFO: balanceInfo,
    ESTIMATED_FEE: estimatedFee,
    EXECUTE_ENDPOINT: '/execute-solana'
  };

  return { balanceInfo, estimatedFee, templateData };
}

export async function executeSolanaTransaction(state: SolanaTransactionState): Promise<string> {
  //1. Get AA wallet, connection, keypair 
  const AAWalletAddress = getAAWalletAddress();
  const connection = createConnection();
  const keypair = getKeypair();

  //2. Get executor object, vault, recipient (items specific for transfer) 
  const saId = await getSAId(AAWalletAddress, keypair);
  const executor = new BaseSmartAccountExecutor(saId);
  const vaultPda = executor.smartAccountHelper.getVaultPda();
  const recipientPubkey = new PublicKey(state.recipient);

  //3. Form instructions to transfer SOL or SPL token
  let instructions: TransactionInstruction[] = [];

  if (state.assetType === 'Native SOL') {
    if (state.amount * LAMPORTS_PER_SOL < 1) 
      throw new ValidationError('Native SOL value is smaller than 1 Lamport (minimal unit)', 'amount');

    const vaultTransferSolIx = SystemProgram.transfer({
      fromPubkey: vaultPda,
      toPubkey: recipientPubkey,
      lamports: BigInt(state.amount * LAMPORTS_PER_SOL),
    });
    instructions = [vaultTransferSolIx];
  } else {
    // SPL Token
    const tokenMintPubkey = new PublicKey(state.mintAddress!);
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      executor.smartAccountHelper.vault,
      true,
      TOKEN_PROGRAM_ID
    );

    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      recipientPubkey,
      true,
      TOKEN_PROGRAM_ID
    );

    // Get token decimals
    const vaultAccount = await connection.getTokenAccountBalance(vaultTokenAccount);
    const decimals = vaultAccount.value.decimals;
    const amountInBaseUnits = ethers.parseUnits(formatNumberWithoutScientificNotation(state.amount), decimals);

    const createRecipientAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      vaultPda,
      recipientTokenAccount,
      recipientPubkey,
      tokenMintPubkey,
      TOKEN_PROGRAM_ID
    );

    const transferIx = createTransferInstruction(
      vaultTokenAccount,
      recipientTokenAccount,
      vaultPda,
      Number(amountInBaseUnits),
      [],
      TOKEN_PROGRAM_ID
    );
   
    if (recipientPubkey.toBase58() !== executor.payerInfo.keyObject.publicKey.toBase58()) {
      //if recipient is not the payer, put instructions in one transaction
      instructions = [createRecipientAtaIx, transferIx];
    } else {
       //elseif recipient is the payer, create recipient token account beforehand in another transaction
      const createRecipientAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        keypair.publicKey,
        recipientTokenAccount,
        recipientPubkey,
        tokenMintPubkey,
        TOKEN_PROGRAM_ID
      );
      const createRecipientAtaTxn = new Transaction().add(createRecipientAtaIx);
      await sendAndConfirmTransaction(
        connection,
        createRecipientAtaTxn,
        [keypair] // signer
      );
      instructions = [transferIx];
    }
  }

  //4. Execute transaction
  try {
    const transactionReceipt = await executor.execute(
      instructions, 
      'off-boarding token transfer', 
      [], 
      [], 
      state.amount * LAMPORTS_PER_SOL, 
      recipientPubkey, 
      state.assetType
    );
    return transactionReceipt.txSignature;
  } catch (err) {
    throw new ValidationError('Transaction failed : ' + err['shortMessage'], 'transaction');
  }
}

