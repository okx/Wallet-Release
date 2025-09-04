#!/usr/bin/env tsx
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Transaction } from "@solana/web3.js";
import { loadEnv } from "../helpers/setup";
import { loadKeyFromEnv } from "../helpers/key-loader";
import { InstructionLogger } from "../helpers/instruction-logger";
import { SmartAccountHelper } from "../tests/utils/smartAccount/helpers";
import {
  deriveWebAuthnTableAddress,
  generateIdFromString,
} from "../tests/utils/helpers";
import { createSecp256r1Instruction } from "../tests/utils/r1-utils";
import { simulateBatchExecution } from "./utils";
import dotenv from "dotenv";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../tests/utils/webauthn";

// Load environment variables
dotenv.config();

/**
 * Configuration update types
 */
type ConfigUpdateType =
  | "add-recovery-signer"
  | "remove-recovery-signer"
  | "add-passkey"
  | "remove-passkey"
  | "add-solana-key"
  | "remove-solana-key";

// ==============================================
// CONFIGURATION - Modify this section
// ==============================================

const CONFIG = {
  // Choose the update type (uncomment ONE of these)
  updateType: "remove-recovery-signer" as ConfigUpdateType,
  // updateType: "add-passkey" as ConfigUpdateType,
  // updateType: "remove-passkey" as ConfigUpdateType,
  // updateType: "add-solana-key" as ConfigUpdateType,
  // updateType: "add-recovery-signer" as ConfigUpdateType,
  // updateType: "remove-solana-key" as ConfigUpdateType,

  // Configuration for different update types (all always present)

  addRecoverySigner: {
    signer: "11111111111111111111111111111111", // mock recovery signer
  },

  removeRecoverySigner: {
    signer: "11111111111111111111111111111111", // mock recovery signer
  },

  addPasskey: {
    // Base64 encoded public key (33 bytes compressed)
    passkeyPubkey:
      "A2f8k9ZvQx4mN7pR3sT6uW9xY2eF5hI8jK1lM4nO7pQ0rS3tU6vX9yZ2aBcDeFgHi", // Generated secp256r1 compressed pubkey
    // Optional: Unix timestamps for validity period
    validFrom: Math.floor(Date.now() / 1000), // Current time
    validUntil: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
  },

  removePasskey: {
    // Base64 encoded public key to remove
    passkeyPubkey:
      "A2f8k9ZvQx4mN7pR3sT6uW9xY2eF5hI8jK1lM4nO7pQ0rS3tU6vX9yZ2aBcDeFgHi", // Same key for example
  },

  addSolanaKey: {
    teeKeyPubkey: new anchor.web3.PublicKey(
      "So11111111111111111111111111111111111111112"
    ),
    // Optional: Unix timestamps for validity period
    validFrom: Math.floor(Date.now() / 1000), // Current time
    validUntil: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
  },

  removeSolanaKey: {
    teeKeyPubkey: new anchor.web3.PublicKey(
      "So11111111111111111111111111111111111111112"
    ),
    // Optional: Unix timestamps for validity period
    validFrom: Math.floor(Date.now() / 1000), // Current time
    validUntil: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60, // 1 year from now
  },
};

// ==============================================
// END CONFIGURATION
// ==============================================

// Configuration for simulation and optimization
const USE_COMPUTE_BUDGET_OPTIMIZATION =
  process.env.USE_COMPUTE_BUDGET_OPTIMIZATION !== "false";

/**
 * Log the complete smart account state
 */
