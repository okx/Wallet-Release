import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { ethers, Contract } from 'ethers';
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { parseSolanaKeypair } from './utils';
import { BaseSmartAccountExecutor } from './base_smart_account_executor';
import evmExecuteABI from './evmExecuteABI.json';
import { 
  renderTemplate, 
  createTokenAddressRow, 
  createTransactionHashDisplay, 
  getNativeTokenSymbol 
} from './template-renderer';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

type SupportedChain = 'Solana' | 'Base' | 'BSC' | 'xLayer';

const DEFAULT_RPCS: Record<SupportedChain, string> = {
  Solana: process.env.DEFAULT_SOLANA_RPC_URL || clusterApiUrl('mainnet-beta'),
  Base: process.env.DEFAULT_BASE_RPC_URL || 'https://mainnet.base.org',
  BSC: process.env.DEFAULT_BSC_RPC_URL || 'https://bsc-dataseed.binance.org',
  xLayer: process.env.DEFAULT_XLAYER_RPC_URL || 'https://mainnet.xlayer-rpc.com',
};

// Store transaction states 
const transactionStates: Map<string, any> = new Map();

// Serve favicon
app.get('/favicon.ico', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'favicon.png'));
});

// Serve CSS file
app.get('/styles.css', (req, res) => {
  res.setHeader('Content-Type', 'text/css');
  res.sendFile(path.join(__dirname, 'templates', 'styles.css'));
});

// Routes
app.get('/', (req, res) => {
  const html = renderTemplate('index');
  res.send(html);
});

app.post('/select-chain', (req, res) => {
  const { chain } = req.body;
  const sessionId = Date.now().toString();
  
  transactionStates.set(sessionId, { chain });
  
  if (chain === 'Solana') {
    res.redirect(`/solana-form?session=${sessionId}`);
  } else {
    res.redirect(`/evm-form?session=${sessionId}&chain=${chain}`);
  }
});

app.get('/solana-form', (req, res) => {
  const sessionId = req.query.session as string;
  const state = transactionStates.get(sessionId);
  
  if (!state) {
    return res.redirect('/');
  }

  const html = renderTemplate('solana-form', {
    SESSION_ID: sessionId
  });
  
  res.send(html);
});

app.get('/evm-form', (req, res) => {
  const sessionId = req.query.session as string;
  const chain = req.query.chain as string;
  const state = transactionStates.get(sessionId);
  
  if (!state) {
    return res.redirect('/');
  }

  const html = renderTemplate('evm-form', {
    SESSION_ID: sessionId,
    CHAIN: chain
  });
  
  res.send(html);
});

