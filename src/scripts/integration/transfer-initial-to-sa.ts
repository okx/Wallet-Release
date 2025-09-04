#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { LAMPORTS_PER_SOL, PublicKey, Transaction } from "@solana/web3.js";
import { loadEnv } from "../../helpers/setup";
import { loadKeyFromEnv, displayKeyInfo } from "../../helpers/key-loader";
import { SmartAccountHelper } from "../../tests/utils/smartAccount/helpers";
import { generateIdFromString } from "../../tests/utils/helpers";
import dotenv from "dotenv";
import {
  BSOL_MINT,
  JITOSOL_MINT,
  RAY_MINT,
  USDC_MINT,
  USDT_MINT,
  WSOL_MINT,
} from "../../tests/utils/consts";

// Load environment variables
dotenv.config();

interface TokenTransfer {
  mint: PublicKey;
  amount: number;
  decimals?: number;
  programId?: PublicKey; // TOKEN_PROGRAM_ID or TOKEN_2022_PROGRAM_ID
}

// Configure your token transfers here
const TOKEN_TRANSFERS: TokenTransfer[] = [
  {
    mint: USDC_MINT, // USDC
    amount: 100000000,
    decimals: 6, // USDC has 6 decimals
    programId: TOKEN_PROGRAM_ID,
  },
  {
    mint: USDT_MINT, // USDC
    amount: 100000000,
    decimals: 6, // USDC has 6 decimals
    programId: TOKEN_PROGRAM_ID,
  },
  {
    mint: WSOL_MINT, // SOL
    amount: 100000000,
    decimals: 9, // SOL has 9 decimals
    programId: TOKEN_PROGRAM_ID,
  },
  {
    mint: JITOSOL_MINT, // PYUSD
    amount: 100000000,
    decimals: 9,
    programId: TOKEN_PROGRAM_ID,
  },
  {
    mint: BSOL_MINT, // BSOL
    amount: 100000000,
    decimals: 9,
    programId: TOKEN_PROGRAM_ID,
  },
  {
    mint: RAY_MINT, // RAY
    amount: 100000000,
    decimals: 6,
    programId: TOKEN_PROGRAM_ID,
  },
];

const SOL_AMOUNT = 10;

/**
 * Transfer SOL to smart account vault
 */
async function transferSolToSA(
  smartAccountHelper: SmartAccountHelper,
  adminKeyInfo: any,
  provider: anchor.AnchorProvider,
  solAmount: number = 1
): Promise<void> {
  const lamports = solAmount * LAMPORTS_PER_SOL;

  const solTransferTx = new Transaction();
  const transferSolIx = anchor.web3.SystemProgram.transfer({
    fromPubkey: adminKeyInfo.keyObject.publicKey,
    toPubkey: smartAccountHelper.vault,
    lamports: lamports,
  });
  solTransferTx.add(transferSolIx);

  solTransferTx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  solTransferTx.feePayer = adminKeyInfo.keyObject.publicKey;

  solTransferTx.sign(adminKeyInfo.keyObject);

  const signature = await provider.connection.sendRawTransaction(
    solTransferTx.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  await provider.connection.confirmTransaction(signature, "confirmed");
}

/**
 * Transfer multiple tokens to smart account vault
 */
async function transferTokensAndSolToSa() {
  // 1. Load required environment variables
  const saId = process.env.SA_ID;
  const adminSecretKey = process.env.ADMIN_SECRET_KEY;

  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }
  if (!adminSecretKey) {
    throw new Error("ADMIN_SECRET_KEY environment variable is required");
  }

  console.log(`🎯 Smart Account ID: ${saId}`);

  // 3. Setup programs and provider
  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // 4. Load admin key
  const adminKeyInfo = loadKeyFromEnv("ADMIN_SECRET_KEY");
  if (adminKeyInfo.type !== "solana") {
    throw new Error("Expected Solana key type for ADMIN_SECRET_KEY");
  }

  displayKeyInfo("Admin", adminKeyInfo);

  // 5. Create smart account helper
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
    null, // No R1 key needed for admin transfers
    null // No mandatory signer needed for admin transfers
  );

  console.log(`📍 Smart Account: ${smartAccountHelper.sa.toBase58()}`);
  console.log(`🏦 Smart Account Vault: ${smartAccountHelper.vault.toBase58()}`);

  // 7. Process each token transfer
  for (const transfer of TOKEN_TRANSFERS) {
    console.log(`\n🔄 Processing transfer for token: ${transfer.mint}`);

    await processTokenTransfer(
      transfer,
      smartAccountHelper,
      adminKeyInfo,
      provider
    );
  }
  // 8. transfer sol to sa
  await transferSolToSA(smartAccountHelper, adminKeyInfo, provider, SOL_AMOUNT); // Transfer 10 SOL

  // Log final SOL balance
  const finalVaultBalance = await provider.connection.getBalance(
    smartAccountHelper.vault
  );
  console.log(`💰 Final vault SOL balance: ${finalVaultBalance / 1e9} SOL`);
}

