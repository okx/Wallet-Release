#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SmartAccountSolana } from "../target/types/smart_account_solana";
import {
  CONFIG_SEED,
  VAULT_CONFIG_SEED,
  SMART_ACCOUNT_SOLANA_PROGRAM_ID,
  ZK_EMAIL_VERIFIER_PROGRAM_ID,
  ORIGIN,
  PRE_JSON,
  POST_JSON,
} from "../tests/utils/consts";
import { loadEnv } from "../helpers/setup";
import { loadKeyFromEnv, displayKeyInfo } from "../helpers/key-loader";
import dotenv from "dotenv";
import { BN } from "@coral-xyz/anchor";
import { deriveWebAuthnTableAddress } from "../tests/utils/helpers";
import { buildAuthData } from "../tests/utils/webauthn";

// Load environment variables
dotenv.config();

async function initializeConfigs() {
  console.log("🚀 Initializing Smart Account and Vault configs...");

  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // Load keys from environment
  const adminInfo = loadKeyFromEnv("ADMIN_SECRET_KEY");
  const creatorInfo = loadKeyFromEnv("WALLET_SECRET_KEY");
  const recoverySignerInfo = loadKeyFromEnv("RECOVERY_SIGNER_SECRET_KEY");

  if (adminInfo.type !== "solana") {
    throw new Error("Expected Solana key type for ADMIN_SECRET_KEY");
  }
  if (creatorInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }
  if (recoverySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for RECOVERY_SIGNER_SECRET_KEY");
  }

  // Calculate PDAs
  const configPda = PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    saProgram.programId
  )[0];

  const vaultConfigPda = PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED)],
    vaultProgram.programId
  )[0];

  const [webauthnTablePda] = deriveWebAuthnTableAddress(0);

  const saProgramData = PublicKey.findProgramAddressSync(
    [saProgram.programId.toBytes()],
    new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  )[0];

  const vaultProgramData = PublicKey.findProgramAddressSync(
    [vaultProgram.programId.toBytes()],
    new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  )[0];

  // Check if configs already exist
  const saConfigExists = await provider.connection.getAccountInfo(configPda);
  const vaultConfigExists =
    await provider.connection.getAccountInfo(vaultConfigPda);

  if (saConfigExists) {
    console.log(
      "\n⚠️  Smart Account config already exists, skipping initialization"
    );
  } else {
    console.log("\n🔧 Initializing Smart Account config...");

    const saInitTx = await saProgram.methods
      .initializeConfig({
        creator: creatorInfo.keyObject.publicKey,
        webauthnModerator: creatorInfo.keyObject.publicKey,
      })
      .accounts({
        admin: adminInfo.keyObject.publicKey,
        programData: saProgramData,
      })
      .signers([adminInfo.keyObject])
      .rpc();

    console.log(`   ✅ Smart Account config initialized: ${saInitTx}`);
  }

  if (vaultConfigExists) {
    console.log("\n⚠️  Vault config already exists, skipping initialization");
  } else {
    console.log("\n🔧 Initializing Vault config...");

    const vaultInitTx = await vaultProgram.methods
      .initializeConfig()
      .accounts({
        admin: adminInfo.keyObject.publicKey,
        programData: vaultProgramData,
      })
      .signers([adminInfo.keyObject])
      .rpc();

    console.log(`   ✅ Vault config initialized: ${vaultInitTx}`);
  }

  const vaultConfig =
    await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);
  if (
    vaultConfig.authorizedPrograms.some(
      (program) =>
        program.toBase58() === SMART_ACCOUNT_SOLANA_PROGRAM_ID.toBase58()
    )
  ) {
    console.log("   ⚠️  Smart Account program already authorized in Vault");
  } else {
    // Add Smart Account program as authorized program in Vault config
    console.log(
      "\n🔧 Adding Smart Account program as authorized program in Vault..."
    );
    try {
      const addAuthTx = await vaultProgram.methods
        .addAuthorizedProgram(SMART_ACCOUNT_SOLANA_PROGRAM_ID)
        .accounts({
          admin: adminInfo.keyObject.publicKey,
        })
        .signers([adminInfo.keyObject])
        .rpc();

      console.log(
        `   ✅ Smart Account program authorized in Vault: ${addAuthTx}`
      );
    } catch (error: any) {
      if (error.message.includes("Program already authorized")) {
        console.log("   ⚠️  Smart Account program already authorized in Vault");
      } else {
        throw error;
      }
    }
  }

  // Initialize WebAuthn table
  await initializeWebAuthnTable(
    saProgram,
    webauthnTablePda,
    creatorInfo.keyObject
  );

  // Verify the configurations
  console.log("\n🔍 Verifying configurations...");

  if (!saConfigExists) {
    const configAccount = await saProgram.account.config.fetch(configPda);
    console.log("\n📋 Smart Account Config Details:");
    console.log(`   Creator: ${configAccount.creator.toBase58()}`);
    console.log(`   Admin: ${configAccount.admin.toBase58()}`);
    console.log(
      `   Webauthn Moderator: ${configAccount.webauthnModerator.toBase58()}`
    );
  }

  if (!vaultConfigExists) {
    const vaultConfigAccount =
      await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);
    console.log("\n📋 Vault Config Details:");
    console.log(`   Admin: ${vaultConfigAccount.admin.toBase58()}`);
    console.log(
      `   Authorized Programs: ${vaultConfigAccount.authorizedPrograms.length}`
    );
    vaultConfigAccount.authorizedPrograms.forEach((program, index) => {
      console.log(`     ${index + 1}. ${program.toBase58()}`);
    });
  }

  console.log("\n🎊 Configuration initialization completed successfully!");
  console.log("\n📋 Summary:");
  console.log(`   Smart Account Program: ${saProgram.programId.toBase58()}`);
  console.log(`   Vault Program: ${vaultProgram.programId.toBase58()}`);
  console.log(`   Smart Account Config: ${configPda.toBase58()}`);
  console.log(`   Vault Config: ${vaultConfigPda.toBase58()}`);
  console.log(`   WebAuthn Table: ${webauthnTablePda.toBase58()}`);
  console.log(`   Admin: ${adminInfo.keyObject.publicKey.toBase58()}`);
  console.log(`   Creator: ${creatorInfo.keyObject.publicKey.toBase58()}`);
  console.log(
    `   Recovery Signer: ${recoverySignerInfo.keyObject.publicKey.toBase58()}`
  );
}

