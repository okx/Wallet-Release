#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { Transaction } from "@solana/web3.js";
import { createSecp256r1Instruction } from "../../tests/utils/r1-utils";
import { SmartAccountHelper } from "../../tests/utils/smartAccount/helpers";
import { createDummySecp256r1Instruction } from "./constants";
import { getVaultConfigAccount } from "../../tests/utils/helpers";

// Configuration constants
const WEBAUTHN_ORIGIN = "https://example.com";
const WEBAUTHN_ANDROID_PACKAGE_NAME = "com.okinc.okex.gp";

// Get compute buffer percentage from environment, default to 15%
const COMPUTE_BUFFER_PERCENTAGE = process.env.COMPUTE_BUFFER_PERCENTAGE
  ? parseFloat(process.env.COMPUTE_BUFFER_PERCENTAGE) / 100
  : 0.15;

export interface OptimizationResult {
  optimalComputeUnits: number;
  actualUsage: number;
  efficiency: number;
  transactionSize: number;
}

export interface BatchOptimizationResult {
  optimalComputeUnits: number;
  actualUsage: number;
  efficiency: number;
  transactionSize: number;
  estimatedFees: {
    baseFee: number;
    priorityFee: number;
    totalFee: number;
    totalFeeSOL: number;
  };
}

/**
 * Simulate smart account creation to find optimal compute units
 */
export async function simulateAccountCreation(
  saProgram: any,
  vaultProgram: any,
  provider: anchor.AnchorProvider,
  createPayAccountArgs: any,
  authData: any,
  message: Uint8Array,
  signatureOrInstruction: Buffer | anchor.web3.TransactionInstruction, // Accept either signature or instruction
  wrappedR1Key: any,
  creator: any,
  smartAccountPda: anchor.web3.PublicKey,
  vaultPda: anchor.web3.PublicKey,
  vaultStatePda: anchor.web3.PublicKey,
  config: anchor.web3.PublicKey,
  vaultConfig: anchor.web3.PublicKey,
  useComputeBudget: boolean = true // Optional parameter to control compute budget usage
): Promise<OptimizationResult> {
  // Use maximum compute units for simulation to ensure transaction can complete
  const maxComputeUnits = 1400000; // Max allowed compute units per transaction

  try {
    // Determine pre-instructions based on options
    const preInstructions: anchor.web3.TransactionInstruction[] = [];

    // Add compute budget instructions if enabled
    if (useComputeBudget) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: maxComputeUnits,
        });
      const computePriceIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });
      preInstructions.push(computeBudgetIx, computePriceIx);
    }

    // Add secp256r1 instruction - either dummy or real
    if (signatureOrInstruction instanceof anchor.web3.TransactionInstruction) {
      // Use the provided dummy instruction
      preInstructions.push(signatureOrInstruction);
    } else {
      // Create real secp256r1 instruction with provided signature
      preInstructions.push(
        createSecp256r1Instruction(
          message,
          Buffer.from(wrappedR1Key.getPublicKeyArray()),
          signatureOrInstruction
        )
      );
    }

    const tx = await saProgram.methods
      .simulateCreateAccount(createPayAccountArgs, {
        origin: WEBAUTHN_ORIGIN,
        androidPackageName: WEBAUTHN_ANDROID_PACKAGE_NAME,
        authData: Array.from(authData),
      })
      .accountsPartial({
        txPayer: creator.publicKey,
        creator: creator.publicKey,
        vaultProgram: vaultProgram.programId,
        config,
        vaultConfig,
        smartAccount: smartAccountPda,
        smartAccountVault: vaultPda,
        vaultState: vaultStatePda,
      })
      .preInstructions(preInstructions)
      .signers([creator])
      .transaction();

    // Set recent blockhash and fee payer before signing
    tx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    tx.feePayer = creator.publicKey;

    // Sign the transaction with all instructions (including compute budget)
    tx.sign(creator);

    // Calculate transaction size after signing
    const serializedTx = tx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const transactionSize = serializedTx.length;

    // Simulate the transaction
    const simulationResult = await provider.connection.simulateTransaction(tx);

    // Extract response data
    const { err, logs, unitsConsumed } = simulationResult.value;

    console.log(`   📊 Units consumed: ${unitsConsumed || 0}`);
    if (logs && logs.length > 0) {
      console.log(`   📜 Simulation logs: ${logs.length} entries`);
    }

    if (err) {
      const errorString = JSON.stringify(err);
      console.log(`   🔍 Error details: ${errorString}`);

      // Check if this is the expected simulation complete error
      if (
        errorString.includes("SimulationComplete") ||
        errorString.includes("6017") ||
        (logs &&
          logs.some(
            (log) =>
              log.includes("SimulationComplete") ||
              log.includes("Error Number: 6017") ||
              log.includes("custom program error: 0x177d")
          ))
      ) {
        const actualUsage = unitsConsumed || 0;
        if (actualUsage > 0) {
          const efficiency = (actualUsage / maxComputeUnits) * 100;
          const optimalUnits = Math.ceil(
            actualUsage * (1 + COMPUTE_BUFFER_PERCENTAGE)
          ); // Add configurable buffer for safety

          console.log(
            `   ✅ Simulation successful: ${actualUsage} compute units used`
          );

          return {
            optimalComputeUnits: optimalUnits,
            actualUsage,
            efficiency,
            transactionSize,
          };
        } else {
          console.log(
            `   ⚠️ Expected error found but no compute units consumed`
          );
          throw new Error(
            "Simulation completed but no compute units were consumed"
          );
        }
      } else {
        console.log(
          `   ❌ Simulation failed with unexpected error: ${errorString}`
        );
        throw new Error(`Simulation failed: ${errorString}`);
      }
    } else {
      console.log(
        `   ⚠️ Simulation succeeded without expected SimulationComplete error`
      );
      console.log(`   📊 Actual units consumed: ${unitsConsumed || 0}`);
      throw new Error(
        "Simulation succeeded without expected SimulationComplete error"
      );
    }
  } catch (error: any) {
    console.log(`   ❌ Simulation error: ${error.message}`);
    throw error;
  }
}

