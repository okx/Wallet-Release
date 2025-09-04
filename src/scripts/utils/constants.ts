#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";

// Configuration constants
export const WEBAUTHN_ORIGIN = "https://example.com";
export const WEBAUTHN_ANDROID_PACKAGE_NAME = "com.okinc.okex.gp";
export const PASSKEY_VALIDITY_PERIOD_SECONDS = 365 * 24 * 60 * 60; // 1 year
export const VAULT_FUNDING_AMOUNT_SOL = 0.05; // SOL to transfer to vault

// Dummy secp256r1 instruction data for simulation
export const DUMMY_R1_INSTRUCTION_DATA = Buffer.from(
  "01003100ffff1000ffff71002000ffff028312517f8c9b40966852f2a16214f68a312c02945350edfd0341cbbc1ef6f61fdce3dc00832ed4051510a3e2ef01eee9f09f9f3686c42448669d3d62e9662f2a3b69e88e9184a477572a41b5ca8c443363a6808bc2ef8dd2747aa990bbb58f9592a81daf32ce6857998bd9af92186bfd12e546bd43ec1018a9008e8ac89e85a5",
  "hex"
);

/**
 * Create a dummy secp256r1 instruction for simulation
 * Note: This is used when compute budget optimization is enabled
 * Set USE_COMPUTE_BUDGET_OPTIMIZATION=false in .env to disable optimization
 */
export function createDummySecp256r1Instruction(): anchor.web3.TransactionInstruction {
  return new anchor.web3.TransactionInstruction({
    programId: new anchor.web3.PublicKey(
      "Secp256r1SigVerify1111111111111111111111111"
    ),
    keys: [], // No accounts needed for secp256r1 instruction
    data: DUMMY_R1_INSTRUCTION_DATA,
  });
}
