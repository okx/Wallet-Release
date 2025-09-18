/**
 * Emergency Off-Boarding Tool - Main Server
 * Handles HTTP requests and delegates business logic to services
 */
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import path from 'path';
import { cleanEnvironmentVariables } from './utils';
import { renderTemplate, createTransactionHashDisplay, getNativeTokenSymbol } from './template-renderer';
import { processSolanaTransaction, executeSolanaTransaction } from './services/solana_services';
import { processEvmTransaction, executeEvmTransaction } from './services/evm_services';
import { 
  validateChain, 
  validateSessionId, 
  validatePort, 
  ValidationError, 
  sanitizeInput,
  type SupportedChain
} from './helpers/validation';

dotenv.config();

const app = express();
const PORT = validatePort(process.env.PORT, 3000);

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));


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
  try {
    const chain = sanitizeInput(req.body.chain);
    validateChain(chain);
    
    const sessionId = Date.now().toString();
    transactionStates.set(sessionId, { chain });
    
    if (chain === 'Solana') {
      res.redirect(`/solana-form?session=${sessionId}`);
    } else {
      res.redirect(`/evm-form?session=${sessionId}&chain=${chain}`);
    }
  } catch (error) {
    console.error('Chain selection validation error:', error);
    const html = renderTemplate('error', {
      TITLE: 'Invalid Chain Selection',
      ERROR_TITLE: 'Invalid Chain Selection',
      ERROR_MESSAGE: error instanceof ValidationError ? error.message : 'Invalid blockchain selection',
      BACK_ACTION: 'window.history.back()',
      BACK_TEXT: 'Go Back'
    });
    res.send(html);
  }
});

app.get('/solana-form', (req, res) => {
  try {
    const sessionId = validateSessionId(sanitizeInput(req.query.session as string));
    const state = transactionStates.get(sessionId);
    
    if (!state) {
      return res.redirect('/');
    }

    const html = renderTemplate('solana-form', {
      SESSION_ID: sessionId
    });
    
    res.send(html);
  } catch (error) {
    console.error('Session validation error:', error);
    res.redirect('/');
  }
});

app.get('/evm-form', (req, res) => {
  try {
    const sessionId = validateSessionId(sanitizeInput(req.query.session as string));
    const chain = sanitizeInput(req.query.chain as string);
    validateChain(chain);
    
    const state = transactionStates.get(sessionId);
    if (!state) {
      return res.redirect('/');
    }

    const html = renderTemplate('evm-form', {
      SESSION_ID: sessionId,
      CHAIN: chain
    });
    
    res.send(html);
  } catch (error) {
    console.error('EVM form validation error:', error);
    res.redirect('/');
  }
});