app.post('/process-solana', async (req, res) => {
  const { session, assetType, mintAddress, recipient, amount } = req.body;
  const state = transactionStates.get(session);
  
  if (!state) {
    return res.redirect('/');
  }

  try {
    // Validate inputs
    if (!PublicKey.isOnCurve(recipient)) {
      throw new Error('Invalid Solana recipient address');
    }
    
    if (assetType === 'SPL Token' && !mintAddress) {
      throw new Error('SPL Token mint address is required');
    }
    
    if (assetType === 'SPL Token') {
      try {
        new PublicKey(mintAddress);
      } catch {
        throw new Error('Invalid SPL token mint address');
      }
    }
    
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Invalid amount');
    }

    // Store transaction details
    state.assetType = assetType;
    state.mintAddress = mintAddress;
    state.recipient = recipient;
    state.amount = Number(amount);
    transactionStates.set(session, state);

    // Get wallet and connection
    let privateKeyBuf = Buffer.from(process.env.WALLET_SECRET_KEY || '', 'utf8');
    const connection = new Connection(DEFAULT_RPCS.Solana, 'confirmed');
    
    let keypair: Keypair;
    try {
      keypair = await parseSolanaKeypair(privateKeyBuf.toString());
    } finally {
      privateKeyBuf.fill(0);
      privateKeyBuf = Buffer.alloc(0);
    }

    const saId = process.env.SA_ID || '';
    if (!saId) {
      throw new Error('SA_ID is not set in the environment variables');
    }

    const executor = new BaseSmartAccountExecutor(saId);
    const vaultPda = executor.smartAccountHelper.getVaultPda();

    let balanceInfo = '';
    let estimatedFee = '';

    // Check balance and estimate fee
    if (assetType === 'Native SOL') {
      const balance = await connection.getBalance(vaultPda);
      const balanceSOL = balance / LAMPORTS_PER_SOL;
      balanceInfo = `Current Balance: ${balanceSOL} SOL`;
      
      if (balance < Number(amount) * LAMPORTS_PER_SOL) {
        throw new Error(`Insufficient balance! Need ${amount} SOL, have ${balanceSOL} SOL`);
      }
    } else {
      // SPL Token
      const tokenMintPubkey = new PublicKey(mintAddress);
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
        
        if (Number(tokenBalance) < Number(amount)) {
          throw new Error(`Insufficient token balance! Need ${amount}, have ${tokenBalance}`);
        }
      } catch (err) {
        balanceInfo = 'Token account not found - balance is 0';
        throw new Error('Insufficient balance in vault token account');
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

    // Show confirmation page
    const html = renderTemplate('confirm-transaction', {
      SESSION_ID: session,
      BLOCKCHAIN: 'Solana',
      ASSET_TYPE: assetType,
      TOKEN_ADDRESS_ROW: createTokenAddressRow(mintAddress),
      RECIPIENT: recipient,
      AMOUNT: amount.toString(),
      UNIT: assetType === 'Native SOL' ? 'SOL' : 'tokens',
      BALANCE_INFO: balanceInfo,
      ESTIMATED_FEE: estimatedFee,
      EXECUTE_ENDPOINT: '/execute-solana'
    });
    
    res.send(html);

  } catch (error: any) {
    const html = renderTemplate('error', {
      TITLE: 'Error',
      ERROR_TITLE: 'Error',
      ERROR_MESSAGE: error.message,
      BACK_ACTION: 'window.history.back()',
      BACK_TEXT: 'Go Back'
    });
    
    res.send(html);
  }
});

