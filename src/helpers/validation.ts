/**
 * Input Validation Helper Functions
 * Centralized validation for all user inputs in the wallet application
 */

import { ethers } from 'ethers';
import { PublicKey } from '@solana/web3.js';

// Type definitions
export type SupportedChain = 'Solana' | 'Base' | 'BNB_Chain' | 'xLayer';
export type EvmAssetType = 'Native Token' | 'ERC20 Token';
export type SolanaAssetType = 'Native SOL' | 'SPL Token';
export type AssetType = EvmAssetType | SolanaAssetType;

// Validation error class
export class ValidationError extends Error {
  constructor(message: string, public field?: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Chain validation
export function validateChain(chain: string): asserts chain is SupportedChain {
  const supportedChains: SupportedChain[] = ['Solana', 'Base', 'BNB_Chain', 'xLayer'];
  if (!supportedChains.includes(chain as SupportedChain)) {
    throw new ValidationError(`Invalid blockchain. Supported chains: ${supportedChains.join(', ')}`, 'chain');
  }
}

export function isEvmChain(chain: string): chain is 'Base' | 'BNB_Chain' | 'xLayer' {
  return ['Base', 'BNB_Chain', 'xLayer'].includes(chain);
}

export function isSolanaChain(chain: string): chain is 'Solana' {
  return chain === 'Solana';
}

// Asset type validation
export function validateAssetType(assetType: string, chain: SupportedChain): asserts assetType is AssetType {
  if (isSolanaChain(chain)) {
    const validSolanaTypes: SolanaAssetType[] = ['Native SOL', 'SPL Token'];
    if (!validSolanaTypes.includes(assetType as SolanaAssetType)) {
      throw new ValidationError(`Invalid asset type for Solana. Valid types: ${validSolanaTypes.join(', ')}`, 'assetType');
    }
  } else if (isEvmChain(chain)) {
    const validEvmTypes: EvmAssetType[] = ['Native Token', 'ERC20 Token'];
    if (!validEvmTypes.includes(assetType as EvmAssetType)) {
      throw new ValidationError(`Invalid asset type for EVM chains. Valid types: ${validEvmTypes.join(', ')}`, 'assetType');
    }
  }
}

// Address validation
export function validateEvmAddress(address: string, fieldName: string = 'address'): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`, fieldName);
  }
  
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  if (!ethers.isAddress(trimmedAddress)) {
    throw new ValidationError(`Invalid EVM ${fieldName}. Please provide a valid Ethereum address`, fieldName);
  }

  return trimmedAddress;
}

export function validateSolanaAddress(address: string, fieldName: string = 'address'): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError(`${fieldName} is required and must be a string`, fieldName);
  }
  
  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
  }

  try {
    new PublicKey(trimmedAddress);
    if (!PublicKey.isOnCurve(trimmedAddress)) {
      throw new ValidationError(`Invalid Solana ${fieldName}. Address is not on the curve`, fieldName);
    }
    return trimmedAddress;
  } catch (error) {
    throw new ValidationError(`Invalid Solana ${fieldName}. Please provide a valid base58-encoded public key`, fieldName);
  }
}

export function validateTokenAddress(address: string, chain: SupportedChain, assetType: AssetType): string {
  if (!address || typeof address !== 'string') {
    throw new ValidationError('Token address is required', 'tokenAddress');
  }

  const trimmedAddress = address.trim();
  if (!trimmedAddress) {
    throw new ValidationError('Token address cannot be empty', 'tokenAddress');
  }

  // Check if token address is required
  if (isSolanaChain(chain) && assetType === 'SPL Token') {
    return validateSolanaAddress(trimmedAddress, 'SPL token mint address');
  } else if (isEvmChain(chain) && assetType === 'ERC20 Token') {
    return validateEvmAddress(trimmedAddress, 'ERC20 token contract address');
  }

  return trimmedAddress;
}

// Amount validation
export function validateAmount(amount: string | number, fieldName: string = 'amount'): number {
  if (amount === null || amount === undefined || amount === '') {
    throw new ValidationError(`${fieldName} is required`, fieldName);
  }

  let numAmount: number;
  
  if (typeof amount === 'string') {
    const trimmed = amount.trim();
    if (!trimmed) {
      throw new ValidationError(`${fieldName} cannot be empty`, fieldName);
    }
    
    numAmount = Number(trimmed);
  } else {
    numAmount = amount;
  }

  if (isNaN(numAmount)) {
    throw new ValidationError(`${fieldName} must be a valid number`, fieldName);
  }

  if (!isFinite(numAmount)) {
    throw new ValidationError(`${fieldName} must be a finite number`, fieldName);
  }

  if (numAmount <= 0) {
    throw new ValidationError(`${fieldName} must be greater than 0`, fieldName);
  }

  // Check for reasonable upper bounds to prevent overflow
  if (numAmount > Number.MAX_SAFE_INTEGER) {
    throw new ValidationError(`${fieldName} is too large`, fieldName);
  }

  // Check for reasonable lower bounds to prevent underflow
  if (numAmount < Number.MIN_SAFE_INTEGER) {
    throw new ValidationError(`${fieldName} is too small`, fieldName);
  }

  // Check for reasonable precision (max 18 decimal places)
  const decimalPlaces = (numAmount.toString().split('.')[1] || '').length;
  if (decimalPlaces > 18) {
    throw new ValidationError(`${fieldName} cannot have more than 18 decimal places`, fieldName);
  }

  return numAmount;
}

// Session validation
export function validateSessionId(sessionId: string): string {
  if (!sessionId || typeof sessionId !== 'string') {
    throw new ValidationError('Session ID is required', 'sessionId');
  }

  const trimmed = sessionId.trim();
  if (!trimmed) {
    throw new ValidationError('Session ID cannot be empty', 'sessionId');
  }

  // Handle potential scientific notation by converting to number and back to string
  // This ensures we get the precise value without scientific notation
  let normalizedSessionId = trimmed;
  if (trimmed.includes('e') || trimmed.includes('E')) {
    try {
      const numValue = Number(trimmed);
      if (isNaN(numValue) || !isFinite(numValue)) {
        throw new ValidationError('Invalid session ID format', 'sessionId');
      }
      // Convert back to precise string representation without scientific notation
      normalizedSessionId = numValue.toFixed(0);
    } catch {
      throw new ValidationError('Invalid session ID format', 'sessionId');
    }
  }

  // Basic format validation - should be numeric timestamp-like
  if (!/^\d+$/.test(normalizedSessionId)) {
    throw new ValidationError('Invalid session ID format', 'sessionId');
  }

  return normalizedSessionId;
}

// Environment variable validation
export function validateEnvironmentVariable(varName: string, value: string | undefined): string {
  if (!value || typeof value !== 'string') {
    throw new ValidationError(`${varName} environment variable is required and must be set`, varName);
  }

  const trimmed = value.trim();
  if (!trimmed) {
    throw new ValidationError(`${varName} environment variable cannot be empty`, varName);
  }

  return trimmed;
}

// Private key validation
export function validateEvmPrivateKey(privateKey: string): string {
  const validated = validateEnvironmentVariable('EVM_EOA_PRIVATE_KEY', privateKey);

  // EVM private keys must be 32 bytes (64 hex chars) with an optional 0x prefix
  const evmPkRegex = /^(0x)?[0-9a-fA-F]{64}$/;
  if (!evmPkRegex.test(validated)) {
    throw new ValidationError(
      'Invalid EVM private key format, expected 64 hexadecimal characters',
      'EVM_EOA_PRIVATE_KEY'
    );
  }

  try {
    // Additional check – can a wallet be instantiated from it?
    new ethers.Wallet(validated);
    return validated;
  } catch {
    throw new ValidationError('Invalid EVM private key.', 'EVM_EOA_PRIVATE_KEY');
  }
}

export function validateSolanaPrivateKey(privateKey: string): string {
  const validated = validateEnvironmentVariable('SOL_EOA_PRIVATE_KEY', privateKey);

  // Solana secret keys are 64-byte arrays => 88-char base58 when encoded
  const solPkRegex = /^[1-9A-HJ-NP-Za-km-z]{88}$/;
  if (!solPkRegex.test(validated)) {
    throw new ValidationError(
      'Invalid Solana private key format – must be an 88-character base58 string',
      'SOL_EOA_PRIVATE_KEY'
    );
  }

  return validated;
}

// Comprehensive transaction input validation
export interface EvmTransactionInput {
  chain: string;
  assetType: string;
  tokenAddress?: string;
  recipient: string;
  amount: string | number;
}

export interface SolanaTransactionInput {
  assetType: string;
  mintAddress?: string;
  recipient: string;
  amount: string | number;
}

export function validateEvmTransactionInput(input: EvmTransactionInput): {
  chain: 'Base' | 'BNB_Chain' | 'xLayer';
  assetType: EvmAssetType;
  tokenAddress?: string;
  recipient: string;
  amount: number;
} {
  // Validate chain
  validateChain(input.chain);
  if (!isEvmChain(input.chain)) {
    throw new ValidationError('Chain must be an EVM chain for EVM transactions', 'chain');
  }

  // Validate asset type
  validateAssetType(input.assetType, input.chain);

  // Validate recipient
  const recipient = validateEvmAddress(input.recipient, 'recipient');

  // Validate token address if needed
  let tokenAddress: string | undefined;
  if (input.assetType === 'ERC20 Token') {
    if (!input.tokenAddress) {
      throw new ValidationError('Token address is required for ERC20 transactions', 'tokenAddress');
    }
    tokenAddress = validateTokenAddress(input.tokenAddress, input.chain, input.assetType as EvmAssetType);
  } else if (input.tokenAddress && input.tokenAddress.trim()) {
    // If token address is provided for native token, validate it anyway for safety
    tokenAddress = validateTokenAddress(input.tokenAddress, input.chain, input.assetType as EvmAssetType);
  }

  // Validate amount
  const amount = validateAmount(input.amount);

  return {
    chain: input.chain,
    assetType: input.assetType as EvmAssetType,
    tokenAddress,
    recipient,
    amount
  };
}

export function validateSolanaTransactionInput(input: SolanaTransactionInput): {
  assetType: SolanaAssetType;
  mintAddress?: string;
  recipient: string;
  amount: number;
} {
  // Validate asset type (assume Solana chain)
  validateAssetType(input.assetType, 'Solana');

  // Validate recipient
  const recipient = validateSolanaAddress(input.recipient, 'recipient');

  // Validate mint address if needed
  let mintAddress: string | undefined;
  if (input.assetType === 'SPL Token') {
    if (!input.mintAddress) {
      throw new ValidationError('Mint address is required for SPL token transactions', 'mintAddress');
    }
    mintAddress = validateTokenAddress(input.mintAddress, 'Solana', input.assetType as SolanaAssetType);
  } else if (input.mintAddress && input.mintAddress.trim()) {
    // If mint address is provided for native SOL, validate it anyway for safety
    mintAddress = validateTokenAddress(input.mintAddress, 'Solana', input.assetType as SolanaAssetType);
  }

  // Validate amount
  const amount = validateAmount(input.amount);

  return {
    assetType: input.assetType as SolanaAssetType,
    mintAddress,
    recipient,
    amount
  };
}

// Utility function to validate and sanitize all inputs
export function sanitizeInput(input: string | undefined): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return input.trim();
}

// Utility function to format numbers without scientific notation
export function formatNumberWithoutScientificNotation(num: number): string {
  if (!isFinite(num)) {
    throw new Error('Cannot format infinite or NaN values');
  }
  
  // For integers, use toFixed(0) to avoid scientific notation
  if (Number.isInteger(num)) {
    return num.toFixed(0);
  }
  
  // For decimals, check if the string representation contains 'e' 
  const str = num.toString();
  if (str.includes('e') || str.includes('E')) {
    // Use toFixed with appropriate precision to avoid scientific notation
    // Determine decimal places by converting to string and checking
    const parts = str.split('e');
    const exponent = parseInt(parts[1] || '0');
    const precision = Math.max(0, -exponent + (parts[0].split('.')[1]?.length || 0));
    return num.toFixed(Math.min(precision, 18)); // Cap at 18 decimal places
  }
  
  return str;
}

// Port validation for server
export function validatePort(port: string | number | undefined, defaultPort: number = 3000): number {
  if (!port) {
    return defaultPort;
  }

  const numPort = typeof port === 'string' ? parseInt(port, 10) : port;
  
  if (isNaN(numPort) || numPort < 1 || numPort > 65535) {
    throw new ValidationError(`Invalid port number: ${port}. Port must be between 1 and 65535`, 'port');
  }

  return numPort;
}