function logSmartAccountState(
  saAccount: any,
  title: string,
  previousNonce?: number
) {
  console.log(`\n${title}:`);
  console.log("================================");
  console.log(`ID: ${Buffer.from(saAccount.id).toString("hex")}`);

  // Show previous nonce only if provided
  const nonceDisplay =
    previousNonce !== undefined
      ? `${saAccount.nonce} (was ${previousNonce})`
      : saAccount.nonce.toString();
  console.log(`Nonce: ${nonceDisplay}`);

  console.log(
    `Recovery Signers: ${saAccount.recoverySigners.map((signer) =>
      signer.toBase58()
    )}`
  );

  console.log("Passkey Signers\n");
  saAccount.authorizationModel.signers[0].passkeySigners.forEach(
    (signer: any, index: number) => {
      console.log(`  ${index}: ${Buffer.from(signer.pubkey).toString("hex")}`);
      console.log(
        `      Valid from: ${signer.validFrom.toString()} (${new Date(signer.validFrom.toNumber() * 1000).toISOString()})`
      );
      console.log(
        `      Valid until: ${signer.validUntil.toString()} (${new Date(signer.validUntil.toNumber() * 1000).toISOString()})`
      );
    }
  );

  console.log("TEE Signers\n");
  saAccount.authorizationModel.signers[0].solanaKeySigners.forEach(
    (signer: any, index: number) => {
      console.log(
        `  ${index}: ${new anchor.web3.PublicKey(signer.pubkey).toBase58()}`
      );
      console.log(
        `      Valid from: ${signer.validFrom.toString()} (${new Date(signer.validFrom.toNumber() * 1000).toISOString()})`
      );
      console.log(
        `      Valid until: ${signer.validUntil.toString()} (${new Date(signer.validUntil.toNumber() * 1000).toISOString()})`
      );
    }
  );

  console.log("================================\n");
}

/**
 * Main function to update smart account configuration
 */