/**
 * Process a single token transfer
 */
async function processTokenTransfer(
  transfer: TokenTransfer,
  smartAccountHelper: SmartAccountHelper,
  adminKeyInfo: any,
  provider: anchor.AnchorProvider
): Promise<void> {
  // Calculate actual transfer amount based on decimals
  const actualAmount = transfer.amount * Math.pow(10, transfer.decimals || 6);

  // Source: admin's token account
  const adminTokenAccount = getAssociatedTokenAddressSync(
    transfer.mint,
    adminKeyInfo.keyObject.publicKey,
    false, // standard account
    transfer.programId
  );

  // Destination: vault's token account
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    transfer.mint,
    smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    transfer.programId
  );

  // Get initial balances
  let initialAdminBalance: bigint = BigInt(0);
  let initialVaultBalance: bigint = BigInt(0);

  try {
    const adminAccount =
      await provider.connection.getTokenAccountBalance(adminTokenAccount);
    initialAdminBalance = BigInt(adminAccount.value.amount);
  } catch (error) {
    console.log("   ⚠️  Admin token account not found - balance is 0");
  }

  try {
    const vaultAccount =
      await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    initialVaultBalance = BigInt(vaultAccount.value.amount);
  } catch (error) {
    console.log("   ℹ️  Vault token account not found - will be created");
  }

  console.log(`   💳 Initial Admin Balance: ${initialAdminBalance.toString()}`);
  console.log(`   💳 Initial Vault Balance: ${initialVaultBalance.toString()}`);

  // Create token transfer transaction
  const tokenTransferTx = new Transaction();

  // Create ATA for vault (idempotent - won't fail if already exists)
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    adminKeyInfo.keyObject.publicKey, // payer (admin pays for account creation)
    vaultTokenAccount,
    smartAccountHelper.vault, // owner
    transfer.mint,
    transfer.programId
  );
  tokenTransferTx.add(createAtaIx);

  // Transfer tokens
  const transferIx = createTransferInstruction(
    adminTokenAccount, // source
    vaultTokenAccount, // destination
    adminKeyInfo.keyObject.publicKey, // authority
    actualAmount,
    [],
    transfer.programId
  );
  tokenTransferTx.add(transferIx);

  // Execute the transfer
  console.log("   🚀 Executing transfer...");

  const tx = new Transaction();

  // Add token transfer instructions
  tokenTransferTx.instructions.forEach((ix) => tx.add(ix));

  // Set recent blockhash
  tx.recentBlockhash = (
    await provider.connection.getLatestBlockhash()
  ).blockhash;
  tx.feePayer = adminKeyInfo.keyObject.publicKey;

  // Sign and send transaction
  tx.sign(adminKeyInfo.keyObject);

  const signature = await provider.connection.sendRawTransaction(
    tx.serialize(),
    {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    }
  );

  console.log(`   ✅ Transfer sent: ${signature}`);

  // Wait for confirmation
  await provider.connection.confirmTransaction(signature, "confirmed");

  // Get final balances
  let finalVaultBalance: bigint = BigInt(0);
  try {
    const vaultAccount =
      await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    finalVaultBalance = BigInt(vaultAccount.value.amount);
  } catch (error) {
    console.log("   ⚠️  Could not get final vault balance");
  }

  console.log(`   💰 Final vault balance: ${finalVaultBalance.toString()}`);
}

/**
 * Main execution function
 */
async function main() {
  try {
    await transferTokensAndSolToSa();
    console.log("\n🎉 All transfers completed!");
  } catch (error) {
    console.error("\n💥 Transfer failed:", error.message);
    process.exit(1);
  }
}

// Execute if run directly
if (require.main === module) {
  main();
}

export { transferTokensAndSolToSa };
