import * as crypto from "crypto";
import dotenv from "dotenv";
import {
  isGreaterThan,
  subtractBigNumbers,
  SECP256R1_HALF_ORDER,
  SECP256R1_ORDER,
  FIELD_SIZE,
} from "../tests/utils/r1-utils";

// Load environment variables
dotenv.config();

export interface TestR1Key {
  getPublicKey(encoding: string, format?: string): string;
  encodePrivateKey(): string;
  sign(message: Buffer): Buffer;
  getPublicKeyArray(): number[];
  privateKeyPem: string;
}

export class TestR1KeyHelper implements TestR1Key {
  public ecPem: any;
  public privateKeyPem: string;

  constructor(privateKeyPem: string) {
    this.privateKeyPem = privateKeyPem;

    // Load ec-pem dynamically to handle potential import issues
    const ecPemModule = require("ec-pem");

    // Load existing keypair from PEM string
    this.ecPem = ecPemModule.loadPrivateKey(privateKeyPem);
  }

  /**
   * Get the public key in various formats
   */
  getPublicKey(encoding: string, format?: string): string {
    const compressionFormat =
      format === "compressed" ? "compressed" : "uncompressed";
    const publicKeyHex = this.ecPem.getPublicKey(encoding, compressionFormat);
    return publicKeyHex;
  }

  /**
   * Encode the private key as PEM string
   */
  encodePrivateKey(): string {
    return this.privateKeyPem;
  }

  /**
   * Get public key as number array (for Anchor/Solana usage)
   */
  getPublicKeyArray(): number[] {
    const publicKeyHex = this.getPublicKey("hex", "compressed");
    const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");
    return Array.from(publicKeyBuffer);
  }

  /**
   * Sign a message and return normalized signature
   * Uses the same logic as SmartAccountHelper.signPasskey
   */
  sign(message: Buffer): Buffer {
    // Use crypto.createSign with the ec-pem keypair
    const signer = crypto.createSign("sha256");
    signer.update(message);
    let sigString = signer.sign(this.privateKeyPem, "hex");

    // Parse DER signature to extract r and s values
    // @ts-ignore
    const xlength = 2 * ("0x" + sigString.slice(6, 8));
    sigString = sigString.slice(8);

    // Extract r and s as hex strings
    const rHex = sigString.slice(0, xlength);
    const sHex = sigString.slice(xlength + 4);

    // Convert to 32-byte buffers
    let r = Buffer.from(rHex, "hex");
    let s = Buffer.from(sHex, "hex");

    // Pad to 32 bytes if needed
    if (r.length < FIELD_SIZE) {
      const paddedR = Buffer.alloc(FIELD_SIZE, 0);
      r.copy(paddedR, FIELD_SIZE - r.length);
      r = paddedR;
    }
    if (s.length < FIELD_SIZE) {
      const paddedS = Buffer.alloc(FIELD_SIZE, 0);
      s.copy(paddedS, FIELD_SIZE - s.length);
      s = paddedS;
    }

    // Truncate if longer than 32 bytes (remove leading zeros)
    if (r.length > FIELD_SIZE) {
      r = r.subarray(r.length - FIELD_SIZE);
    }
    if (s.length > FIELD_SIZE) {
      s = s.subarray(s.length - FIELD_SIZE);
    }

    // Check s-value normalization using Uint8Array
    const sNormalizationNeeded = isGreaterThan(s, SECP256R1_HALF_ORDER);
    if (sNormalizationNeeded) {
      const normalizedS = subtractBigNumbers(SECP256R1_ORDER, s);
      s = Buffer.from(normalizedS);
    }

    // Combine r and s into 64-byte signature
    const signature = Buffer.concat([r, s]);

    return signature;
  }
}

/**
 * Load the test R1 key from environment variables
 * Throws an error if the key is not found
 */
export function loadTestR1Key(): TestR1Key {
  const privateKeyPem = process.env.TEST_R1_PRIVATE_KEY;

  if (!privateKeyPem) {
    throw new Error(
      "TEST_R1_PRIVATE_KEY not found in environment variables. " +
        "Run 'node scripts/generate-r1-key.js' to generate a test key."
    );
  }

  // Convert escaped newlines back to actual newlines
  const formattedPem = privateKeyPem.replace(/\\n/g, "\n");

  return new TestR1KeyHelper(formattedPem);
}

/**
 * Create a test R1 key with a specific private key (for deterministic testing)
 */
export function createTestR1Key(privateKeyPem: string): TestR1Key {
  return new TestR1KeyHelper(privateKeyPem);
}

/**
 * Generate a new random R1 key for one-off testing
 * Note: This won't be persistent across test runs
 */
export function generateRandomTestR1Key(): TestR1Key {
  const ecPemModule = require("ec-pem");
  const keypair = ecPemModule(null, "prime256v1");
  keypair.generateKeys();

  const privateKeyPem = keypair.encodePrivateKey();
  return new TestR1KeyHelper(privateKeyPem);
}
