import * as anchor from "@coral-xyz/anchor";
import { ethers } from "ethers";
import { parseBase58SecretKeyToUint8Array } from "../utils";
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
    case "WALLET_SECRET_KEY":
    case "SOL_EOA_PRIVATE_KEY":
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
function loadSolanaKey(base58SecretKey: string): SolanaKeyInfo {
  const secretKeyJson = parseBase58SecretKeyToUint8Array(base58SecretKey);
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

