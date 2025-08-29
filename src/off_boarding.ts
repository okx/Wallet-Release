import inquirer from 'inquirer';
import dotenv from 'dotenv';
import { ethers , Contract} from 'ethers';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  clusterApiUrl,
  TransactionInstruction,
} from '@solana/web3.js';
import * as anchor from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, createTransferInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { lamportsToSol, parseSolanaKeypair } from './utils';
import { SPL_tokenChoices } from './consts';
import { BaseSmartAccountExecutor } from './base_smart_account_executor';
import evmABI from './target/types/evmABI.json';
dotenv.config();

type SupportedChain = 'Solana' | 'Base' | 'BSC';

type RpcName2Url = Record<SupportedChain, string>;

const DEFAULT_RPCS: RpcName2Url = {
  Solana: clusterApiUrl('devnet'),
  Base: process.env.BASE_RPC_URL || 'https://mainnet.base.org',
  BSC: process.env.BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
};

const main = async () => {
  console.log('--- Welcome to the EscapeTool ---');
  console.log('A standalone CLI to manage assets post-escape (Solana, Base, BSC).\n');

  try {
    const { chain } = await inquirer.prompt([
      {
        type: 'list',
        name: 'chain',
        message: 'Select chain',
        choices: ['Solana', 'Base', 'BSC'],
      },
    ]);
    const rpcUrl = DEFAULT_RPCS[chain as SupportedChain];
    console.log("RPC URL", rpcUrl);
    
    const { privateKey } = await inquirer.prompt([
      {
        type: 'password',
        name: 'privateKey',
        message: 'Enter your private key:',
        mask: '*',
      },
    ]);

    if (chain === 'Solana') {
      const connection = new Connection(rpcUrl, 'confirmed');
      const keypair = await parseSolanaKeypair(privateKey);
      const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), { preflightCommitment: 'confirmed' });
 
      console.log(`\nWallet loaded successfully.`);
      console.log(`Your address: ${keypair.publicKey.toBase58()}\n`);

      // Menu loop
      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: ['Check Balance', 'Send Transaction', 'Exit'],
          },
        ]);

        if (action === 'Exit') break;
        switch (action) {
          case 'Check Balance':
            await checkBalanceSolana(connection, keypair.publicKey);
            break;
          case 'Send Transaction':
            await sendTransactionSolana(process.env.SA_ADDRESS || '', keypair, provider);
            break;
        }
      }
    } else {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const network = await provider.getNetwork();
      const expectedChainId = chain === 'Base' ? 8453n : 56n;
      if (network.chainId !== expectedChainId) {
        console.warn(`\nWarning: Connected chainId ${network.chainId} does not match expected ${expectedChainId} for ${chain}.`);
      }
      let wallet: ethers.Wallet;
      try {
        wallet = new ethers.Wallet(privateKey, provider);
      } catch (error) {
        console.error('\nError: Invalid private key provided. Please check and try again.');
        return;
      }
      console.log(`\nWallet loaded successfully.`);
      console.log(`Your EOA address: ${wallet.address}`);

      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: 'list',
            name: 'action',
            message: 'What would you like to do?',
            choices: ['Check Balance', 'Send Transaction', 'Exit'],
          },
        ]);
        if (action === 'Exit') break;
        switch (action) {
          case 'Check Balance':
            await checkBalanceEvm(wallet, provider, chain as 'Base' | 'BSC');
            break;
          case 'Send Transaction':
            await sendTransactionEvm(wallet, chain as 'Base' | 'BSC');
            break;
        }
      }
    }
  } catch (error: any) {
    console.error('\nAn unexpected error occurred:', error.message);
  }

  console.log('\nThank you for using the EscapeTool. Exiting now.');
};

// --- EVM Operations ---
const checkBalanceEvm = async (
  wallet: ethers.Wallet,
  provider: ethers.Provider,
  chain: 'Base' | 'BSC',
) => {
  const balance = await provider.getBalance(wallet.address);
  const symbol = chain === 'BSC' ? 'BNB' : 'ETH';
  console.log(`\nYour balance is: ${ethers.formatEther(balance)} ${symbol}\n`);
};