app.post('/process-evm', async (req, res) => {
  const { session, assetType, tokenAddress, recipient, amount } = req.body;
  const state = transactionStates.get(session);
  
  if (!state) {
    return res.redirect('/');
  }

  try {
    // Validate inputs
    if (!ethers.isAddress(recipient)) {
      throw new Error('Invalid EVM recipient address');
    }
    
    if (assetType === 'ERC20 Token' && !tokenAddress) {
      throw new Error('ERC20 token contract address is required');
    }
    
    if (assetType === 'ERC20 Token' && !ethers.isAddress(tokenAddress)) {
      throw new Error('Invalid ERC20 token contract address');
    }
    
    if (isNaN(Number(amount)) || Number(amount) <= 0) {
      throw new Error('Invalid amount');
    }

    // Store transaction details
    state.assetType = assetType;
    state.tokenAddress = tokenAddress;
    state.recipient = recipient;
    state.amount = Number(amount);
    transactionStates.set(session, state);

    // Get wallet and provider
    let privateKeyBuf = Buffer.from(process.env.EVM_EOA_PRIVATE_KEY || '', 'utf8');
    const rpcUrl = DEFAULT_RPCS[state.chain as SupportedChain];
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    const provider = new ethers.JsonRpcProvider(fetchReq);
    const AAWalletAddress = process.env.EVM_AA_ADDRESS || '';
    
    if (!AAWalletAddress) {
      throw new Error('AA_WALLET_ADDRESS is not set in environment variables');
    }

    let wallet: ethers.Wallet;
    try {
      wallet = new ethers.Wallet(privateKeyBuf.toString(), provider);
    } finally {
      privateKeyBuf.fill(0);
      privateKeyBuf = Buffer.alloc(0);
    }

    let balanceInfo = '';
    let estimatedFee = '';

    // Check balance
    if (assetType === 'Native Token') {
      const balance = await provider.getBalance(AAWalletAddress);
      const requiredAmount = ethers.parseEther(amount.toString());
      const balanceEth = ethers.formatEther(balance);
      
      balanceInfo = `Current Balance: ${balanceEth} ${state.chain === 'Base' ? 'ETH' : state.chain === 'BSC' ? 'BNB' : 'ETH'}`;
      
      if (balance < requiredAmount) {
        throw new Error(`Insufficient balance! Need ${amount}, have ${balanceEth}`);
      }
    } else {
      // ERC20 Token
      const erc20BalanceIface = new ethers.Interface([
        'function balanceOf(address owner) view returns (uint256)',
        'function decimals() view returns (uint8)'
      ]);
      const balanceContract = new Contract(tokenAddress, erc20BalanceIface, wallet);
      
      try {
        const [balance, decimals] = await Promise.all([
          balanceContract.balanceOf(AAWalletAddress),
          balanceContract.decimals()
        ]);
        const tokenBalance = ethers.formatUnits(balance, decimals);
        balanceInfo = `Current Token Balance: ${tokenBalance} tokens`;
        
        if (Number(tokenBalance) < Number(amount)) {
          throw new Error(`Insufficient token balance! Need ${amount}, have ${tokenBalance}`);
        }
      } catch (err) {
        balanceInfo = 'Could not fetch token balance';
        console.warn('Token balance check failed:', err);
      }
    }

    // Estimate gas fee
    try {
      const contractWithSigner = new Contract(AAWalletAddress, evmExecuteABI, wallet);
      let calls: Array<{ target: string; value: bigint; data: string }> = [];
      
      if (assetType === 'Native Token') {
        const value = ethers.parseEther(amount.toString());
        calls = [{ target: recipient, value, data: '0x' }];
      } else {
        const erc20Iface = new ethers.Interface([
          'function transfer(address to,uint256 amount) external returns (bool)',
          'function decimals() view returns (uint8)'
        ]);
        const tokenContract = new Contract(tokenAddress, erc20Iface, wallet);
        
        let decimals = 18;
        try {
          decimals = await tokenContract.decimals();
        } catch {}
        
        const amtInBaseUnits = ethers.parseUnits(amount.toString(), decimals);
        const data = erc20Iface.encodeFunctionData('transfer', [recipient, amtInBaseUnits]);
        calls = [{ target: tokenAddress, value: 0n, data }];
      }

      const gasEstimate: bigint = await (contractWithSigner.execute as any).estimateGas(calls);
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
      if (gasPrice) {
        const estimatedFeeWei = gasEstimate * gasPrice;
        estimatedFee = `${ethers.formatEther(estimatedFeeWei)} ${state.chain === 'Base' ? 'ETH' : state.chain === 'BSC' ? 'BNB' : 'ETH'} (gas: ${gasEstimate})`;
      }
    } catch (err) {
      estimatedFee = 'Could not estimate';
    }

    // Show confirmation page
    const nativeTokenSymbol = getNativeTokenSymbol(state.chain);
    const unit = assetType === 'Native Token' ? nativeTokenSymbol : 'tokens';
    
    const html = renderTemplate('confirm-transaction', {
      SESSION_ID: session,
      BLOCKCHAIN: state.chain,
      ASSET_TYPE: assetType,
      TOKEN_ADDRESS_ROW: createTokenAddressRow(tokenAddress),
      RECIPIENT: recipient,
      AMOUNT: amount.toString(),
      UNIT: unit,
      BALANCE_INFO: balanceInfo,
      ESTIMATED_FEE: estimatedFee,
      EXECUTE_ENDPOINT: '/execute-evm'
    });
    
    res.send(html);

  } catch (error: any) {
    const html = renderTemplate('error', {
      TITLE: 'Error',
      ERROR_TITLE: 'Error',
      ERROR_MESSAGE: error.message,
      BACK_ACTION: 'window.history.back()',
      BACK_TEXT: 'Go Back'
    });
    
    res.send(html);
  }
});

