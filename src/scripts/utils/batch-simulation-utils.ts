#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  SystemProgram,
} from "@solana/web3.js";

export interface SimulationOptions {
  provider: anchor.AnchorProvider;
  maxComputeUnits?: number;
  computePriceMicroLamports?: number;
  description?: string;
}

export interface SimulationResult {
  description: string;
  computeUnitsUsed: number | null;
  transactionSize: number;
  success: boolean;
  error?: string;
  logs?: string[];
  estimatedFees?: {
    baseFee: number;
    priorityFee: number;
    totalFee: number;
  };
}

/**
 * Simulate a transaction and return detailed results
 */
export async function simulateTransaction(
  instructions: TransactionInstruction[],
  signers: anchor.web3.Keypair[],
  options: SimulationOptions
): Promise<SimulationResult> {
  const {
    provider,
    maxComputeUnits = 1000000,
    computePriceMicroLamports = 1000,
    description = "Unknown Transaction",
  } = options;

  try {
    // Build transaction with compute budget
    const tx = new Transaction();

    // Add compute budget instructions
    if (maxComputeUnits > 0) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: maxComputeUnits,
        });
      tx.add(computeBudgetIx);
    }

    if (computePriceMicroLamports > 0) {
      const computePriceIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: computePriceMicroLamports,
        });
      tx.add(computePriceIx);
    }

    // Add the actual instructions
    instructions.forEach((ix) => tx.add(ix));

    // Set transaction details
    tx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    tx.feePayer = signers[0].publicKey;

    // Sign transaction
    tx.sign(...signers);

    // Calculate transaction size
    const serializedTx = tx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const transactionSize = serializedTx.length;

    // Simulate the transaction
    const simulationResult = await provider.connection.simulateTransaction(tx);

    // Calculate estimated fees
    const baseFee = 5000 * signers.length; // 5000 lamports per signature
    const computeUnitsUsed = simulationResult.value.unitsConsumed || 0;
    const priorityFee =
      (computeUnitsUsed * computePriceMicroLamports) / 1_000_000;
    const totalFee = baseFee + priorityFee;

    if (simulationResult.value.err) {
      return {
        description,
        computeUnitsUsed: simulationResult.value.unitsConsumed || null,
        transactionSize,
        success: false,
        error: JSON.stringify(simulationResult.value.err),
        logs: simulationResult.value.logs || [],
        estimatedFees: {
          baseFee,
          priorityFee,
          totalFee,
        },
      };
    }

    return {
      description,
      computeUnitsUsed: simulationResult.value.unitsConsumed || null,
      transactionSize,
      success: true,
      logs: simulationResult.value.logs || [],
      estimatedFees: {
        baseFee,
        priorityFee,
        totalFee,
      },
    };
  } catch (error: any) {
    return {
      description,
      computeUnitsUsed: null,
      transactionSize: 0,
      success: false,
      error: error.message,
      estimatedFees: {
        baseFee: 0,
        priorityFee: 0,
        totalFee: 0,
      },
    };
  }
}

/**
 * Run batch simulations for multiple transaction types
 */
export async function runBatchSimulations(
  simulations: Array<{
    instructions: TransactionInstruction[];
    signers: anchor.web3.Keypair[];
    options: SimulationOptions;
  }>
): Promise<SimulationResult[]> {
  console.log(
    `🔬 Running batch simulations for ${simulations.length} transactions...\n`
  );

  const results: SimulationResult[] = [];

  for (let i = 0; i < simulations.length; i++) {
    const { instructions, signers, options } = simulations[i];
    console.log(
      `📊 Simulation ${i + 1}/${simulations.length}: ${options.description || "Unknown"}`
    );

    const result = await simulateTransaction(instructions, signers, options);
    results.push(result);

    // Display immediate results
    if (result.success) {
      console.log(
        `   ✅ Success - ${result.computeUnitsUsed || "N/A"} compute units, ${result.transactionSize} bytes`
      );
      if (result.estimatedFees) {
        console.log(
          `   💰 Estimated fees: ${(result.estimatedFees.totalFee / 1e9).toFixed(6)} SOL`
        );
      }
    } else {
      console.log(`   ❌ Failed - ${result.error}`);
    }
    console.log();
  }

  return results;
}

/**
 * Generate common transaction types for simulation testing
 */