const sendTransactionEvm = async (
  wallet: ethers.Wallet,
  chain: 'Base' | 'BSC',
) => {
  console.log('\n--- New Transaction ---');

  // 1. Choose asset type
  const { tokenType } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tokenType',
      message: 'Select asset to send',
      choices: ['Native', 'ERC20'],
    },
  ]);

  // 2. Common prompts
  const { to } = await inquirer.prompt([
    {
      type: 'input',
      name: 'address',
      message: 'Enter the receiver address:',
      validate: (input) => ethers.isAddress(input) || 'Please enter a valid EVM address.',
    },
  ]);

  const { amount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'amount',
      message: 'Enter the amount to send:',
    },
  ]);

  // 3. Build the Call[] array for AA.execute
  let calls: Array<{ to: string; value: bigint; data: string }> = [];

  if (tokenType === 'Native') {
    // Native transfer – value in wei, empty data
    const valueWei = ethers.parseEther(amount);
    calls.push({ to, value: valueWei, data: '0x' });
  } else {
    // ERC20 transfer
    const { tokenAddress } = await inquirer.prompt([
      {
        type: 'input',
        name: 'tokenAddress',
        message: 'Enter the ERC20 token contract address:',
        validate: (input) => ethers.isAddress(input) || 'Please enter a valid EVM address.',
      },
    ]);

    // Encode transfer(address,uint256)
    const erc20Iface = new ethers.Interface([
      'function transfer(address to,uint256 amount) external returns (bool)'
    ]);
    const data = erc20Iface.encodeFunctionData('transfer', [to, ethers.parseUnits(amount, 18)]);
    calls.push({ to: tokenAddress, value: 0n, data });
  }

  // 4. Execute via AA wallet
  const contractWithSigner = new Contract(wallet.address, evmABI, wallet);
  try {
    const tx = await contractWithSigner.execute(calls);
    console.log('Transaction sent. Waiting for confirmation...');
    await tx.wait();
    console.log(`✅ Success! Tx hash: ${tx.hash}`);
  } catch (err: any) {
    console.error('❌ Transaction failed:', err.reason || err.message);
  }
};

// --- Solana Operations ---
const checkBalanceSolana = async (
  connection: Connection,
  publicKey: PublicKey
) => {
  console.log(`\nBalances for ${publicKey.toBase58()}:`);

  // 1. Native SOL
  const lamports = await connection.getBalance(publicKey);
  console.log(`SOL  : ${lamportsToSol(lamports)} SOL`);

  // 2. SPL Tokens
  for (const { name, value } of SPL_tokenChoices) {
    if (name === 'Custom address') continue; // placeholder, skip

    let uiAmount = '0';
    try {
      const ata = getAssociatedTokenAddressSync(
        value as PublicKey,
        publicKey,
        false,
        TOKEN_PROGRAM_ID
      );
      const tokenAccountInfo = await connection.getTokenAccountBalance(ata);
      uiAmount = tokenAccountInfo.value.uiAmountString || '0';
    } catch (_) {
      // account doesn't exist => 0 balance remains
    }
    console.log(`${name.padEnd(5)}: ${uiAmount}`);
  }

  console.log(''); // spacer
};


const sendTransactionSolana = async (saId: string, keypair: Keypair, provider: anchor.AnchorProvider) => {
  console.log('\n--- Transfer Tokens ---');

  // --- SPL token path ---
  const { tokenChoice } = await inquirer.prompt([
    {
      type: 'list',
      name: 'tokenChoice',
      message: 'Select SPL token to send:',
      choices: SPL_tokenChoices,
    },
  ]);

  const { recipientAddress, transferAmount } = await inquirer.prompt([
    {
      type: 'input',
      name: 'recipientAddress',
      message: 'Enter the receiver address (Solana):',
      validate: (input) => {
        try { new PublicKey(input); return true; } catch { return 'Please enter a valid Solana address.'; }
      },
    },
    {
      type: 'input',
      name: 'transferAmount',
      message: 'Enter amount to send:',
      validate: (v) => Number(v) > 0 || 'Amount must be > 0',
    }
  ]);

  const executor = new BaseSmartAccountExecutor(saId);

  const tokenMintPubkey = tokenChoice as PublicKey;
  const vaultPda = executor.smartAccountHelper.vault;

  const vaultTokenAccount = getAssociatedTokenAddressSync(
    tokenMintPubkey,
    vaultPda,
    true,
    TOKEN_PROGRAM_ID
  );
  const recipientPubkey = new PublicKey(recipientAddress);
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    tokenMintPubkey,
    recipientPubkey,
    false,
    TOKEN_PROGRAM_ID
  );

  const instructions: TransactionInstruction[] = [
    createAssociatedTokenAccountIdempotentInstruction(
      keypair.publicKey,
      recipientTokenAccount,
      recipientPubkey,
      tokenMintPubkey,
      TOKEN_PROGRAM_ID
    ),
    createTransferInstruction(
      vaultTokenAccount,
      recipientTokenAccount,
      vaultPda,
      Number(transferAmount),
      [],
      TOKEN_PROGRAM_ID
    ),
  ];

  const txSignature = await executor.execute(instructions, 'SPL token transfer');
  console.log("Transaction sent successfully.", txSignature);
  return;
};

// async function test(){
//   const connection = new Connection(clusterApiUrl('devnet'), 'confirmed');
//   // Smart-Account ID (can also be pre-set via ENV)
//   const saId = process.env.SA_ADDRESS || '';
//   if (!saId) {
//     console.error("SA_ADDRESS is not set in the environment variables.");
//     return;
//   }

//   const keypair = await parseSolanaKeypair(process.env.WALLET_SECRET_KEY || '');
//   const provider = new anchor.AnchorProvider(connection, new anchor.Wallet(keypair), { preflightCommitment: 'confirmed' });
//   sendTransactionSolana(saId, keypair, provider);
//   console.log("Transaction sent successfully.");
// }
// test();

main();
