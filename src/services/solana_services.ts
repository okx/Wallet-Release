import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { ethers } from 'ethers';
import { getSAId, parseBase58SecretKeyToUint8Array, parseSolanaKeypair } from '../utils';
import { BaseSmartAccountExecutor } from '../base_smart_account_executor';
import { 
  createTokenAddressRow, 
  createTransactionHashDisplay, 
} from '../template-renderer';
import { SOLANA_RPC_URL } from '../consts';
import { 
  validateSolanaTransactionInput, 
  validateEnvironmentVariable,
  ValidationError,
  type SolanaTransactionInput
} from '../helpers/validation';

interface SolanaTransactionState {
  assetType: string;
  mintAddress?: string;
  recipient: string;
  amount: number;
  amountStr: string;
}

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
  // Validate inputs using helper functions
  const validatedInput = validateSolanaTransactionInput({
    assetType,
    mintAddress,
    recipient,
    amount
  });

  // Validate environment variables and get wallet/connection
  const AAWalletAddress = validateEnvironmentVariable('SOL_DEXTRADING_ADDRESS', process.env.SOL_DEXTRADING_ADDRESS);
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  let keypair: Keypair;
  try {
    const secretKeyString = parseBase58SecretKeyToUint8Array(validateEnvironmentVariable('SOL_EOA_PRIVATE_KEY', process.env.SOL_EOA_PRIVATE_KEY));
    keypair = parseSolanaKeypair(secretKeyString);
  } catch (error) {
    throw new ValidationError('Invalid SOL_EOA_PRIVATE_KEY format', 'SOL_EOA_PRIVATE_KEY');
  }

  const saId = await getSAId(AAWalletAddress, keypair);
  const executor = new BaseSmartAccountExecutor(saId);
  const vaultPda = executor.smartAccountHelper.getVaultPda();

  let balanceInfo = '';
  let estimatedFee = '';

  // Check balance and estimate fee
  if (validatedInput.assetType === 'Native SOL') {
    const balance = await connection.getBalance(vaultPda);
    const balanceSOL = balance / LAMPORTS_PER_SOL;
    balanceInfo = `Current Balance: ${balanceSOL} SOL`;
    
    if (balance < validatedInput.amount * LAMPORTS_PER_SOL) {
      throw new ValidationError(`Insufficient balance! Need ${validatedInput.amount} SOL, have ${balanceSOL} SOL`, 'balance');
    }
  } else {
    // SPL Token
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
      balanceInfo = 'Token account not found - balance is 0';
      throw new ValidationError('Insufficient balance in vault token account', 'balance');
    }
  }

  // Estimate transaction fee
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
    AMOUNT: validatedInput.amount.toString(),
    UNIT: validatedInput.assetType === 'Native SOL' ? 'SOL' : 'tokens',
    BALANCE_INFO: balanceInfo,
    ESTIMATED_FEE: estimatedFee,
    EXECUTE_ENDPOINT: '/execute-solana'
  };

  return { balanceInfo, estimatedFee, templateData };
}

export async function executeSolanaTransaction(state: SolanaTransactionState): Promise<string> {
  // Validate environment variables
  const AAWalletAddress = validateEnvironmentVariable('SOL_DEXTRADING_ADDRESS', process.env.SOL_DEXTRADING_ADDRESS);
  
  // Execute Solana transaction
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  
  let keypair: Keypair;
  try {
    const secretKeyString = parseBase58SecretKeyToUint8Array(validateEnvironmentVariable('SOL_EOA_PRIVATE_KEY', process.env.SOL_EOA_PRIVATE_KEY));
    keypair = parseSolanaKeypair(secretKeyString);
  } catch (error) {
    throw new ValidationError('Invalid SOL_EOA_PRIVATE_KEY format', 'SOL_EOA_PRIVATE_KEY');
  }
  const saId = await getSAId(AAWalletAddress, keypair);
  const executor = new BaseSmartAccountExecutor(saId);
  const vaultPda = executor.smartAccountHelper.getVaultPda();
  const recipientPubkey = new PublicKey(state.recipient);

  let instructions: TransactionInstruction[] = [];

  if (state.assetType === 'Native SOL') {
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
    const amountInBaseUnits = ethers.parseUnits(state.amount.toString(), decimals);

    const createVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      vaultPda,
      vaultTokenAccount,
      vaultPda,
      tokenMintPubkey,
      TOKEN_PROGRAM_ID
    );

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

    instructions = [createVaultAtaIx];
    
    if (recipientPubkey.toBase58() !== executor.payerInfo.keyObject.publicKey.toBase58()) {
      instructions.push(createRecipientAtaIx);
    }
    
    instructions.push(transferIx);
  }

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
}