export function generateCommonTransactions(
  payer: anchor.web3.Keypair,
  recipient?: PublicKey
): Array<{
  instructions: TransactionInstruction[];
  signers: anchor.web3.Keypair[];
  options: SimulationOptions;
}> {
  const testRecipient = recipient || PublicKey.unique();

  return [
    {
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: testRecipient,
          lamports: anchor.web3.LAMPORTS_PER_SOL * 0.01, // 0.01 SOL
        }),
      ],
      signers: [payer],
      options: {
        provider: anchor.getProvider() as anchor.AnchorProvider,
        maxComputeUnits: 50000,
        computePriceMicroLamports: 1000,
        description: "Simple SOL Transfer (0.01 SOL)",
      },
    },
    {
      instructions: [
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: PublicKey.unique(),
          lamports: anchor.web3.LAMPORTS_PER_SOL * 0.001,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: PublicKey.unique(),
          lamports: anchor.web3.LAMPORTS_PER_SOL * 0.001,
        }),
        SystemProgram.transfer({
          fromPubkey: payer.publicKey,
          toPubkey: PublicKey.unique(),
          lamports: anchor.web3.LAMPORTS_PER_SOL * 0.001,
        }),
      ],
      signers: [payer],
      options: {
        provider: anchor.getProvider() as anchor.AnchorProvider,
        maxComputeUnits: 150000,
        computePriceMicroLamports: 1000,
        description: "Batch SOL Transfers (3x 0.001 SOL)",
      },
    },
  ];
}

/**
 * Display simulation summary
 */
export function displaySimulationSummary(results: SimulationResult[]): void {
  console.log("📋 Batch Simulation Summary");
  console.log("=".repeat(50));

  let totalSuccessful = 0;
  let totalComputeUnits = 0;
  let totalTransactionSize = 0;
  let totalEstimatedFees = 0;

  results.forEach((result, index) => {
    console.log(`\n${index + 1}. ${result.description}`);
    console.log(`   Status: ${result.success ? "✅ Success" : "❌ Failed"}`);
    console.log(`   Compute Units: ${result.computeUnitsUsed || "N/A"}`);
    console.log(`   Transaction Size: ${result.transactionSize} bytes`);

    if (result.estimatedFees) {
      const feesInSol = result.estimatedFees.totalFee / 1e9;
      console.log(`   Est. Fees: ${feesInSol.toFixed(6)} SOL`);
      totalEstimatedFees += result.estimatedFees.totalFee;
    }

    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }

    if (result.success) {
      totalSuccessful++;
      totalComputeUnits += result.computeUnitsUsed || 0;
      totalTransactionSize += result.transactionSize;
    }
  });

  console.log("\n" + "=".repeat(50));
  console.log("📊 Summary Statistics:");
  console.log(
    `   Successful: ${totalSuccessful}/${results.length} (${((totalSuccessful / results.length) * 100).toFixed(1)}%)`
  );
  console.log(
    `   Avg Compute Units: ${totalSuccessful > 0 ? Math.round(totalComputeUnits / totalSuccessful) : "N/A"}`
  );
  console.log(
    `   Avg Transaction Size: ${totalSuccessful > 0 ? Math.round(totalTransactionSize / totalSuccessful) : "N/A"} bytes`
  );
  console.log(
    `   Total Est. Fees: ${(totalEstimatedFees / 1e9).toFixed(6)} SOL`
  );
}

/**
 * Optimize compute units for a transaction by testing different limits
 */
export async function optimizeComputeUnits(
  instructions: TransactionInstruction[],
  signers: anchor.web3.Keypair[],
  options: Omit<SimulationOptions, "maxComputeUnits">
): Promise<{
  optimalComputeUnits: number;
  actualUsage: number;
  efficiency: number;
}> {
  const testLimits = [50000, 100000, 200000, 400000, 600000, 800000, 1000000];

  console.log("🔧 Optimizing compute units...");

  for (const limit of testLimits) {
    const result = await simulateTransaction(instructions, signers, {
      ...options,
      maxComputeUnits: limit,
      description: `Testing ${limit} compute units`,
    });

    if (result.success && result.computeUnitsUsed) {
      const efficiency = (result.computeUnitsUsed / limit) * 100;
      const optimalLimit = Math.ceil(result.computeUnitsUsed * 1.1); // Add 10% buffer

      console.log(
        `   ✅ Optimal: ${optimalLimit} units (${efficiency.toFixed(1)}% efficiency)`
      );

      return {
        optimalComputeUnits: optimalLimit,
        actualUsage: result.computeUnitsUsed,
        efficiency: efficiency,
      };
    }
  }

  throw new Error(
    "Could not find optimal compute units - all simulations failed"
  );
}

// Export for use in other scripts
export default {
  simulateTransaction,
  runBatchSimulations,
  generateCommonTransactions,
  displaySimulationSummary,
  optimizeComputeUnits,
};
