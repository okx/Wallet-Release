#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import dotenv from "dotenv";
import { loadEnv } from "../helpers/setup";
import { displayKeyInfo, loadKeyFromEnv } from "../helpers/key-loader";
import { InstructionLogger } from "../helpers/instruction-logger";
import {
  deriveWebAuthnTableAddress,
  generateIdFromString,
  getConfigAccount,
  getSmartAccount,
  getSmartAccountVault,
  getVaultConfigAccount,
  getVaultState,
} from "../tests/utils/helpers";
import { TestR1KeyHelper } from "../helpers/r1-test-helper";
import { SmartAccountHelper } from "../tests/utils/smartAccount/helpers";
import { createSecp256r1Instruction } from "../tests/utils/r1-utils";
import { simulateMigration } from "./utils/simulation";
import { createComputeBudgetInstructions } from "./utils/instruction-serialization";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../tests/utils/webauthn";

// Load environment variables
dotenv.config();

// Configuration: Check if compute budget optimization should be used
const USE_COMPUTE_BUDGET_OPTIMIZATION =
  process.env.USE_COMPUTE_BUDGET_OPTIMIZATION !== "false"; // Defaults to true unless explicitly set to "false"

async function migrateSmartAccount() {
  // 1. Load required environment variables
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  console.log("🚀 Migrating Smart Account...");
  console.log(`🆔 Smart Account ID: ${saId}`);
  console.log(
    `⚙️ Compute Budget Optimization: ${USE_COMPUTE_BUDGET_OPTIMIZATION ? "Enabled" : "Disabled"}`
  );

  // 2. Load programs and provider
  const { saProgram, vaultProgram, upgradeMockProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // 3. Load and display keys using utility
  const adminInfo = loadKeyFromEnv("ADMIN_SECRET_KEY");
  const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
  const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");
  const walletInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

  // 4. Type guards to ensure we have the correct key types
  if (r1KeyInfo.type !== "r1") {
    throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
  }
  if (mandatorySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY");
  }
  if (walletInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }
  if (adminInfo.type !== "solana") {
    throw new Error("Expected Solana key type for ADMIN_SECRET_KEY");
  }

  displayKeyInfo("Admin", adminInfo);
  displayKeyInfo("Wallet", walletInfo);
  displayKeyInfo("Mandatory Signer", mandatorySignerInfo);
  displayKeyInfo("R1 Key", r1KeyInfo);

  // 5. Create smart account helper - SmartAccountHelper will wrap the raw key internally
  const id = generateIdFromString(saId);
  const smartAccountHelper = SmartAccountHelper.createWithEnvKeys(
    Buffer.from(id), // Pass the generated ID as Buffer
    saProgram,
    r1KeyInfo.keyObject, // Raw key from key-loader will be wrapped internally
    mandatorySignerInfo.keyObject // Mandatory signer
  );

  // 6. Calculate PDAs using helper functions with hashed ID
  const smartAccountPda = getSmartAccount(Array.from(id));
  const smartAccountV2 = getSmartAccount(
    Array.from(id),
    upgradeMockProgram.programId
  );
  const vaultPda = getSmartAccountVault(Array.from(id));
  const vaultStatePda = getVaultState(Array.from(id));
  const config = getConfigAccount();
  const vaultConfig = getVaultConfigAccount();

  const [webauthnTable] = deriveWebAuthnTableAddress(0);

  console.log(smartAccountPda);

  // 7. Add upgrade-mock program as authorized program in vault config
  console.log(
    "📝 Adding upgrade-mock program as authorized program in vault config..."
  );

  await vaultProgram.methods
    .addAuthorizedProgram(upgradeMockProgram.programId)
    .accountsPartial({
      admin: adminInfo.keyObject.publicKey,
      config: vaultConfig,
    })
    .signers([adminInfo.keyObject])
    .rpc();

  console.log(
    "✅ Upgrade-mock program added as authorized program in vault config"
  );

  // 8. Create migration instruction
  console.log("📝 Building migration instruction...");

  const migrationInstruction = await upgradeMockProgram.methods
    .migrateSmartAccountV1()
    .accountsPartial({
      payer: walletInfo.keyObject.publicKey,
      smartAccountV1: smartAccountPda,
      smartAccountV2: smartAccountV2,
      smartAccountVault: vaultPda,
      vaultState: vaultStatePda,
    })
    .instruction();

  // 9. Simulate and optimize compute budget if enabled
  let optimization = null;
  let computeBudgetInstructions = [];

  if (USE_COMPUTE_BUDGET_OPTIMIZATION) {
    console.log("\n🔄 Running simulation to optimize compute budget...");

    try {
      optimization = await simulateMigration(
        saProgram,
        vaultProgram,
        provider,
        smartAccountHelper,
        migrationInstruction,
        true // Use compute budget for simulation
      );

      console.log(
        `✅ Simulation completed - Optimal compute units: ${optimization.optimalComputeUnits}`
      );
      console.log(
        `   📊 Actual usage: ${optimization.actualUsage} (${optimization.efficiency.toFixed(2)}% efficiency)`
      );
      console.log(
        `   📏 Transaction size: ${optimization.transactionSize} bytes`
      );
      console.log(
        `   💰 Estimated fees: ${optimization.estimatedFees.totalFeeSOL.toFixed(8)} SOL`
      );

      // Create optimized compute budget instructions
      computeBudgetInstructions = createComputeBudgetInstructions(
        optimization.optimalComputeUnits
      );
    } catch (error) {
      console.log(
        `⚠️ Simulation failed, continuing with default compute budget: ${error.message}`
      );
    }
  } else {
    console.log(
      "\n⚠️ Compute budget optimization disabled - using default limits"
    );
  }

  // 10. Prepare the final migration transaction
  console.log("\n📝 Building final migration transaction...");

  const serializedIntent = await smartAccountHelper.prepareMigrationIntent(
    migrationInstruction,
    0, // No token amount for migration
    undefined
  );
  const [message, signature, authData] = smartAccountHelper.signIntent(
    Uint8Array.from(serializedIntent)
  );

  // 11. Execute the migration transaction
  const tx = await saProgram.methods
    .closeAndMigrate(
      migrationInstruction.data,
      new anchor.BN(0),
      {
        clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
        authData: WebAuthnAuthDataHelpers.Index(0),
      } as any,
      null
    )
    .accountsPartial({
      payer: walletInfo.keyObject.publicKey,
      solanaSigner: mandatorySignerInfo.keyObject.publicKey,
      smartAccount: smartAccountPda,
      vaultProgram: vaultProgram.programId,
      vaultConfig: vaultConfig,
      smartAccountVault: vaultPda,
      vaultState: vaultStatePda,
      newDelegatedProgram: upgradeMockProgram.programId,
      webauthnTable: webauthnTable,
      tokenMint: null,
      destinationTokenAccount: null,
      tokenProgram: null,
      vaultTokenAccount: null,
    })
    .remainingAccounts(
      migrationInstruction.keys.map((account) => ({
        ...account,
        isSigner: account.pubkey.equals(smartAccountPda)
          ? false
          : account.isSigner,
      }))
    )
    .preInstructions([
      ...computeBudgetInstructions,
      createSecp256r1Instruction(
        message,
        smartAccountHelper.getPasskeyPubkey(),
        signature
      ),
    ])
    .signers([walletInfo.keyObject, mandatorySignerInfo.keyObject])
    .transaction();

  // Set recent blockhash for serialization
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = walletInfo.keyObject.publicKey;

  // Sign the transaction with all instructions (including compute budget)
  tx.sign(walletInfo.keyObject, mandatorySignerInfo.keyObject);

  // Log complete transaction data for backend team (after signing)
  InstructionLogger.logTransaction(
    "MIGRATE_SMART_ACCOUNT",
    {
      transaction: tx,
      instructionArgs: {
        migration_instruction_data: Array.from(migrationInstruction.data),
        signer_index: 0,
        new_delegated_program: upgradeMockProgram.programId.toBase58(),
        smart_account_v1: smartAccountPda.toBase58(),
        smart_account_v2: smartAccountV2.toBase58(),
        smart_account_vault: vaultPda.toBase58(),
        vault_state: vaultStatePda.toBase58(),
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
        payer: {
          address: walletInfo.keyObject.publicKey.toBase58(),
          isSigner: true,
          isWritable: true,
          description: "Transaction fee payer",
        },
        solanaSigner: {
          address: mandatorySignerInfo.keyObject.publicKey.toBase58(),
          isSigner: true,
          isWritable: false,
          description: "Mandatory signer for smart account",
        },
        smartAccount: {
          address: smartAccountPda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Smart account PDA to close",
        },
        vaultProgram: {
          address: vaultProgram.programId.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "Vault program",
        },
        vaultConfig: {
          address: vaultConfig.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "Vault configuration",
        },
        smartAccountVault: {
          address: vaultPda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Smart account vault PDA",
        },
        vaultState: {
          address: vaultStatePda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Vault state account",
        },
        newDelegatedProgram: {
          address: upgradeMockProgram.programId.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "New delegated program for migration",
        },
      },
      signers: [
        {
          name: "Transaction Payer",
          publicKey: walletInfo.keyObject.publicKey.toBase58(),
        },
        {
          name: "Mandatory Signer",
          publicKey: mandatorySignerInfo.keyObject.publicKey.toBase58(),
        },
      ],
      preInstructions: [
        ...(optimization
          ? [
              {
                name: "ComputeBudgetProgram.setComputeUnitLimit",
                data: {
                  units: optimization.optimalComputeUnits,
                },
              },
              {
                name: "ComputeBudgetProgram.setComputeUnitPrice",
                data: {
                  microLamports: 1000,
                },
              },
            ]
          : []),
        {
          name: "Secp256r1Program.verify",
          data: {
            message: message,
            pubkey: smartAccountHelper.getPasskeyPubkey(),
            signature: signature,
          },
        },
      ],
      metadata: {
        recentBlockhash: tx.recentBlockhash,
        feePayer: walletInfo.keyObject.publicKey.toBase58(),
        computeUnits: optimization?.optimalComputeUnits,
        priorityFee: optimization ? 1000 : undefined,
      },
    },
    true // export JSON for debugging
  );

  // Log transaction size
  const serializedTx = tx.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });
  console.log(`📏 Final transaction size: ${serializedTx.length} bytes`);

  // Execute the transaction using raw connection (already signed)
  const txSignature = await provider.connection.sendRawTransaction(
    serializedTx,
    {
      skipPreflight: false,
      preflightCommitment: "processed",
    }
  );

  console.log(`✅ Migration transaction sent: ${txSignature}`);

  // Wait for confirmation
  await provider.connection.confirmTransaction(txSignature, "confirmed");

  return {
    txSignature,
    optimization,
    smartAccountPda: smartAccountPda.toBase58(),
    smartAccountV2: smartAccountV2.toBase58(),
    vaultPda: vaultPda.toBase58(),
    vaultStatePda: vaultStatePda.toBase58(),
  };
}

async function main() {
  try {
    const result = await migrateSmartAccount();
    console.log("\n🎊 Success! Smart Account migrated.");
  } catch (error: any) {
    console.error(`❌ Error migrating smart account:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
