#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";

export function serializeInstructionsForSignature(
  instructions: anchor.web3.TransactionInstruction[]
): Buffer {
  let serializedIxs = Buffer.alloc(0);

  for (const ix of instructions) {
    let ixData = Buffer.alloc(0);

    // 1. Instruction data first
    ixData = Buffer.concat([ixData, ix.data]);

    // 2. Program ID second
    ixData = Buffer.concat([ixData, ix.programId.toBuffer()]);

    // 3. For each account: is_signer, is_writable, pubkey
    for (const account of ix.keys) {
      ixData = Buffer.concat([
        ixData,
        Buffer.from([account.isSigner ? 1 : 0]),
        Buffer.from([account.isWritable ? 1 : 0]),
        account.pubkey.toBuffer(),
      ]);
    }

    serializedIxs = Buffer.concat([serializedIxs, ixData]);
  }

  return serializedIxs;
}

/**
 * Create optimized compute budget instructions
 * Returns empty array if computeUnits is 0, null, or undefined
 */
export function createComputeBudgetInstructions(
  computeUnits?: number | null,
  microLamports: number = 1000
): anchor.web3.TransactionInstruction[] {
  // Return empty array if no compute units specified
  if (!computeUnits || computeUnits <= 0) {
    return [];
  }

  const computeBudgetIx = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
    units: computeUnits,
  });

  const computePriceIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
    microLamports,
  });

  return [computeBudgetIx, computePriceIx];
}

/**
 * Calculate estimated transaction fees
 */
export function calculateTransactionFees(
  actualUsage: number,
  microLamports: number = 1000
) {
  const baseFee = 5000; // lamports per signature
  const priorityFee = (actualUsage * microLamports) / 1_000_000; // micro-lamports to lamports
  const totalFee = baseFee + priorityFee;

  return {
    baseFee,
    priorityFee,
    totalFee,
    totalFeeSOL: totalFee / 1e9,
  };
}
