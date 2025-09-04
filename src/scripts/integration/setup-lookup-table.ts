#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";
import dotenv from "dotenv";
import { loadEnv } from "../../helpers/setup";
import { loadKeyFromEnv } from "../../helpers/key-loader";
import { SmartAccountHelper } from "../../tests/utils/smartAccount/helpers";
import { generateIdFromString } from "../../tests/utils/helpers";
import {
  USDC_MINT,
  WSOL_MINT,
  JITOSOL_MINT,
  BSOL_MINT,
  RAY_MINT,
  VAULT_PROGRAM_ID,
  SMART_ACCOUNT_SOLANA_PROGRAM_ID,
  RAYDIUM_CPMM_PROGRAM_ID,
  WEB_AUTHN_TABLE_SEED,
  USDT_MINT,
} from "../../tests/utils/consts";
import { PublicKey } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

// Load environment variables
dotenv.config();

async function setupLookupTable() {
  console.log("🔧 Setting up Lookup Table...");

  // Load environment
  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const payerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

  if (payerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }

  // Load smart account helper to get PDAs
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
  const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");

  if (r1KeyInfo.type !== "r1") {
    throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
  }
  if (mandatorySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY");
  }

  const id = saId;
  // Parse SA_ID as hex string if it's a hex string, otherwise treat as regular string
  let idBuffer: Buffer;
  if (id.length === 64 && /^[0-9a-fA-F]+$/.test(id)) {
    // 64-character hex string (32 bytes)
    idBuffer = Buffer.from(id, "hex");
  } else {
    // Regular string
    idBuffer = generateIdFromString(id);
  }
  const smartAccountHelper = SmartAccountHelper.createWithEnvKeys(
    idBuffer,
    saProgram,
    r1KeyInfo.keyObject,
    mandatorySignerInfo.keyObject
  );

  const currentSlot = await provider.connection.getSlot();

  let webauthnTable = PublicKey.findProgramAddressSync(
    [Buffer.from(WEB_AUTHN_TABLE_SEED), Buffer.from([0])],
    saProgram.programId
  )[0];

  // Define accounts to include in lookup table
  const compressedAccounts = [
    // Common program accounts
    VAULT_PROGRAM_ID,
    SMART_ACCOUNT_SOLANA_PROGRAM_ID,
    anchor.web3.SystemProgram.programId,
    anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
    webauthnTable, // for webauthn table compression

    // Token mints
    USDC_MINT,
    WSOL_MINT,
    USDT_MINT,

    TOKEN_2022_PROGRAM_ID,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,

    //protocols
    new PublicKey("6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma"), //okx dex aggregator
    RAYDIUM_CPMM_PROGRAM_ID, //for earn TEE
  ];

  console.log(
    `📝 Creating lookup table with ${compressedAccounts.length} accounts...`
  );

  // Create lookup table
  const [lookupTableInstruction, lookupTableAddress] =
    anchor.web3.AddressLookupTableProgram.createLookupTable({
      authority: payerInfo.keyObject.publicKey,
      payer: payerInfo.keyObject.publicKey,
      recentSlot: currentSlot,
    });

  console.log(`🏗️  Lookup table address: ${lookupTableAddress.toBase58()}`);

  // Create LUT transaction
  const createTx = new anchor.web3.Transaction().add(lookupTableInstruction);
  const createSignature = await provider.sendAndConfirm(createTx, [
    payerInfo.keyObject,
  ]);
  console.log(`✅ Lookup table created: ${createSignature}`);

  // Extend lookup table with accounts
  const extendInstruction =
    anchor.web3.AddressLookupTableProgram.extendLookupTable({
      payer: payerInfo.keyObject.publicKey,
      authority: payerInfo.keyObject.publicKey,
      lookupTable: lookupTableAddress,
      addresses: compressedAccounts,
    });

  const extendTx = new anchor.web3.Transaction().add(extendInstruction);
  const extendSignature = await provider.sendAndConfirm(extendTx, [
    payerInfo.keyObject,
  ]);
  console.log(`✅ Lookup table extended: ${extendSignature}`);

  // Wait for activation (for development, we'll wait a bit)
  console.log("⏳ Waiting for lookup table activation...");
  let attempts = 0;
  const maxAttempts = 10;

  while (attempts < maxAttempts) {
    try {
      const lutAccount =
        await provider.connection.getAddressLookupTable(lookupTableAddress);
      if (lutAccount.value && "active" in lutAccount.value.state) {
        console.log("✅ Lookup table is now active!");
        break;
      }
    } catch (error) {
      // Ignore errors during activation wait
    }

    console.log(`⏳ Waiting... (${attempts + 1}/${maxAttempts})`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    attempts++;
  }

  // Update .env file - always overwrite
  const envPath = path.join(process.cwd(), ".env");
  let envContent = fs.readFileSync(envPath, "utf8");

  // Remove existing LOOKUP_TABLE_ADDRESS if it exists
  envContent = envContent.replace(/LOOKUP_TABLE_ADDRESS=.*\n?/g, "");

  // Add new LOOKUP_TABLE_ADDRESS
  envContent += `\nLOOKUP_TABLE_ADDRESS=${lookupTableAddress.toBase58()}\n`;

  fs.writeFileSync(envPath, envContent);

  console.log("💾 Lookup table address saved to .env file");
  console.log(
    `🎉 Lookup table setup complete: ${lookupTableAddress.toBase58()}`
  );
  console.log(
    `📋 Included ${compressedAccounts.length} accounts in lookup table`
  );
}

setupLookupTable().catch((error) => {
  console.error("❌ Lookup table setup failed:", error);
  process.exit(1);
});