/**
 * Simulate batch execution to find optimal compute units
 */
export async function simulateBatchExecution(
  saProgram: any,
  vaultProgram: any,
  provider: anchor.AnchorProvider,
  smartAccountHelper: SmartAccountHelper,
  userTransaction: Transaction,
  useComputeBudget: boolean = true
): Promise<BatchOptimizationResult> {
  const maxComputeUnits = 1400000;

  try {
    // 1. Prepare user intent from the transaction
    const {
      serializedIntent,
      deconstructedInstructions,
      remainingAccounts,
      numSigners,
    } = await smartAccountHelper.prepareUserIntent(
      userTransaction,
      {
        tokenAmount: 0,
      },
      useComputeBudget
        ? [
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: maxComputeUnits,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 1000,
            }),
          ]
        : undefined
    );

    // 2. Create dummy authData for simulation
    const dummyAuthData = new Uint8Array(37); // Standard WebAuthn authData size

    // 3. Create pre-instructions for simulation
    const preInstructions: anchor.web3.TransactionInstruction[] = [];

    // Add compute budget instructions if enabled
    if (useComputeBudget) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: maxComputeUnits,
        });
      const computePriceIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });
      preInstructions.push(computeBudgetIx, computePriceIx);
    }

    // Add dummy secp256r1 instruction (required for smart account validation)
    const dummyR1Ix = createDummySecp256r1Instruction();
    preInstructions.push(dummyR1Ix);

    // 4. Create simulation transaction
    const simulationTx = await saProgram.methods
      .simulateValidateExecution({
        origin: WEBAUTHN_ORIGIN,
        androidPackageName: WEBAUTHN_ANDROID_PACKAGE_NAME,
        authData: Array.from(dummyAuthData),
      })
      .accountsPartial({
        txPayer: provider.publicKey,
        mandatorySigner: smartAccountHelper.mandatorySigner.publicKey,
        smartAccount: smartAccountHelper.sa,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        vaultProgram: vaultProgram.programId,
        vaultState: smartAccountHelper.vaultState,
        smartAccountVault: smartAccountHelper.vault,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .preInstructions(preInstructions)
      .postInstructions([
        await vaultProgram.methods
          .simulateBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: smartAccountHelper.vaultState,
            smartAccountVault: smartAccountHelper.vault,
          })
          .remainingAccounts(remainingAccounts)
          .instruction(),
      ])
      .signers([provider.wallet.payer, smartAccountHelper.mandatorySigner])
      .transaction();

    // 5. Set recent blockhash and fee payer
    simulationTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    simulationTx.feePayer = provider.publicKey;
    simulationTx.sign(
      provider.wallet.payer,
      smartAccountHelper.mandatorySigner
    );

    // 6. Calculate transaction size
    const serializedTx = simulationTx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const transactionSize = serializedTx.length;

    // 7. Simulate the transaction
    const simulationResult =
      await provider.connection.simulateTransaction(simulationTx);

    // 8. Extract response data
    const { err, logs, unitsConsumed } = simulationResult.value;

    if (err) {
      const errorString = JSON.stringify(err);

      // Check if this is the expected simulation complete error
      if (
        errorString.includes("6013") || // Vault simulation complete (correct error code)
        (logs && logs.some((log) => log.includes("Error Number: 6013")))
      ) {
        const actualUsage = unitsConsumed || 0;
        if (actualUsage > 0) {
          const efficiency = (actualUsage / maxComputeUnits) * 100;
          const optimalUnits = Math.ceil(
            actualUsage * (1 + COMPUTE_BUFFER_PERCENTAGE)
          ); // Add configurable buffer for safety

          // Calculate fees
          const baseFee = 5000; // lamports per signature
          const priorityFee = (actualUsage * 1000) / 1_000_000; // micro-lamports to lamports
          const totalFee = baseFee + priorityFee;

          const estimatedFees = {
            baseFee,
            priorityFee,
            totalFee,
            totalFeeSOL: totalFee / 1e9,
          };

          return {
            optimalComputeUnits: optimalUnits,
            actualUsage,
            efficiency,
            transactionSize,
            estimatedFees,
          };
        } else {
          console.log(
            `   ⚠️ Expected error found but no compute units consumed`
          );
          throw new Error(
            "Simulation completed but no compute units were consumed"
          );
        }
      } else {
        // Only show logs for unexpected errors
        console.log(
          `   ❌ Simulation failed with unexpected error: ${errorString}`
        );
        if (logs && logs.length > 0) {
          console.log(`   📜 Error logs:`);
          logs.forEach((log, i) => {
            console.log(`      [${i}] ${log}`);
          });
        }
        throw new Error(`Batch simulation failed: ${errorString}`);
      }
    } else {
      console.log(`   📊 Actual units consumed: ${unitsConsumed || 0}`);
      throw new Error(
        "Simulation succeeded without expected SimulationComplete error"
      );
    }
  } catch (error: any) {
    console.log(`   ❌ Batch simulation error: ${error.message}`);
    throw error;
  }
}