async function updateSmartAccountConfig() {
  // 1. Load required environment variables
  const saId = process.env.SA_ID;

  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  console.log(`Smart Account ID: ${saId}`);
  // 2. Setup programs and provider
  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // 3. Load keys
  const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
  const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");
  const payerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

  if (r1KeyInfo.type !== "r1") {
    throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
  }
  if (mandatorySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY");
  }
  if (payerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }

  let [webauthnTable] = deriveWebAuthnTableAddress(0);

  // Parse SA_ID as hex string if it's a hex string, otherwise treat as regular string
  let idBuffer: Buffer;
  if (saId.length === 64 && /^[0-9a-fA-F]+$/.test(saId)) {
    // 64-character hex string (32 bytes)
    idBuffer = Buffer.from(saId, "hex");
  } else {
    // Regular string
    idBuffer = generateIdFromString(saId);
  }
  const smartAccountHelper = SmartAccountHelper.createWithEnvKeys(
    idBuffer,
    saProgram,
    r1KeyInfo.keyObject,
    mandatorySignerInfo.keyObject
  );

  console.log(`Smart Account: ${smartAccountHelper.sa.toBase58()}`);
  console.log(`Smart Account Vault: ${smartAccountHelper.vault.toBase58()}`);

  // 5. Create the appropriate transaction based on update type
  let tx = new Transaction();

  switch (CONFIG.updateType) {
    case "add-recovery-signer":
      console.log(`New recovery signer: ${CONFIG.addRecoverySigner.signer}`);
      const recoverySignerPubkey = new PublicKey(
        CONFIG.addRecoverySigner.signer
      );
      tx = await saProgram.methods
        .addRecoverySigner(recoverySignerPubkey)
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    case "remove-recovery-signer":
      console.log(`New recovery signer: ${CONFIG.removeRecoverySigner.signer}`);
      const removeRecoverySigner = new PublicKey(
        CONFIG.removeRecoverySigner.signer
      );
      tx = await saProgram.methods
        .removeRecoverySigner(removeRecoverySigner)
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    case "add-passkey":
      const passkey = {
        pubkey: Array.from(
          Buffer.from(CONFIG.addPasskey.passkeyPubkey, "base64")
        ),
        validFrom: new anchor.BN(CONFIG.addPasskey.validFrom),
        validUntil: new anchor.BN(CONFIG.addPasskey.validUntil),
      };

      tx = await saProgram.methods
        .addSigner({ passkey: [passkey] })
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    case "remove-passkey":
      console.log(
        `Removing passkey: ${CONFIG.removePasskey.passkeyPubkey.substring(0, 20)}...`
      );
      const passkeyToRemove = Array.from(
        Buffer.from(CONFIG.removePasskey.passkeyPubkey, "base64")
      );
      tx = await saProgram.methods
        .removeSigner({ passkey: [passkeyToRemove] })
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    case "add-solana-key":
      const solanaKey = {
        pubkey: CONFIG.addSolanaKey.teeKeyPubkey,
        validFrom: new anchor.BN(CONFIG.addSolanaKey.validFrom),
        validUntil: new anchor.BN(CONFIG.addSolanaKey.validUntil),
      };
      tx = await saProgram.methods
        .addSigner({ solanaKey: [solanaKey] })
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    case "remove-solana-key":
      tx = await saProgram.methods
        .removeSigner({ solanaKey: [CONFIG.removeSolanaKey.teeKeyPubkey] })
        .accountsPartial({
          smartAccount: smartAccountHelper.sa,
          smartAccountVault: smartAccountHelper.vault,
        })
        .transaction();
      break;

    default:
      throw new Error(`Unsupported update type: ${CONFIG.updateType}`);
  }

  // 6. Get current state for verification
  const saAccountBefore = await saProgram.account.smartAccount.fetch(
    smartAccountHelper.sa
  );
  const nonceBefore = saAccountBefore.nonce;

  logSmartAccountState(saAccountBefore, "SMART ACCOUNT STATE BEFORE");

  // 7. Simulate and optimize (if enabled)
  let optimization;
  if (USE_COMPUTE_BUDGET_OPTIMIZATION) {
    optimization = await simulateBatchExecution(
      saProgram,
      vaultProgram,
      provider,
      smartAccountHelper,
      tx,
      true // use compute budget
    );
  }

  // 8. Create compute budget instructions if optimization is available
  let computeBudgetInstructions: anchor.web3.TransactionInstruction[] = [];
  if (optimization) {
    const computeBudgetIx =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: optimization.optimalComputeUnits,
      });
    const computePriceIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice(
      {
        microLamports: 1000,
      }
    );
    computeBudgetInstructions = [computeBudgetIx, computePriceIx];
  }

  const executionFee = 0;

  // 9. Prepare user intent (including compute budget instructions in signature hash)
  const {
    serializedIntent,
    deconstructedInstructions,
    remainingAccounts,
    numSigners,
  } = await smartAccountHelper.prepareUserIntent(tx, {
    tokenAmount: executionFee,
  });

  // 10. Sign intent with R1 key (now includes compute budget instructions in hash)
  const [message, signature, authData] = smartAccountHelper.signIntent(
    Uint8Array.from(serializedIntent)
  );

  console.log("Executing intent...");

  try {
    // Use the same compute budget instructions that were included in the signature
    const preInstructions: anchor.web3.TransactionInstruction[] = [
      ...computeBudgetInstructions,
    ];

    const executeTx = await saProgram.methods
      .validateExecution(
        {
          clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
          authData: WebAuthnAuthDataHelpers.Index(0),
        } as any,
        new anchor.BN(executionFee),
        null
      )
      .accountsPartial({
        txPayer: payerInfo.keyObject.publicKey,
        solanaSigner: null,
        smartAccount: smartAccountHelper.sa,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        vaultProgram: vaultProgram.programId,
        vaultState: smartAccountHelper.vaultState,
        smartAccountVault: smartAccountHelper.vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        webauthnTable: webauthnTable,
        vaultTokenAccount: null,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
      })
      .preInstructions(preInstructions)
      .postInstructions([
        createSecp256r1Instruction(
          message,
          smartAccountHelper.getPasskeyPubkey(),
          signature
        ),
        await vaultProgram.methods
          .executeBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: smartAccountHelper.vaultState,
            smartAccountVault: smartAccountHelper.vault,
          })
          .remainingAccounts(remainingAccounts)
          .instruction(),
      ])
      .signers([payerInfo.keyObject])
      .transaction();

    // Set recent blockhash for serialization
    executeTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    executeTx.feePayer = payerInfo.keyObject.publicKey;
    // Sign the transaction before serializing for size measurement
    executeTx.sign(payerInfo.keyObject);

    // Log complete transaction data for backend team
    InstructionLogger.logTransaction(
      `VALIDATE_EXECUTION_${CONFIG.updateType.toUpperCase().replace("-", "_")}`,
      {
        transaction: executeTx,
        instructionArgs: {
          signer_index: 0,
          update_type: CONFIG.updateType,
          update_details: (() => {
            switch (CONFIG.updateType) {
              case "add-recovery-signer":
                return {
                  new_recovery_signer: CONFIG.addRecoverySigner.signer,
                };
              case "remove-recovery-signer":
                return {
                  removed_recovery_signer: CONFIG.removeRecoverySigner.signer,
                };
              case "add-passkey":
                return {
                  passkey_pubkey: CONFIG.addPasskey.passkeyPubkey,
                  valid_from: CONFIG.addPasskey.validFrom,
                  valid_until: CONFIG.addPasskey.validUntil,
                };
              case "remove-passkey":
                return {
                  passkey_pubkey: CONFIG.removePasskey.passkeyPubkey,
                };
              default:
                return {};
            }
          })(),
          vault_execute_batch: {
            deconstructed_instructions: deconstructedInstructions,
            remaining_accounts: remainingAccounts.map((account) => ({
              address: account.pubkey.toBase58(),
              isSigner: account.isSigner,
              isWritable: account.isWritable,
            })),
            num_signers: numSigners,
            vault_state: smartAccountHelper.vaultState.toBase58(),
            smart_account_vault: smartAccountHelper.vault.toBase58(),
          },
          smart_account_state_before: {
            nonce: nonceBefore,
            recovery_signers: saAccountBefore.recoverySigners.map((signer) =>
              signer.toBase58()
            ),
            passkey_signers_count:
              saAccountBefore.authorizationModel.signers[0].passkeySigners
                .length,
            tee_signers_count:
              saAccountBefore.authorizationModel.signers[0].solanaKeySigners
                .length,
          },
          optimization: optimization
            ? {
                optimal_compute_units: optimization.optimalComputeUnits,
                actual_usage: optimization.actualUsage,
                efficiency: optimization.efficiency,
                transaction_size: optimization.transactionSize,
                estimated_fees: optimization.estimatedFees,
              }
            : null,
        },
        webauthnArgs: {
          origin: smartAccountHelper.ORIGIN,
          android_package_name: smartAccountHelper.ANDROID_PACKAGE_NAME,
          auth_data: Array.from(authData),
        },
        r1SignatureArgs: {
          message: message,
          pubkey: smartAccountHelper.getPasskeyPubkey(),
          signature: signature,
        },
        accounts: {
          tx_payer: {
            address: payerInfo.keyObject.publicKey.toBase58(),
            isSigner: true,
            isWritable: true,
            description: "Transaction fee payer",
          },
          smart_account: {
            address: smartAccountHelper.sa.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Smart account PDA (being updated)",
          },
          sysvar_instructions: {
            address: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "Sysvar instructions account",
          },
          vault_program: {
            address: vaultProgram.programId.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "Vault program ID",
          },
          vault_state: {
            address: smartAccountHelper.vaultState.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Vault state PDA",
          },
          smart_account_vault: {
            address: smartAccountHelper.vault.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Smart account vault PDA",
          },
          system_program: {
            address: anchor.web3.SystemProgram.programId.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "System program",
          },
        },
        signers: [
          {
            name: "tx_payer",
            publicKey: payerInfo.keyObject.publicKey.toBase58(),
          },
          {
            name: "mandatory_signer",
            publicKey: mandatorySignerInfo.keyObject.publicKey.toBase58(),
          },
        ],
        preInstructions: [
          {
            name: "secp256r1_signature_verification",
            data: {
              message: Array.from(message),
              pubkey: Array.from(smartAccountHelper.getPasskeyPubkey()),
              signature: Array.from(signature),
              program_id: "Secp256r1SigVerify1111111111111111111111111",
            },
          },
        ],
        metadata: {
          recentBlockhash: executeTx.recentBlockhash,
          feePayer: payerInfo.keyObject.publicKey.toBase58(),
        },
      },
      true
    ); // Export to JSON

    // Log transaction size
    const serializedTx = executeTx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    console.log(`Transaction size: ${serializedTx.length} bytes`);

    // Execute the transaction using raw connection (already signed)
    const txSignature = await provider.connection.sendRawTransaction(
      serializedTx,
      {
        skipPreflight: false,
        preflightCommitment: "processed",
      }
    );

    // Wait for confirmation
    await provider.connection.confirmTransaction(txSignature, "confirmed");

    console.log(`Transaction executed: ${txSignature}`);

    // 10. Verify the update was successful
    const saAccountAfter = await saProgram.account.smartAccount.fetch(
      smartAccountHelper.sa
    );

    logSmartAccountState(saAccountAfter, "SMART ACCOUNT STATE AFTER");
  } catch (error) {
    console.error("Transaction execution failed:");
    console.error("Error details:", error);

    // Try to parse Anchor errors
    if (error.logs) {
      console.error("Transaction logs:");
      error.logs.forEach((log: string, index: number) => {
        console.error(`  ${index}: ${log}`);
      });
    }

    // Re-throw to be caught by main error handler
    throw error;
  }
}

/**
 * Main execution function
 */
async function main() {
  try {
    await updateSmartAccountConfig();
  } catch (error) {
    console.error("Error updating smart account config:", error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main();
}
