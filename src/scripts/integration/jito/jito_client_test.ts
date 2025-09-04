/**
 * Test script for Jito Client
 *
 * This test script demonstrates the usage of the Jito bundle client by creating
 * and executing test transaction bundles. It serves as a testing utility
 * and an example implementation for integrating Jito bundling.
 *
 * The script creates a bundle containing two transactions:
 * 1. A test transfer of 1 lamport to a recipient
 * 2. A tip payment to a Jito tip account for bundle priority
 *
 * Key features tested:
 * - Jito client initialization and configuration
 * - Bundle creation and preparation
 * - Dynamic tip estimation and account selection
 * - Bundle simulation and execution
 * - Error handling and validation
 */

import * as anchor from "@coral-xyz/anchor";
import { buildVersionedTransaction } from "./utils";
import Jito from "./jito_client";
import dotenv from "dotenv";
import base58 from "bs58";

// Load environment variables for test configuration
dotenv.config();

/** Secret key for the client wallet (account performing the operation) */
const CLIENT_SECRET_KEY = process.env.CLIENT_SECRET_KEY;
/** Recipient address for test transfer transactions */
const TRANSFER_RECIPIENT = new anchor.web3.PublicKey(
  process.env.SOLANA_TRANSFER_RECIPIENT
);

/**
 * Main test execution function
 *
 * This function initializes the Jito client, sets up test parameters,
 * and executes the bundle simulation tests.
 *
 * Test flow:
 * 1. Initialize Jito client
 * 2. Generate test keypairs
 * 3. Configure tip accounts
 * 4. Execute bundle simulation tests
 * 5. Log results
 */
async function main() {
  // Initialize Jito client for bundle operations
  const jito = new Jito();

  // Set up Solana connection
  const connection = new anchor.web3.Connection(process.env.RPC_URL);

  // Generate a new keypair for testing (no funds)
  const signer = anchor.web3.Keypair.generate();

  // Load client wallet from environment for successful tests
  const clientWallet = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(base58.decode(CLIENT_SECRET_KEY))
  );

  // Select a random tip account to reduce contention
  const tipAccount = new anchor.web3.PublicKey(jito.getRandomTipAccount());

  // Estimate optimal tip amount for bundle priority
  const tipAmount = Math.floor(await jito.estimateTipAmount());

  // Get recent blockhash for transaction construction
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  // Test failure scenario with unfunded keypair
  try {
    await testSimulateBundle(
      jito,
      signer, // Unfunded keypair - will fail
      tipAccount,
      tipAmount,
      recentBlockhash
    );
  } catch (e) {
    console.log("Should fail:", e);
    console.log("--------------------------------");
  }

  // Test success scenario with funded client wallet
  await testSimulateBundle(
    jito,
    clientWallet, // Funded wallet - should succeed
    tipAccount,
    tipAmount,
    recentBlockhash
  );
}

/**
 * Prepare a test transaction bundle for Jito execution
 *
 * This function creates a bundle containing two transactions:
 * 1. A test transfer of 1 lamport to a recipient
 * 2. A tip payment to ensure bundle priority and inclusion
 *
 * The bundle structure demonstrates real-world usage patterns where
 * multiple related transactions need to be executed atomically.
 *
 * @param signer - Keypair to sign the transactions
 * @param tipAccount - Public address of the Jito tip account
 * @param tipAmount - Amount of lamports to tip for priority
 * @param recentBlockhash - Recent blockhash for transaction validity
 * @returns Promise resolving to an array of versioned transactions
 *
 * @example
 * ```typescript
 * const bundle = await prepareBundle(
 *   wallet,
 *   tipAccount,
 *   10_000,  // 10k lamports tip
 *   blockhash
 * );
 * ```
 */
async function prepareBundle(
  signer: anchor.web3.Keypair,
  tipAccount: anchor.web3.PublicKey,
  tipAmount: number,
  recentBlockhash: string
) {
  // Create a bundle with two transactions
  const bundle = [
    // Transaction 1: Test transfer of 1 lamport
    buildVersionedTransaction(signer, recentBlockhash, [
      anchor.web3.SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: TRANSFER_RECIPIENT,
        lamports: 1, // Minimal amount for testing
      }),
    ]),

    // Transaction 2: Tip payment to Jito for bundle priority
    buildVersionedTransaction(signer, recentBlockhash, [
      anchor.web3.SystemProgram.transfer({
        fromPubkey: signer.publicKey,
        toPubkey: tipAccount,
        lamports: tipAmount, // Dynamic tip amount for priority
      }),
    ]),
  ];

  return bundle;
}

/**
 * Test bundle simulation and execution through Jito
 *
 * This function demonstrates the complete workflow of:
 * 1. Bundle preparation with test transactions
 * 2. Bundle simulation to validate execution
 * 3. Bundle submission and execution (if simulation succeeds)
 * 4. Result logging and status reporting
 *
 * The function serves as a comprehensive test of the Jito client's
 * capabilities and provides a template for production implementations.
 *
 * @param jito - Initialized Jito client instance
 * @param signer - Keypair for transaction signing and account monitoring
 * @param tipAccount - Public key of the tip account for priority fees
 * @param tipAmount - Amount of lamports to tip for bundle priority
 * @param recentBlockhash - Recent blockhash for transaction construction
 * @returns Promise resolving to execution results from Jito
 *
 * @example
 * ```typescript
 * const result = await testSimulateBundle(
 *   jitoClient,
 *   wallet,
 *   tipAccount,
 *   estimatedTip,
 *   blockhash
 * );
 * console.log("Bundle execution result:", result);
 * ```
 */
async function testSimulateBundle(
  jito: Jito,
  signer: anchor.web3.Keypair,
  tipAccount: anchor.web3.PublicKey,
  tipAmount: number,
  recentBlockhash: string
) {
  // Prepare the test bundle with transfer and tip transactions
  const bundle = await prepareBundle(
    signer,
    tipAccount,
    tipAmount,
    recentBlockhash
  );

  // Execute the bundle through Jito (simulation + execution)
  // Set isSimulationOnly to false to actually submit the bundle
  const result = await jito.executeBundle(bundle, signer.publicKey, true);

  // Log the execution results
  console.log(result);

  return result;
}

// Execute the main test function
main();
