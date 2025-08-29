import * as anchor from "@coral-xyz/anchor";
import { ethers } from "ethers";
// Import ec-pem using require syntax
const ecPem = require("ec-pem");

export interface R1KeyInfo {
  type: "r1";
  keyObject: any; // The raw R1 key object from ec-pem
  publicKeyHex: string;
  publicKeyBytes: number[];
  keccak256Hash: string;
}

export interface SolanaKeyInfo {
  type: "solana";
  keyObject: anchor.web3.Keypair;
  publicKeyBase58: string;
}

export type KeyInfo = R1KeyInfo | SolanaKeyInfo;

/**
 * Load and parse a key from environment variables
 */
export function loadKeyFromEnv(keyName: string): KeyInfo {
  const envValue = process.env[keyName];
  if (!envValue) {
    throw new Error(`${keyName} environment variable is required`);
  }

  switch (keyName) {
    case "TEST_R1_PRIVATE_KEY":
    case "TEST_RECOVERY_R1_PRIVATE_KEY":
      return loadR1Key(keyName);

    case "MANDATORY_SIGNER_SECRET_KEY":
    case "WALLET_SECRET_KEY":
    case "ADMIN_SECRET_KEY":
    case "RECOVERY_SIGNER_SECRET_KEY":
    case "MARGINFI_ACCOUNT_KEY":
    case "RAYDIUM_V3_USDC_USDT_LP_KEY":
    case "PROPOSER_SECRET_KEY":
    case "EXECUTOR_SECRET_KEY":
    case "CANCELLER_SECRET_KEY":
      return loadSolanaKey(envValue);

    default:
      throw new Error(`Unsupported key type: ${keyName}`);
  }
}

/**
 * Load R1 key from environment and extract public key info
 */
function loadR1Key(keyName: string): R1KeyInfo {
  const pemString = process.env[keyName]!;
  const rawKey = ecPem.loadPrivateKey(pemString);
  const publicKeyHex = rawKey.getPublicKey("hex", "compressed");
  const publicKeyBytes = Array.from(Buffer.from(publicKeyHex, "hex"));
  const keccak256Hash = ethers.keccak256(Buffer.from(publicKeyHex, "hex"));

  return {
    type: "r1",
    keyObject: rawKey,
    publicKeyHex,
    publicKeyBytes,
    keccak256Hash,
  };
}

/**
 * Load Solana keypair from JSON secret key
 */
function loadSolanaKey(secretKeyJson: string): SolanaKeyInfo {
  const secretKeyArray = JSON.parse(secretKeyJson);
  const keyObject = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(secretKeyArray)
  );

  return {
    type: "solana",
    keyObject,
    publicKeyBase58: keyObject.publicKey.toBase58(),
  };
}

/**
 * Load R1 key from PEM string (for parsing existing keys)
 */
export function loadR1KeyFromPem(pemString: string): R1KeyInfo {
  const rawKey = ecPem.loadPrivateKey(pemString);
  const publicKeyHex = rawKey.getPublicKey("hex", "compressed");
  const publicKeyBytes = Array.from(Buffer.from(publicKeyHex, "hex"));
  const keccak256Hash = ethers.keccak256(Buffer.from(publicKeyHex, "hex"));

  return {
    type: "r1",
    keyObject: rawKey,
    publicKeyHex,
    publicKeyBytes,
    keccak256Hash,
  };
}

/**
 * Display key information in a consistent format
 */
export function displayKeyInfo(keyName: string, keyInfo: KeyInfo): void {
  switch (keyInfo.type) {
    case "r1":
      console.log(`🔑 ${keyName}:`);
      console.log(`   R1 Public Key (hex): ${keyInfo.publicKeyHex}`);
      console.log(
        `   R1 Public Key (33 bytes): [${keyInfo.publicKeyBytes.join(", ")}]`
      );
      console.log(`   Keccak256 Hash: ${keyInfo.keccak256Hash}`);
      break;

    case "solana":
      console.log(`🔐 ${keyName}:`);
      console.log(`   Public Key: ${keyInfo.publicKeyBase58}`);
      break;
  }
}

/**
 * Convert R1KeyInfo to the format expected by SmartAccountHelper
 * This extracts the raw ec-pem key object that SmartAccountHelper can handle
 */
export function convertR1KeyForSmartAccount(r1KeyInfo: R1KeyInfo): any {
  return r1KeyInfo.keyObject;
}
