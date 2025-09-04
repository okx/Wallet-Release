#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getMint,
} from "@solana/spl-token";
import { loadEnv } from "../helpers/setup";
import { loadKeyFromEnv, displayKeyInfo } from "../helpers/key-loader";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// Configuration constants
const TOKEN_DECIMALS = 6; // Standard for most tokens (like USDC)
const INITIAL_SUPPLY = 1_000_000; // 1 million tokens
const TOKEN_NAME = "Test Token";
const TOKEN_SYMBOL = "TEST";

/**
 * Create a test SPL token
 */
async function createTestToken() {
  console.log("🪙 Creating Test SPL Token...");

  // 1. Setup provider and connection using existing helper
  const { saProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;
  const connection = provider.connection;

  // 2. Load mint authority from environment
  const mintAuthorityInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

  if (mintAuthorityInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }

  const mintAuthority = mintAuthorityInfo.keyObject;
  displayKeyInfo("Mint Authority", mintAuthorityInfo);

  // 3. Create the mint
  console.log("🏗️  Creating token mint...");

  const mint = await createMint(
    connection,
    mintAuthority, // payer
    mintAuthority.publicKey, // mint authority
    mintAuthority.publicKey, // freeze authority
    TOKEN_DECIMALS // decimals
  );

  console.log(`✅ Token mint created: ${mint.toBase58()}`);

  // 4. Create associated token account for mint authority
  console.log("🏦 Creating associated token account...");

  const tokenAccount = await getOrCreateAssociatedTokenAccount(
    connection,
    mintAuthority, // payer
    mint, // mint
    mintAuthority.publicKey // owner
  );

  console.log(`✅ Token account created: ${tokenAccount.address.toBase58()}`);

  // 5. Mint initial supply
  console.log(`🪙 Minting ${INITIAL_SUPPLY.toLocaleString()} tokens...`);

  const mintAmount = INITIAL_SUPPLY * Math.pow(10, TOKEN_DECIMALS);

  const mintTx = await mintTo(
    connection,
    mintAuthority, // payer
    mint, // mint
    tokenAccount.address, // destination
    mintAuthority, // authority
    mintAmount // amount
  );

  console.log(`✅ Minted ${INITIAL_SUPPLY.toLocaleString()} tokens: ${mintTx}`);

  // 6. Verify mint info
  const mintInfo = await getMint(connection, mint);
  const actualSupply = Number(mintInfo.supply) / Math.pow(10, TOKEN_DECIMALS);

  // 7. Display results
  console.log("\n📋 Token Details:");
  console.log(`   Name: ${TOKEN_NAME} (${TOKEN_SYMBOL})`);
  console.log(`   Mint Address: ${mint.toBase58()}`);
  console.log(`   Decimals: ${TOKEN_DECIMALS}`);
  console.log(`   Total Supply: ${actualSupply.toLocaleString()}`);
  console.log(`   Mint Authority: ${mintAuthority.publicKey.toBase58()}`);
  console.log(`   Freeze Authority: ${mintAuthority.publicKey.toBase58()}`);
  console.log(`   Authority Token Account: ${tokenAccount.address.toBase58()}`);

  // 8. Save to environment file suggestion
  console.log("\n💡 Add this to your .env file:");
  console.log(`TEST_TOKEN_MINT=${mint.toBase58()}`);
  console.log(`TEST_TOKEN_ACCOUNT=${tokenAccount.address.toBase58()}`);

  return {
    mint: mint.toBase58(),
    tokenAccount: tokenAccount.address.toBase58(),
    mintAuthority: mintAuthority.publicKey.toBase58(),
    decimals: TOKEN_DECIMALS,
    totalSupply: actualSupply,
    mintTransaction: mintTx,
  };
}

/**
 * Main execution
 */
async function main() {
  try {
    const result = await createTestToken();
    console.log("\n🎊 Success! Your test token is ready to use.");
  } catch (error: any) {
    console.error(`❌ Error creating test token:`, error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
