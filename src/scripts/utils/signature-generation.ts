#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { ethers } from "ethers";
import { buildWebauthnMessage } from "../../tests/utils/webauthn";
import { serializeInstructionsForSignature } from "./instruction-serialization";

// Configuration constants
const WEBAUTHN_ORIGIN = "https://example.com";
const WEBAUTHN_ANDROID_PACKAGE_NAME = "com.okinc.okex.gp";

export interface SignatureGenerationResult {
  message: Uint8Array;
  authData: Uint8Array;
  signature: Buffer;
}

/**
 * Generate R1 signature with optional compute budget instructions included in the intent
 */
export function generateCreateAccountR1Signature(
  saProgram: any,
  createPayAccountArgs: any,
  smartAccountPda: anchor.web3.PublicKey,
  vaultPda: anchor.web3.PublicKey,
  vaultStatePda: anchor.web3.PublicKey,
  computeBudgetInstructions: anchor.web3.TransactionInstruction[] = [], // Optional, defaults to empty array
  wrappedR1Key: any
): SignatureGenerationResult {
  console.log("🔐 Generating R1 signature...");

  let serializedComputeBudgetIxs = Buffer.alloc(0);

  // Only serialize compute budget instructions if provided
  if (computeBudgetInstructions.length > 0) {
    console.log("   📝 Including compute budget instructions in signature...");
    serializedComputeBudgetIxs = serializeInstructionsForSignature(
      computeBudgetInstructions
    );
  } else {
    console.log(
      "   📝 Creating signature without compute budget instructions..."
    );
  }

  // Serialize account creation arguments
  const createAccountArgsBuffer = saProgram.coder.types.encode(
    "createPayAccountArgs",
    createPayAccountArgs
  );
  const tokenAmountBuffer = Buffer.alloc(8);
  tokenAmountBuffer.writeBigUInt64LE(BigInt(0));
  const tokenMintBuffer = Buffer.alloc(1);
  tokenMintBuffer.writeUInt8(0); // No token mint
  const serializedArgs = Buffer.concat([
    tokenAmountBuffer,
    tokenMintBuffer,
    createAccountArgsBuffer,
    smartAccountPda.toBuffer(),
    vaultPda.toBuffer(),
    vaultStatePda.toBuffer(),
  ]);

  const serializedIntentWithComputeBudget = Buffer.concat([
    serializedComputeBudgetIxs,
    serializedArgs,
  ]);

  console.log("   🔐 Generating signature...");

  // Generate hash and signature with compute budget included
  const hashHexStringWithBudget = ethers.keccak256(
    serializedIntentWithComputeBudget
  );
  const hashBytesWithBudget = Buffer.from(
    ethers.toBeArray(hashHexStringWithBudget)
  );
  const challengeWithBudget = hashBytesWithBudget.toString("base64url");
  const { message: messageWithBudget, authData: authDataWithBudget } =
    buildWebauthnMessage(
      challengeWithBudget,
      WEBAUTHN_ORIGIN,
      WEBAUTHN_ANDROID_PACKAGE_NAME
    );

  // Generate the real signature with the compute budget included in the intent
  const realSignature = wrappedR1Key.sign(Buffer.from(messageWithBudget));

  if (computeBudgetInstructions.length > 0) {
    console.log("   ✅ R1 signature generated with compute budget");
  } else {
    console.log("   ✅ R1 signature generated");
  }

  return {
    message: messageWithBudget,
    authData: authDataWithBudget,
    signature: realSignature,
  };
}

// Keep the old function name for backward compatibility
export const generateR1SignatureWithComputeBudget =
  generateCreateAccountR1Signature;
