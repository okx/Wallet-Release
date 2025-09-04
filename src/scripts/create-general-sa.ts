#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { loadEnv } from "../helpers/setup";
import { loadKeyFromEnv, displayKeyInfo } from "../helpers/key-loader";
import { InstructionLogger } from "../helpers/instruction-logger";
import { createSecp256r1Instruction } from "../tests/utils/r1-utils";
import { TestR1KeyHelper } from "../helpers/r1-test-helper";
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";
import {
  getConfigAccount,
  getVaultConfigAccount,
  getSmartAccount,
  getSmartAccountVault,
  getVaultState,
  generateIdFromString,
} from "../tests/utils/helpers";
import dotenv from "dotenv";
import { keccak_256 } from "@noble/hashes/sha3";

// TypeScript interfaces matching Rust structs exactly
interface Passkey {
  pubkey: number[]; // [u8; 32] - SECP_PUBKEY_SIZE
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

interface SolanaKey {
  pubkey: anchor.web3.PublicKey; // Pubkey
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

type SmartAccountType =
  | { payWallet: {} }
  | { easyWallet: {} }
  | { ceDeFiWallet: {} };

interface CreateGeneralAccountArgs {
  userPasskey: Passkey;
  initialSolanaSigner: SolanaKey | null; // Option<SolanaKey>
  initialRecoverySigner: anchor.web3.PublicKey; // Pubkey
  accountType: SmartAccountType;
  salt: number[]; // [u8; 32]
}

// Import utilities
import {
  simulateAccountCreation,
  OptimizationResult,
} from "./utils/simulation";
import { createComputeBudgetInstructions } from "./utils/instruction-serialization";
import { generateCreateAccountR1Signature } from "./utils/signature-generation";
import {
  WEBAUTHN_ORIGIN,
  WEBAUTHN_ANDROID_PACKAGE_NAME,
  PASSKEY_VALIDITY_PERIOD_SECONDS,
  VAULT_FUNDING_AMOUNT_SOL,
  createDummySecp256r1Instruction,
} from "./utils/constants";

// Load environment variables
dotenv.config();

// Configuration: Check if compute budget optimization should be used
const USE_COMPUTE_BUDGET_OPTIMIZATION =
  process.env.USE_COMPUTE_BUDGET_OPTIMIZATION !== "false"; // Defaults to true unless explicitly set to "false"

/**
 * Generate account ID by serializing args and hashing with keccak256
 * This replicates the Rust generate_id() function exactly
 *
 * Note: The Rust implementation now uses the entire struct serialization,
 * so this function should match the exact serialization order and format.
 */
function generateAccountId(args: CreateGeneralAccountArgs) {
  // Create a buffer with enough space for all data
  const chunks: Buffer[] = [];

  // Add user_passkey
  // pubkey (32 bytes)
  chunks.push(Buffer.from(args.userPasskey.pubkey));
  // validFrom (8 bytes, little endian)
  const validFromBuffer = Buffer.alloc(8);
  validFromBuffer.writeBigUInt64LE(
    BigInt(args.userPasskey.validFrom.toString())
  );
  chunks.push(validFromBuffer);
  // validUntil (8 bytes, little endian)
  const validUntilBuffer = Buffer.alloc(8);
  validUntilBuffer.writeBigUInt64LE(
    BigInt(args.userPasskey.validUntil.toString())
  );
  chunks.push(validUntilBuffer);

  // Add initial_solana_signer (Option<SolanaKey>)
  if (args.initialSolanaSigner) {
    chunks.push(Buffer.from([1])); // Some variant
    chunks.push(Buffer.from(args.initialSolanaSigner.pubkey.toBytes()));
    const signerValidFromBuffer = Buffer.alloc(8);
    signerValidFromBuffer.writeBigUInt64LE(
      BigInt(args.initialSolanaSigner.validFrom.toString())
    );
    chunks.push(signerValidFromBuffer);
    const signerValidUntilBuffer = Buffer.alloc(8);
    signerValidUntilBuffer.writeBigUInt64LE(
      BigInt(args.initialSolanaSigner.validUntil.toString())
    );
    chunks.push(signerValidUntilBuffer);
  } else {
    chunks.push(Buffer.from([0])); // None variant
  }

  // Add initial_recovery_signer (Pubkey - 32 bytes)
  chunks.push(Buffer.from(args.initialRecoverySigner.toBytes()));

  // Add account_type (1 byte for enum discriminant)
  // SmartAccountType: EasyWallet=0, CeDeFiWallet=1
  let accountTypeDiscriminant: number;
  if ("easyWallet" in args.accountType) {
    accountTypeDiscriminant = 1;
  } else if ("ceDeFiWallet" in args.accountType) {
    accountTypeDiscriminant = 2;
  } else {
    throw new Error("Invalid account type");
  }
  chunks.push(Buffer.from([accountTypeDiscriminant]));

  // Add salt (32 bytes)
  chunks.push(Buffer.from(args.salt));

  // Concatenate all chunks
  const serialized = Buffer.concat(chunks);

  // Hash with keccak256
  const hash = keccak_256(serialized);
  return Array.from(hash);
}

/**
 * Create a smart account using environment variables with optional compute budget optimization
 */
async function createSmartAccount() {
  // 1. Load required environment variables
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  console.log("🚀 Creating Smart Account...");
  console.log(`🆔 Smart Account ID: ${saId}`);
  console.log(
    `⚙️ Compute Budget Optimization: ${USE_COMPUTE_BUDGET_OPTIMIZATION ? "Enabled" : "Disabled"}`
  );

  // 2. Load programs and provider
  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // 3. Load and display keys using utility
  const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
  const creatorInfo = loadKeyFromEnv("WALLET_SECRET_KEY");
  const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");

  // 4. Type guards to ensure we have the correct key types
  if (r1KeyInfo.type !== "r1") {
    throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
  }
  if (mandatorySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY");
  }

  displayKeyInfo("Using environment R1 key for passkey", r1KeyInfo);
  displayKeyInfo("Creator/Wallet", creatorInfo);

  // 5. Wrap the raw R1 key for direct usage in this script
  const pemString = r1KeyInfo.keyObject.encodePrivateKey();
  const wrappedR1Key = new TestR1KeyHelper(pemString);

  // 7. Generate random email pointer (no longer needed in new structure)
  // const emailPtr = new Uint8Array(32);
  // crypto.getRandomValues(emailPtr);

  // 8. Set validity period (1 year from now)
  const now = Math.floor(Date.now() / 1000);
  const validFrom = new anchor.BN(now);
  const validUntil = new anchor.BN(now + PASSKEY_VALIDITY_PERIOD_SECONDS);

  // 9. Prepare account creation arguments first (needed for ID generation)
  // Use hardcoded zero salt (32 bytes)
  const salt = new Uint8Array(32); // All zeros by default

  const createPayAccountArgs = {
    userPasskey: {
      pubkey: wrappedR1Key.getPublicKeyArray(),
      validFrom,
      validUntil,
    },
    initialSolanaSigner: {
      pubkey: mandatorySignerInfo.keyObject.publicKey,
      validFrom,
      validUntil,
    },
    initialRecoverySigner: mandatorySignerInfo.keyObject.publicKey, //just a placeholder
    accountType: { easyWallet: {} },
    salt: Array.from(salt),
  };

  // 6. Generate ID from the args (replicating Rust generate_id())
  const id = generateAccountId(createPayAccountArgs);

  // 9. Calculate PDAs using helper functions with hashed ID
  const smartAccountPda = getSmartAccount(Array.from(id));
  const vaultPda = getSmartAccountVault(Array.from(id));
  const vaultStatePda = getVaultState(Array.from(id));
  const config = getConfigAccount();
  const vaultConfig = getVaultConfigAccount();

  console.log(`📍 Smart Account PDA: ${smartAccountPda.toBase58()}`);
  console.log(`🏦 Vault PDA: ${vaultPda.toBase58()}`);
  console.log(`📊 Vault State PDA: ${vaultStatePda.toBase58()}`);

  // 10. Get creator from environment
  const creator = creatorInfo.keyObject;

  // 11. Account creation arguments already prepared above

  let optimization: OptimizationResult | null = null;
  let computeBudgetInstructions: anchor.web3.TransactionInstruction[] = [];
  let fees = { totalFeeSOL: 0 }; // Default fees

  // 14. Fund the vault now that simulation has completed successfully
  console.log("📝 Funding vault...");
  const transferAmount =
    VAULT_FUNDING_AMOUNT_SOL * anchor.web3.LAMPORTS_PER_SOL;
  const transferInstruction = anchor.web3.SystemProgram.transfer({
    fromPubkey: creator.publicKey,
    toPubkey: vaultPda,
    lamports: transferAmount,
  });

  const fundingTx = new anchor.web3.Transaction().add(transferInstruction);
  const fundingTxSignature = await provider.sendAndConfirm(fundingTx, [
    creator,
  ]);
  console.log(
    `💰 Vault funded with ${VAULT_FUNDING_AMOUNT_SOL} SOL: ${fundingTxSignature}`
  );

  // 12. Conditionally simulate and optimize compute budget
  if (USE_COMPUTE_BUDGET_OPTIMIZATION) {
    // Create dummy data for simulation (will be skipped in simulation mode)
    const dummyMessage = Buffer.alloc(32, 0); // Dummy message for simulation
    const dummyAuthData = new Uint8Array(37); // Standard WebAuthn authData size

    optimization = await simulateAccountCreation(
      saProgram,
      vaultProgram,
      provider,
      createPayAccountArgs,
      dummyAuthData,
      dummyMessage,
      createDummySecp256r1Instruction(),
      wrappedR1Key,
      creator,
      smartAccountPda,
      vaultPda,
      vaultStatePda,
      config,
      vaultConfig,
      true // Use compute budget for simulation
    );

    // Create optimized compute budget instructions
    computeBudgetInstructions = createComputeBudgetInstructions(
      optimization.optimalComputeUnits
    );
  } else {
    console.log(
      "\n⚠️ Compute budget optimization disabled - using default limits"
    );
  }

  // 13. Generate signature with or without compute budget
  const { message, authData, signature } = generateCreateAccountR1Signature(
    saProgram,
    createPayAccountArgs,
    smartAccountPda,
    vaultPda,
    vaultStatePda,
    computeBudgetInstructions, // Will be empty array if optimization disabled
    wrappedR1Key
  );
  // 15. Create and send smart account creation transaction
  console.log("\n📝 Building final smart account creation transaction...");

  const tx = await saProgram.methods
    .createGeneralAccount(createPayAccountArgs, new anchor.BN(0), null, null)
    .accountsPartial({
      txPayer: creator.publicKey,
      vaultProgram: vaultProgram.programId,
      vaultConfig,
      smartAccount: smartAccountPda,
      smartAccountVault: vaultPda,
      vaultState: vaultStatePda,
      vaultTokenAccount: null,
      destinationTokenAccount: null,
      tokenMint: null,
      tokenProgram: null,
      webauthnTable: null,
    })
    .preInstructions([
      ...computeBudgetInstructions,
      createSecp256r1Instruction(
        message,
        Buffer.from(wrappedR1Key.getPublicKeyArray()),
        signature
      ),
    ])
    .signers([creator])
    .transaction();

  // Set recent blockhash for serialization
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = creator.publicKey;

  // Sign the transaction with all instructions (including compute budget)
  tx.sign(creator);

  // Log complete transaction data for backend team (after signing)
  InstructionLogger.logTransaction(
    "CREATE_ACCOUNT",
    {
      transaction: tx,
      instructionArgs: {
        user_passkey: {
          pubkey: createPayAccountArgs.userPasskey.pubkey,
          valid_from: createPayAccountArgs.userPasskey.validFrom,
          valid_until: createPayAccountArgs.userPasskey.validUntil,
        },
        initial_solana_signer: createPayAccountArgs.initialSolanaSigner,
        initial_recovery_signer: createPayAccountArgs.initialRecoverySigner,
        account_type: createPayAccountArgs.accountType,
      },
      webauthnArgs: {
        origin: WEBAUTHN_ORIGIN,
        android_package_name: WEBAUTHN_ANDROID_PACKAGE_NAME,
        auth_data: Array.from(authData),
      },
      r1SignatureArgs: {
        message: message,
        pubkey: Buffer.from(wrappedR1Key.getPublicKeyArray()),
        signature: signature,
      },
      accounts: {
        tx_payer: {
          address: creator.publicKey.toBase58(),
          isSigner: true,
          isWritable: true,
          description: "Transaction fee payer and creator",
        },
        creator: {
          address: creator.publicKey.toBase58(),
          isSigner: true,
          isWritable: false,
          description: "Smart account creator (from config)",
        },
        vault_program: {
          address: vaultProgram.programId.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "Vault program ID",
        },
        config: {
          address: config.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "Global configuration account",
        },
        vault_config: {
          address: vaultConfig.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "Vault configuration account",
        },
        smart_account: {
          address: smartAccountPda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Smart account PDA (to be created)",
        },
        smart_account_vault: {
          address: vaultPda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Smart account vault PDA",
        },
        vault_state: {
          address: vaultStatePda.toBase58(),
          isSigner: false,
          isWritable: true,
          description: "Vault state PDA",
        },
        system_program: {
          address: anchor.web3.SystemProgram.programId.toBase58(),
          isSigner: false,
          isWritable: false,
          description: "System program for account creation",
        },
      },
      signers: [
        {
          name: "creator",
          publicKey: creator.publicKey.toBase58(),
        },
      ],
      preInstructions: [
        {
          name: "compute_budget_limit",
          data: {
            units: optimization?.optimalComputeUnits || 0, // Use optional chaining
          },
        },
        {
          name: "compute_budget_price",
          data: {
            microLamports: 1000,
          },
        },
        {
          name: "secp256r1_signature_verification",
          data: {
            message: Array.from(message),
            pubkey: Array.from(wrappedR1Key.getPublicKeyArray()),
            signature: Array.from(signature),
            program_id: "Secp256r1SigVerify1111111111111111111111111",
          },
        },
      ],
      metadata: {
        recentBlockhash: tx.recentBlockhash,
        feePayer: creator.publicKey.toBase58(),
      },
    },
    true
  ); // Export to JSON

  // Log transaction size (after signing)
  const serializedTx = tx.serialize({
    requireAllSignatures: true,
    verifySignatures: true,
  });
  console.log(`Transaction size: ${serializedTx.length} bytes`);

  // Execute the transaction using raw connection (already signed)
  const res = await provider.connection.sendRawTransaction(serializedTx, {
    skipPreflight: false,
    preflightCommitment: "processed",
  });

  console.log(`✅ Transaction sent: ${res}`);

  // 16. Display results
  console.log("\n📋 Smart Account Details:");
  console.log(`   ID: ${id}`);
  console.log(`   Address: ${smartAccountPda.toBase58()}`);
  console.log(`   Vault: ${vaultPda.toBase58()}`);
  console.log(`   Vault State: ${vaultStatePda.toBase58()}`);
  console.log(`   R1 Public Key: ${r1KeyInfo.publicKeyHex}`);

  console.log(`   Transaction Size: ${serializedTx.length} bytes`);

  // Update .env file with the generated account ID
  updateEnvFile(id);

  return {
    transaction: tx,
    smartAccount: smartAccountPda.toBase58(),
    vault: vaultPda.toBase58(),
    vaultState: vaultStatePda.toBase58(),
    r1PublicKey: r1KeyInfo.publicKeyHex,
    optimization,
  };
}

/**
 * Update the .env file with the generated account ID
 */
function updateEnvFile(accountId: number[]): void {
  try {
    const envPath = path.join(process.cwd(), ".env");
    const envContent = fs.readFileSync(envPath, "utf8");

    // Convert account ID to hex string for better readability
    const accountIdHex = Buffer.from(accountId).toString("hex");

    // Check if SA_ID already exists in .env
    if (envContent.includes("SA_ID=")) {
      // Update existing SA_ID
      const updatedContent = envContent.replace(
        /SA_ID=.*/,
        `SA_ID="${accountIdHex}"`
      );
      fs.writeFileSync(envPath, updatedContent);
      console.log(`📝 Updated .env: SA_ID="${accountIdHex}"`);
    } else {
      // Add new SA_ID if it doesn't exist
      const updatedContent = envContent + `\nSA_ID="${accountIdHex}"\n`;
      fs.writeFileSync(envPath, updatedContent);
      console.log(`📝 Added to .env: SA_ID="${accountIdHex}"`);
    }
  } catch (error) {
    console.warn(`⚠️ Could not update .env file: ${error}`);
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await createSmartAccount();
    console.log("\n🎊 Success! Your smart account is ready to use.");
  } catch (error: any) {
    console.error(`❌ Error creating smart account:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