app.post('/execute-solana', async (req, res) => {
  const { session } = req.body;
  const state = transactionStates.get(session);
  
  if (!state) {
    return res.json({ success: false, error: 'Session expired' });
  }

  try {
    // Execute Solana transaction
    let privateKeyBuf = Buffer.from(process.env.WALLET_SECRET_KEY || '', 'utf8');
    const connection = new Connection(DEFAULT_RPCS.Solana, 'confirmed');
    
    let keypair: Keypair;
    try {
      keypair = await parseSolanaKeypair(privateKeyBuf.toString());
    } finally {
      privateKeyBuf.fill(0);
      privateKeyBuf = Buffer.alloc(0);
    }

    const provider = new anchor.AnchorProvider(
      connection,
      new anchor.Wallet(keypair),
      { preflightCommitment: 'confirmed' }
    );

    const saId = process.env.SA_ID || '';
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
      const tokenMintPubkey = new PublicKey(state.mintAddress);
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

    // Clean up
    transactionStates.delete(session);

    const html = renderTemplate('transaction-success', {
      ASSET_TYPE: state.assetType,
      AMOUNT: state.amount.toString(),
      UNIT: state.assetType === 'Native SOL' ? 'SOL' : 'tokens',
      RECIPIENT: state.recipient,
      TRANSACTION_HASH: createTransactionHashDisplay(transactionReceipt.txSignature) // No transaction hash for Solana
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('Solana transaction failed:', error);
    
    const html = renderTemplate('error', {
      TITLE: 'Transaction Failed',
      ERROR_TITLE: 'Transaction Failed',
      ERROR_MESSAGE: error.message || 'An unexpected error occurred',
      BACK_ACTION: "window.location.href='/'",
      BACK_TEXT: 'Try Again'
    });
    
    res.send(html);
  }
});

app.post('/execute-evm', async (req, res) => {
  const { session } = req.body;
  const state = transactionStates.get(session);
  
  if (!state) {
    return res.json({ success: false, error: 'Session expired' });
  }

  try {
    // Execute EVM transaction
    let privateKeyBuf = Buffer.from(process.env.EVM_EOA_PRIVATE_KEY || '', 'utf8');
    const rpcUrl = DEFAULT_RPCS[state.chain as SupportedChain];
    const fetchReq = new ethers.FetchRequest(rpcUrl);
    const provider = new ethers.JsonRpcProvider(fetchReq);
    const AAWalletAddress = process.env.EVM_AA_ADDRESS || '';

    let wallet: ethers.Wallet;
    try {
      wallet = new ethers.Wallet(privateKeyBuf.toString(), provider);
    } finally {
      privateKeyBuf.fill(0);
      privateKeyBuf = Buffer.alloc(0);
    }

    let calls: Array<{ target: string; value: bigint; data: string }> = [];

    if (state.assetType === 'Native Token') {
      const value = ethers.parseEther(state.amount.toString());
      calls = [{ target: state.recipient, value, data: '0x' }];
    } else {
      // ERC20 Token
      const erc20Iface = new ethers.Interface([
        'function transfer(address to,uint256 amount) external returns (bool)',
        'function decimals() view returns (uint8)'
      ]);

      const tokenContract = new Contract(state.tokenAddress, erc20Iface, wallet);
      
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {}
      
      let amtInBaseUnits = 0;
      try{
        amtInBaseUnits = Number(ethers.parseUnits(state.amount.toString(), decimals));
      } catch {
        throw new Error('Invalid amount, input amount possibly smaller than the minimal token unit');
      }
      const data = erc20Iface.encodeFunctionData('transfer', [state.recipient, BigInt(amtInBaseUnits)]);
      calls = [{ target: state.tokenAddress, value: 0n, data }];
    }

    const contractWithSigner = new Contract(AAWalletAddress, evmExecuteABI, wallet);
    const tx = await contractWithSigner.execute(calls);

    // Clean up
    transactionStates.delete(session);

    const nativeTokenSymbol = getNativeTokenSymbol(state.chain);
    const unit = state.assetType === 'Native Token' ? nativeTokenSymbol : 'tokens';

    const html = renderTemplate('transaction-success', {
      ASSET_TYPE: state.assetType,
      AMOUNT: state.amount.toString(),
      UNIT: unit,
      RECIPIENT: state.recipient,
      TRANSACTION_HASH: createTransactionHashDisplay(tx.hash)
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('EVM transaction failed:', error);
    
    const html = renderTemplate('error', {
      TITLE: 'Transaction Failed',
      ERROR_TITLE: 'Transaction Failed',
      ERROR_MESSAGE: error.reason || error.message || 'An unexpected error occurred',
      BACK_ACTION: "window.location.href='/'",
      BACK_TEXT: 'Try Again'
    });
    
    res.send(html);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Emergency Escape Off-Boarding Tool is running`);
  console.log(`📱 Open your browser and navigate to http://localhost:${PORT} to start using the tool`);
});

export default app;