/**
 * Simulate smart account migration to find optimal compute units
 */
export async function simulateMigration(
  saProgram: any,
  vaultProgram: any,
  provider: anchor.AnchorProvider,
  smartAccountHelper: SmartAccountHelper,
  migrationInstruction: anchor.web3.TransactionInstruction,
  useComputeBudget: boolean = true
): Promise<BatchOptimizationResult> {
  const maxComputeUnits = 1400000;

  try {
    // 1. Prepare migration intent with compute budget instructions
    const computeBudgetInstructions = useComputeBudget
      ? [
          anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
            units: maxComputeUnits,
          }),
          anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
            microLamports: 1000,
          }),
        ]
      : [];

    const serializedIntent = await smartAccountHelper.prepareMigrationIntent(
      migrationInstruction,
      0, // No token amount for simulation
      undefined,
      computeBudgetInstructions
    );

    // 2. Create dummy authData for simulation
    const dummyAuthData = new Uint8Array(37); // Standard WebAuthn authData size

    // 3. Create pre-instructions for simulation
    const preInstructions: anchor.web3.TransactionInstruction[] = [];

    // Add compute budget instructions if enabled
    if (useComputeBudget) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: maxComputeUnits,
        });
      const computePriceIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });
      preInstructions.push(computeBudgetIx, computePriceIx);
    }

    // Add dummy secp256r1 instruction (required for smart account validation)
    const dummyR1Ix = createDummySecp256r1Instruction();
    preInstructions.push(dummyR1Ix);

    // 4. Create simulation transaction
    const simulationTx = await saProgram.methods
      .simulateCloseAndMigrate(migrationInstruction.data, {
        origin: WEBAUTHN_ORIGIN,
        androidPackageName: WEBAUTHN_ANDROID_PACKAGE_NAME,
        authData: Array.from(dummyAuthData),
      })
      .accountsPartial({
        payer: provider.publicKey,
        mandatorySigner: smartAccountHelper.mandatorySigner.publicKey,
        smartAccount: smartAccountHelper.sa,
        vaultProgram: vaultProgram.programId,
        vaultConfig: getVaultConfigAccount(),
        smartAccountVault: smartAccountHelper.vault,
        vaultState: smartAccountHelper.vaultState,
        newDelegatedProgram: migrationInstruction.programId,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .remainingAccounts(
        migrationInstruction.keys.map((account) => ({
          ...account,
          isSigner: account.pubkey.equals(smartAccountHelper.sa)
            ? false
            : account.isSigner,
        }))
      )
      .preInstructions(preInstructions)
      .signers([provider.wallet.payer, smartAccountHelper.mandatorySigner])
      .transaction();

    // 5. Set recent blockhash and fee payer
    simulationTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    simulationTx.feePayer = provider.publicKey;
    simulationTx.sign(
      provider.wallet.payer,
      smartAccountHelper.mandatorySigner
    );

    // 6. Calculate transaction size
    const serializedTx = simulationTx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    const transactionSize = serializedTx.length;

    // 7. Simulate the transaction
    const simulationResult =
      await provider.connection.simulateTransaction(simulationTx);

    // 8. Extract response data
    const { err, logs, unitsConsumed } = simulationResult.value;

    if (err) {
      const errorString = JSON.stringify(err);

      // Check if this is the expected simulation complete error
      if (
        errorString.includes("SimulationComplete") ||
        errorString.includes("6017") ||
        (logs &&
          logs.some(
            (log) =>
              log.includes("SimulationComplete") ||
              log.includes("Error Number: 6017") ||
              log.includes("custom program error: 0x177d")
          ))
      ) {
        const actualUsage = unitsConsumed || 0;
        if (actualUsage > 0) {
          const efficiency = (actualUsage / maxComputeUnits) * 100;
          const optimalUnits = Math.ceil(
            actualUsage * (1 + COMPUTE_BUFFER_PERCENTAGE)
          ); // Add configurable buffer for safety

          // Calculate fees
          const baseFee = 5000; // lamports per signature
          const priorityFee = (actualUsage * 1000) / 1_000_000; // micro-lamports to lamports
          const totalFee = baseFee + priorityFee;

          const estimatedFees = {
            baseFee,
            priorityFee,
            totalFee,
            totalFeeSOL: totalFee / 1e9,
          };

          return {
            optimalComputeUnits: optimalUnits,
            actualUsage,
            efficiency,
            transactionSize,
            estimatedFees,
          };
        } else {
          console.log(
            `   ⚠️ Expected error found but no compute units consumed`
          );
          throw new Error(
            "Simulation completed but no compute units were consumed"
          );
        }
      } else {
        // Only show logs for unexpected errors
        console.log(
          `   ❌ Simulation failed with unexpected error: ${errorString}`
        );
        if (logs && logs.length > 0) {
          console.log(`   📜 Error logs:`);
          logs.forEach((log, i) => {
            console.log(`      [${i}] ${log}`);
          });
        }
        throw new Error(`Migration simulation failed: ${errorString}`);
      }
    } else {
      console.log(`   📊 Actual units consumed: ${unitsConsumed || 0}`);
      throw new Error(
        "Simulation succeeded without expected SimulationComplete error"
      );
    }
  } catch (error: any) {
    console.log(`   ❌ Migration simulation error: ${error.message}`);
    throw error;
  }
}