app.post('/process-solana', async (req, res) => {
  try {
    const session = validateSessionId(sanitizeInput(req.body.session));
    const { assetType, mintAddress, recipient, amount } = req.body;
    const state = transactionStates.get(session);
    
    if (!state) {
      return res.redirect('/');
    }

    const { templateData } = await processSolanaTransaction(assetType, mintAddress, recipient, amount);
    
    // Store transaction details
    state.assetType = assetType;
    state.mintAddress = mintAddress;
    state.recipient = recipient;
    // Preserve the original string to avoid scientific notation issues later
    state.amount = Number(amount);
    state.amountStr = amount;
    transactionStates.set(session, state);

    // Show confirmation page
    const html = renderTemplate('confirm-transaction', {
      SESSION_ID: session,
      BLOCKCHAIN: 'Solana',
      ...templateData
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('Solana processing error:', error);
    const html = renderTemplate('error', {
      TITLE: 'Error',
      ERROR_TITLE: 'Error',
      ERROR_MESSAGE: error instanceof ValidationError ? error.message : error.message || 'An unexpected error occurred',
      BACK_ACTION: 'window.history.back()',
      BACK_TEXT: 'Go Back'
    });
    
    res.send(html);
  }
});

app.post('/process-evm', async (req, res) => {
  try {
    const session = validateSessionId(sanitizeInput(req.body.session));
    const { assetType, tokenAddress, recipient, amount } = req.body;
    const state = transactionStates.get(session);
    
    if (!state) {
      return res.redirect('/');
    }

    const { templateData } = await processEvmTransaction(state.chain, assetType, tokenAddress, recipient, amount);
    
    // Store transaction details
    state.assetType = assetType;
    state.tokenAddress = tokenAddress;
    state.recipient = recipient;
    state.amount = amount;
    state.amountStr = amount;
    transactionStates.set(session, state);
    
    const html = renderTemplate('confirm-transaction', {
      SESSION_ID: session,
      ...templateData
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('EVM processing error:', error);
    const html = renderTemplate('error', {
      TITLE: 'Error',
      ERROR_TITLE: 'Error',
      ERROR_MESSAGE: error instanceof ValidationError ? error.message : error.message || 'An unexpected error occurred',
      BACK_ACTION: 'window.history.back()',
      BACK_TEXT: 'Go Back'
    });
    
    res.send(html);
  }
});

app.post('/execute-solana', async (req, res) => {
  try {
    const session = validateSessionId(sanitizeInput(req.body.session));
    const state = transactionStates.get(session);
    
    if (!state) {
      return res.json({ success: false, error: 'Session expired' });
    }

    const txSignature = await executeSolanaTransaction(state);

    // Clean up
    transactionStates.delete(session);

    const html = renderTemplate('transaction-success', {
      ASSET_TYPE: state.assetType,
      AMOUNT: state.amount.toString(),
      UNIT: state.assetType === 'Native SOL' ? 'SOL' : 'tokens',
      RECIPIENT: state.recipient,
      TRANSACTION_HASH: createTransactionHashDisplay(txSignature)
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('Solana transaction failed:', error);
    
    const html = renderTemplate('error', {
      TITLE: 'Transaction Failed',
      ERROR_TITLE: 'Transaction Failed',
      ERROR_MESSAGE: error instanceof ValidationError ? error.message : error.message || 'An unexpected error occurred',
      BACK_ACTION: "window.location.href='/'",
      BACK_TEXT: 'Try Again'
    });
    
    res.send(html);
  }
});

app.post('/execute-evm', async (req, res) => {
  try {
    const session = validateSessionId(sanitizeInput(req.body.session));
    const state = transactionStates.get(session);
    
    if (!state) {
      return res.json({ success: false, error: 'Session expired' });
    }

    const txHash = await executeEvmTransaction(state);

    // Clean up
    transactionStates.delete(session);

    const nativeTokenSymbol = getNativeTokenSymbol(state.chain);
    const unit = state.assetType === 'Native Token' ? nativeTokenSymbol : 'tokens';

    const html = renderTemplate('transaction-success', {
      ASSET_TYPE: state.assetType,
      AMOUNT: state.amount.toString(),
      UNIT: unit,
      RECIPIENT: state.recipient,
      TRANSACTION_HASH: createTransactionHashDisplay(txHash)
    });
    
    res.send(html);

  } catch (error: any) {
    console.error('EVM transaction failed:', error);
    
    const html = renderTemplate('error', {
      TITLE: 'Transaction Failed',
      ERROR_TITLE: 'Transaction Failed',
      ERROR_MESSAGE: error instanceof ValidationError ? error.message : error.reason || error.message || 'An unexpected error occurred',
      BACK_ACTION: "window.location.href='/'",
      BACK_TEXT: 'Try Again'
    });
    
    res.send(html);
  }
});

// Start server and keep reference for graceful shutdown
const server = app.listen(PORT, () => {
  console.log(`🚀 Emergency Escape Off-Boarding Tool is running`);
  console.log(`📱 Open your browser and navigate to http://localhost:${PORT} to start using the tool`);
});

// Graceful shutdown helper
function gracefulShutdown(reason: string | Error) {
  try {
    console.log("\nShutting down server:", reason);
    cleanEnvironmentVariables();
  } catch (err) {
    console.error("Failed to clean environment variables:", err);
  } finally {
    process.exit(typeof reason === "number" ? reason : 0);
  }
}

// Handle process signals and unexpected errors
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("exit", (code) => cleanEnvironmentVariables());
process.on("uncaughtException", (err) => gracefulShutdown(err));
process.on("unhandledRejection", (reason) => gracefulShutdown(reason as Error));

// Ensure cleanup when server closes normally
server.on("close", () => cleanEnvironmentVariables());

export default app;