/**
 * Initialize the WebAuthn table with required entries
 */
async function initializeWebAuthnTable(
  saProgram: anchor.Program<SmartAccountSolana>,
  webauthnTablePda: PublicKey,
  webauthnModerator: anchor.web3.Keypair
) {
  console.log("\n🔧 Initializing WebAuthn table...");

  try {
    // Check if table already exists
    const provider = anchor.getProvider() as anchor.AnchorProvider;
    const tableExists =
      await provider.connection.getAccountInfo(webauthnTablePda);

    if (tableExists) {
      console.log(
        "   ⚠️  WebAuthn table already exists, skipping initialization"
      );
      return;
    }

    // Create the table
    console.log("   📋 Creating WebAuthn table...");
    await saProgram.methods
      .createWebauthnTable({ tableIndex: 0 })
      .accountsPartial({
        webauthnModerator: webauthnModerator.publicKey,
        webauthnTable: webauthnTablePda,
      })
      .signers([webauthnModerator])
      .rpc();

    console.log("   ✅ WebAuthn table created");

    // Add rpId entry
    console.log("   🔑 Adding preJson entry...");
    await saProgram.methods
      .addWebauthnTableEntry({
        entry: { preJson: [PRE_JSON] },
      })
      .accountsPartial({
        webauthnModerator: webauthnModerator.publicKey,
        webauthnTable: webauthnTablePda,
      })
      .signers([webauthnModerator])
      .rpc();

    // Add origin entry
    console.log("   🌐 Adding postJson entry...");
    await saProgram.methods
      .addWebauthnTableEntry({
        entry: { postJson: [POST_JSON] },
      })
      .accountsPartial({
        webauthnModerator: webauthnModerator.publicKey,
        webauthnTable: webauthnTablePda,
      })
      .signers([webauthnModerator])
      .rpc();

    // Add android package name entry
    console.log("   📱 Adding authData entry...");
    let authData = buildAuthData(ORIGIN);
    await saProgram.methods
      .addWebauthnTableEntry({
        entry: { authData: [authData] },
      } as any)
      .accountsPartial({
        webauthnModerator: webauthnModerator.publicKey,
        webauthnTable: webauthnTablePda,
      })
      .signers([webauthnModerator])
      .rpc();

    // Verify the table was created correctly
    const webauthnTableAccount =
      await saProgram.account.webauthnTable.fetch(webauthnTablePda);
    console.log("\n📋 WebAuthn Table Details:");
    console.log(`   Table Index: ${webauthnTableAccount.tableIndex}`);
    console.log(
      `   preJson entries: ${webauthnTableAccount.preJsonTable.length}`
    );
    console.log(
      `   postJson entries: ${webauthnTableAccount.postJsonTable.length}`
    );
    console.log(
      `   authData entries: ${webauthnTableAccount.authDataTable.length}`
    );
    console.log(`   preJson: ${webauthnTableAccount.preJsonTable[0]}`);
    console.log(`   postJson: ${webauthnTableAccount.postJsonTable[0]}`);
    console.log(`   authData: ${webauthnTableAccount.authDataTable[0]}`);

    console.log("   🎊 WebAuthn table initialization completed successfully!");
  } catch (error: any) {
    console.error(`❌ Error initializing WebAuthn table:`, error.message);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
    throw error;
  }
}

async function main() {
  try {
    await initializeConfigs();
  } catch (error: any) {
    console.error(`❌ Error initializing configs:`, error.message);
    if (error.logs) {
      console.error("Transaction logs:", error.logs);
    }
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
