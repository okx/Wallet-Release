import bs58 from 'bs58';
import fs from 'fs';
import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SmartAccountSolana } from "../target/types/smart_account_solana";
import { Connection, Keypair } from "@solana/web3.js";
import { SOLANA_RPC_URL } from "./consts";

export function lamportsToSol(lamports: number | bigint): string {
  const val = typeof lamports === 'bigint' ? Number(lamports) : lamports;
  return (val / 1_000_000_000).toString();
}

export function amountToBaseUnits(humanAmount: string | number, decimals: number): bigint {
  const [whole, fracRaw = ''] = String(humanAmount).split('.');
  const frac = (fracRaw + '0'.repeat(decimals)).slice(0, decimals);
  const base = BigInt(10) ** BigInt(decimals);
  const wholePart = BigInt(whole || '0') * base;
  const fracPart = BigInt(frac || '0');
  return wholePart + fracPart;
}

export function parseSolanaKeypair(secret: string): Keypair {
  let bytes: Uint8Array | null = null;

  try {
    // Handle comma-separated numbers (like "71,38,247,179,...")
    if (secret.includes(',') && !secret.startsWith('[')) {
      const numbers = secret.split(',').map(s => parseInt(s.trim(), 10));
      if (numbers.every(n => !isNaN(n) && n >= 0 && n <= 255)) {
        bytes = Uint8Array.from(numbers);
      }
    } else {
      // Handle JSON array format
      const arr = JSON.parse(secret);
      if (Array.isArray(arr)) {
        bytes = Uint8Array.from(arr);
      }
    }
  } catch {}
  if (!bytes) {
    try {
      const decoded = bs58.decode(secret);
      bytes = Uint8Array.from(decoded);
    } catch {}
  }
  if (!bytes) {
    try {
      const hex = secret.startsWith('0x') ? secret.slice(2) : secret;
      const buf = Buffer.from(hex, 'hex');
      bytes = Uint8Array.from(buf);
    } catch {}
  }
  if (!bytes) {
    throw new Error('Invalid Solana private key format. Provide JSON array, base58, or hex.');
  }
  if (bytes.length === 64) {
    return Keypair.fromSecretKey(bytes);
  }
  if (bytes.length === 32) {
    return Keypair.fromSeed(bytes);
  }
  throw new Error('Invalid Solana private key length. Expected 32 or 64 bytes.');
}

export function parseBase58SecretKeyToUint8Array(privateKey: string): string {
  if (privateKey.startsWith("[")) {
    return privateKey;
  }
  if (!privateKey) {
    throw new Error("Private key is required");
  }
  try {
    const privateKeyArray = Uint8Array.from(bs58.decode(privateKey).slice(0, 64));
    const arrayString = privateKeyArray.toString();
    return `[${arrayString}]`; // Add brackets to make it proper JSON array format
  } catch (error) {
    throw new Error("Invalid private key format");
  }
}

export async function getSAId(AAWalletAddress: string,keypair: Keypair) {
  const connection = new Connection(SOLANA_RPC_URL, "confirmed");
  const wallet = new anchor.Wallet(keypair);

  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);

  const saProgram = anchor.workspace
      .SmartAccountSolana as Program<SmartAccountSolana>;
  const saAccount = await saProgram.account.smartAccount.fetch(
      AAWalletAddress
  );

  const bytes: Uint8Array = Uint8Array.from(saAccount.id);
  
  const saId = Buffer.from(bytes).toString("hex")
  return saId;
}
