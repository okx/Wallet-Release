import { Keypair } from '@solana/web3.js';
import bs58 from 'bs58';
import fs from 'fs';

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

export async function parseSolanaKeypair(secret: string): Promise<Keypair> {
  let bytes: Uint8Array | null = null;

  // 0. If the string looks like a filepath and the file exists, load it
  try {
    if (secret.length < 300 && fs.existsSync(secret)) {
      const fileContent = fs.readFileSync(secret, 'utf8');
      secret = fileContent.trim();
    }
  } catch (_) {}
  try {
    const arr = JSON.parse(secret);
    if (Array.isArray(arr)) {
      bytes = Uint8Array.from(arr);
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