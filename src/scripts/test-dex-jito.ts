/**
 * @fileoverview DEX-Jito Integration Test Script
 *
 * This script provides testing for integrating the Solana Smart Account with OKX DEX operations
 * and with Jito infrastructure.
 *
 * Key Features:
 * - Smart Account integration with optimistic execution flow
 * - Support for OKX DEX operations
 * - Jito bundle execution
 * - Simulation mode for safe testing before on-chain execution
 *
 * Architecture:
 * 1. Smart Account Setup: Initializes smart account
 * 2. Transaction Preparation: Creates and validates transaction intents
 * 3. Bundle Construction: Builds Jito bundles for optimal execution
 * 4. Execution Flow: Optimistic validation → Execution of user intent → Post-execution validation
 *
 * Usage (in project root):
 *   yarn tsx scripts/test-dex-jito.ts <operation> [--execute|-x]
 *
 * Operations:
 *   - memo: Simple memo transaction
 *   - transfer: SOL transfer operation
 *   - swap: Token swap using OKX DEX
 *
 * Flags:
 *   --execute, -x: Execute on-chain (default: simulation only)
 *
 * Environment Variables Required:
 *   - RPC_URL: Solana RPC endpoint
 *   - TEST_R1_PRIVATE_KEY: R1 private key for WebAuthn authentication
 *   - SOLANA_TRANSFER_RECIPIENT: Recipient address for transfer tests
 */

import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import dotenv from "dotenv";
import {
  OKXDexClient,
  SwapRequestParams,
} from "./integration/dex/okx_dex_client";
import { createAssociatedTokenAccountIdempotentInstruction } from "@solana/spl-token";
import Jito from "./integration/jito/jito_client";
import { SmartAccountHelper } from "../tests/utils/smartAccount/helpers";
import { createSecp256r1Instruction } from "../tests/utils/r1-utils";
import { buildVersionedTransaction } from "./integration/jito/utils";
import { loadEnv } from "../helpers/setup";
import { SmartAccountSolana } from "../target/types/smart_account_solana";
import { Vault } from "../target/types/vault";
import { loadKeyFromEnv, R1KeyInfo } from "../helpers/key-loader";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../tests/utils/webauthn";
import {
  WEB_AUTHN_TABLE_SEED,
  BSOL_MINT,
  WSOL_MINT,
  LAMPORTS_PER_SIGNER,
} from "../tests/utils/consts";
import { createMeteoraBSolWsolInstruction } from "./integration/dex/okx_dex_instructions";
import {
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

// Load environment variables from .env file
dotenv.config();

/**
 * Smart Account ID as a byte array buffer
 * This represents the unique identifier for the smart account being tested
 */
const SA_ID_ARRAY: Buffer<ArrayBufferLike> = Buffer.from([
  81, 148, 183, 48, 171, 245, 57, 157, 102, 67, 180, 103, 7, 20, 202, 1, 70,
  218, 140, 151, 233, 63, 176, 2, 139, 175, 140, 139, 71, 91, 190, 45,
]);

/**
 * Solana Memo Program ID
 * Used for creating simple memo transactions during testing
 */
const MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

/**
 * Compute Budget Program ID
 * Used for setting compute unit limit and price
 */
const COMPUTE_BUDGET_PROGRAM_ID = "ComputeBudget111111111111111111111111111111";

/**
 * DexJitoTester - Main testing class for DEX-Jito integration
 *
 * @example
 * ```typescript
 * const tester = new DexJitoTester();
 * await tester.setup();
 * const result = await tester.testMemo(true); // simulation only
 * const result = await tester.testSwap(false); // on-chain execution
 * ```
 */
class DexJitoTester {
  /** Solana RPC connection for blockchain interaction */
  private connection: anchor.web3.Connection;

  /** Jito client for bundle execution */
  private jito: Jito;

  /** Smart account helper for managing account state and operations */
  private user: SmartAccountHelper;

  /** Keypair used for signing transactions and paying fees, usually the creator/deployer account */
  private signer: anchor.web3.Keypair;

  /** Smart Account Solana program instance */
  private saProgram: Program<SmartAccountSolana>;

  /** Vault program instance for batch execution */
  private vaultProgram: Program<Vault>;

  /** WebAuthn table address for authentication data storage */
  private webauthnTable: anchor.web3.PublicKey;

  /**
   * Constructor - Initializes the tester with default configuration
   *
   * Sets up the Solana connection and Jito client. The smart account and programs
   * are initialized later in the setup() method to ensure proper environment loading.
   */
  constructor() {
    this.connection = new anchor.web3.Connection(process.env.RPC_URL);
    this.jito = new Jito();
  }

  /**
   * Setup - Initializes the testing environment and smart account
   *
   * This method performs the complete initialization sequence:
   * 1. Loads environment configuration and Anchor programs
   * 2. Sets up the signer keypair from the environment
   * 3. Derives the WebAuthn table address for authentication
   * 4. Initializes the smart account helper with R1 key authentication
   *
   * @throws {Error} If environment variables are missing or programs fail to load
   * @returns {Promise<void>} Resolves when setup is complete
   */
  public async setup() {
    // Using loadEnv() from helpers/setup.ts
    // In particular, loads Anchor provider using the deployer wallet in .env
    // Deploy/creator account acts as signer and fee payer for submitting txs
    const { saProgram, vaultProgram } = loadEnv();

    this.saProgram = saProgram;
    this.vaultProgram = vaultProgram;
    this.signer = saProgram.provider.wallet.payer;
    this.webauthnTable = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(WEB_AUTHN_TABLE_SEED), Buffer.from([0])],
      saProgram.programId,
    )[0];
    this.user = SmartAccountHelper.createWithEnvKeys(
      SA_ID_ARRAY,
      saProgram,
      loadKeyFromEnv("TEST_R1_PRIVATE_KEY") as R1KeyInfo,
    );
  }

  /**
   * Get Swap Instructions - Retrieves swap instructions from OKX DEX
   *
   * Creates an OKX DEX client and fetches the necessary swap instructions
   * based on the provided swap parameters. This method abstracts the DEX
   * interaction and returns standardized instruction data.
   *
   * @param {SwapRequestParams} swapParams - Configuration for the swap operation
   * @returns {Promise<any>} Swap instructions from the DEX API
   */
  private async getSwapInstructions(swapParams: SwapRequestParams) {
    const client = new OKXDexClient();
    const swapInstructions = await client.getSwapInstructions(swapParams);
    return swapInstructions;
  }

  /**
   * Test Memo - Executes a simple memo transaction for testing purposes
   *
   * Creates a basic memo instruction that writes to the
   * Solana memo program. This method is useful for testing the basic transaction
   * flow without complex DEX operations or token transfers.
   *
   * The memo transaction serves as a lightweight test case to verify:
   * - Smart account authentication and validation
   * - Transaction intent creation and signing
   * - Jito bundle construction and execution flow
   *
   * @param {boolean} isSimulationOnly - If true, only simulate the transaction
   * @returns {Promise<any>} Execution result or simulation data
   *
   * @example
   * ```typescript
   * const result = await tester.testMemo(true);  // simulation only
   * const result = await tester.testMemo(false); // on-chain execution
   * ```
   */
  public async testMemo(isSimulationOnly: boolean) {
    const memoIx = new anchor.web3.TransactionInstruction({
      keys: [
        {
          pubkey: this.user.vault,
          isSigner: true,
          isWritable: true,
        },
      ],
      programId: new anchor.web3.PublicKey(MEMO_PROGRAM_ID),
      data: Buffer.from("Jito Test with Memo"),
    });

    const payload = {
      instructions: [memoIx],
      addressLookupTableAccounts: [],
    };

    const result = await this.submitBundle(payload, isSimulationOnly);
    return result;
  }

  /**
   * Test Transfer - Executes a SOL transfer transaction for testing purposes
   *
   * Creates a system program transfer instruction that moves 1 lamport from the
   * smart account vault to a specified recipient address. This method tests the
   * basic SOL transfer functionality through the smart account system.
   *
   * The transfer operation validates:
   * - Smart account vault balance and permissions
   * - System program integration
   * - Transaction signing and execution flow
   *
   * Note: Requires SOLANA_TRANSFER_RECIPIENT environment variable to be set
   *
   * @param {boolean} isSimulationOnly - If true, only simulate the transaction
   * @returns {Promise<any>} Execution result or simulation data
   *
   * @throws {Error} If SOLANA_TRANSFER_RECIPIENT environment variable is not set
   *
   * @example
   * ```typescript
   * const result = await tester.testTransfer(true);  // simulation only
   * const result = await tester.testTransfer(false); // on-chain execution
   * ```
   */
  public async testTransfer(isSimulationOnly: boolean) {
    const transferIx = anchor.web3.SystemProgram.transfer({
      fromPubkey: this.user.vault,
      toPubkey: new anchor.web3.PublicKey(
        process.env.SOLANA_TRANSFER_RECIPIENT,
      ),
      lamports: 1,
    });

    const payload = {
      instructions: [transferIx],
      addressLookupTableAccounts: [],
    };

    const result = await this.submitBundle(payload, isSimulationOnly);
    return result;
  }

  /**
   * Test Swap - Executes a token swap transaction using OKX DEX integration
   *
   * Creates a comprehensive swap operation that exchanges USDC for SOL through
   * the OKX DEX platform. This method demonstrates the full DEX integration
   * capabilities including:
   * - DEX API interaction and instruction retrieval
   * - Token swap parameter configuration
   * - Instruction conversion and payload preparation
   * - Bundle execution through the smart account system
   *
   * @param {boolean} isSimulationOnly - If true, only simulate the transaction
   * @param {number} paramSetIndex - Index of the parameter set to use (0-4)
   * @returns {Promise<any>} Execution result or simulation data
   *
   * @example
   * ```typescript
   * const result = await tester.testSwap(true, 0);   // simulation with default params
   * const result = await tester.testSwap(false, 2);  // execution with large swap params
   * ```
   */
  public async testSwap(isSimulationOnly: boolean, paramSetIndex: number = 0) {
    // Multiple hardcoded parameter sets for easy testing
    const swapParamSets: SwapRequestParams[] = [
      // Default: WSOL → USDC
      {
        chainId: 501,
        feePercent: 1,
        amount: 100,
        fromTokenAddress: "So11111111111111111111111111111111111111112", // WSOL
        toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        slippage: 0.1,
        userWalletAddress: this.user.vault.toString(),
        autoSlippage: false,
        directRoute: true,
      },
      // USDC → bSOL
      {
        chainId: 501,
        feePercent: 1,
        amount: 100,
        fromTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
        toTokenAddress: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", // bSOL
        slippage: 0.1,
        userWalletAddress: this.user.vault.toString(),
        autoSlippage: false,
        directRoute: true,
      },
      // bSOL → USDT
      {
        chainId: 501,
        feePercent: 1,
        amount: 100,
        fromTokenAddress: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1", // bSOL
        toTokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
        slippage: 0.5,
        userWalletAddress: this.user.vault.toString(),
        autoSlippage: false,
        directRoute: false,
      },
      // USDT → WSOL
      {
        chainId: 501,
        feePercent: 1,
        amount: 100,
        fromTokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
        toTokenAddress: "So11111111111111111111111111111111111111112", // WSOL
        slippage: 0.05,
        userWalletAddress: this.user.vault.toString(),
        autoSlippage: false,
        directRoute: false,
      },
      // SOL -> USDC
      {
        chainId: 501,
        feePercent: 1,
        amount: 100,
        fromTokenAddress: "11111111111111111111111111111111", // SOL
        toTokenAddress: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So", // USDC
        slippage: 1.0,
        userWalletAddress: this.user.vault.toString(),
        autoSlippage: true,
        directRoute: false,
      },
    ];

    // Validate parameter set index
    if (paramSetIndex < 0 || paramSetIndex >= swapParamSets.length) {
      throw new Error(
        `Invalid parameter set index: ${paramSetIndex}. Valid range: 0-${swapParamSets.length - 1}`,
      );
    }

    const swapParams = swapParamSets[paramSetIndex];
    const swapInstructions = await this.getSwapInstructions(swapParams);
    const convertedPayload = await this.convertPayload(swapInstructions);
    const result = await this.submitBundle(convertedPayload, isSimulationOnly);
    return result;
  }

  /**
   * Test Swap Meteora - Executes a BSOL-WSOL swap using Meteora DEX
   *
   * Creates a specialized swap operation for BSOL (Bonk Staked SOL) to WSOL
   * (Wrapped SOL) using the Meteora DEX protocol. This method demonstrates
   * crafting swap instructions through Meteora, using logic in
   * ./integration/dex/okx_meteora_swap.ts.
   * - Meteora-specific instruction creation
   * - Address lookup table integration for optimized transaction size
   * - Associated token account creation for destination tokens
   * - Complex DEX protocol integration
   *
   * Note: This method is currently not in use but serves as a reference
   * for implementing other DEX swap operations.
   *
   * @param {boolean} isSimulationOnly - If true, only simulate the transaction
   * @returns {Promise<any>} Execution result or simulation data
   *
   * @example
   * ```typescript
   * const result = await tester.testSwapMeteora(true);  // simulation only
   * const result = await tester.testSwapMeteora(false); // on-chain execution
   * ```
   */
  public async testSwapMeteora(isSimulationOnly: boolean) {
    const BSOL_WSOL_LUT: anchor.web3.PublicKey[] = [
      new anchor.web3.PublicKey("AUEghuJaUr4qshAQoSDvV8kfv7xz2kQGeR13G3FihMum"),
      new anchor.web3.PublicKey("DKjYmNFTR1SkTV5sD5C4YLyivRDb1Xqku9tzY4MwhTKC"),
    ];

    const addressLookupTableAccounts = [];
    if (BSOL_WSOL_LUT?.length > 0) {
      const lookupTableAccounts = await Promise.all(
        BSOL_WSOL_LUT.map(async (address) => {
          const pubkey = new anchor.web3.PublicKey(address);
          const account = await this.connection
            .getAddressLookupTable(pubkey)
            .then((res) => res.value);
          if (!account) {
            throw new Error(`Could not fetch lookup table account ${address}`);
          }
          return account;
        }),
      );
      addressLookupTableAccounts.push(...lookupTableAccounts);
    }

    // BSOL-WSOL
    const sourceTokenAccount = getAssociatedTokenAddressSync(
      BSOL_MINT,
      this.user.vault,
      true, // allowOwnerOffCurve for PDA
      TOKEN_PROGRAM_ID,
    );
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      WSOL_MINT,
      this.user.vault,
      true, // allowOwnerOffCurve for PDA
      TOKEN_PROGRAM_ID,
    );
    const instructions = await createMeteoraBSolWsolInstruction(
      this.saProgram.provider as anchor.AnchorProvider,
      new anchor.BN(1000),
      this.user.vault,
      sourceTokenAccount,
      destinationTokenAccount,
    );

    const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      this.user.vault, // payer (vault pays for account creation)
      destinationTokenAccount,
      this.user.vault, // owner
      WSOL_MINT,
      TOKEN_PROGRAM_ID,
    );

    const result = await this.submitBundle(
      {
        instructions: [createAtaIx, instructions],
        addressLookupTableAccounts,
      },
      isSimulationOnly,
    );
    return result;
  }

  /**
   * Convert Payload - Converts DEX API instructions to Solana transaction format
   *
   * This helper method transforms raw DEX API instruction data into the format
   * required by Solana transactions. It handles:
   * - Instruction data conversion from base64 to Buffer
   * - Account metadata mapping (pubkey, isSigner, isWritable)
   * - Address lookup table account resolution
   * - Instruction list flattening
   *
   * @param {any} swapInstructions - Raw instruction data from DEX API
   * @returns {Promise<{instructions: TransactionInstruction[], addressLookupTableAccounts: AddressLookupTableAccount[]}>}
   *          Converted instructions and lookup table accounts
   *
   * @example
   * ```typescript
   * const rawInstructions = await this.getSwapInstructions(swapParams);
   * const convertedPayload = await this.convertPayload(rawInstructions);
   * ```
   */
  private async convertPayload(swapInstructions: any) {
    // Helper function to convert DEX API instructions to Solana format
    const createTransactionInstruction = (instruction) => {
      return new anchor.web3.TransactionInstruction({
        programId: new anchor.web3.PublicKey(instruction.programId), // DEX program ID
        keys: instruction.accounts.map((key) => ({
          pubkey: new anchor.web3.PublicKey(key.pubkey), // Account address
          isSigner: key.isSigner, // True if account must sign tx
          isWritable: key.isWritable, // True if instruction modifies account
        })),
        data: Buffer.from(instruction.data, "base64"), // Instruction parameters
      });
    };

    const { instructionLists, addressLookupTableAccount } = swapInstructions;
    let computeUnitLimit = 500_000; // Fallback value if not provided by DEX API
    let computeUnitPrice = 100_000; // Fallback value if not provided by DEX API

    // Convert instructions to Solana format
    const instructions: anchor.web3.TransactionInstruction[] = [];
    if (instructionLists?.length) {
      for (const ix of instructionLists) {
        if (ix.programId === COMPUTE_BUDGET_PROGRAM_ID) {
          const bytes = Buffer.from(ix.data, "base64");
          if (bytes[0] === 2) {
            // Check if instruction is setting compute unit limit
            const view = new DataView(
              bytes.buffer,
              bytes.byteOffset,
              bytes.byteLength,
            );
            const units = view.getUint32(1, true);
            computeUnitLimit = units + 50_000; // Add some static buffer
          } else if (bytes[0] === 3) {
            // Check if instruction is setting compute unit price
            const view = new DataView(
              bytes.buffer,
              bytes.byteOffset,
              bytes.byteLength,
            );
            const price = view.getBigUint64(1, true);
            computeUnitPrice = Number(price);
          }
          // Skip compute budget instruction
          continue;
        }
        // Convert and add all other instructions
        instructions.push(createTransactionInstruction(ix));
      }
    }

    const addressLookupTableAccounts = [];
    const uniqueLookupTables = Array.from(new Set(addressLookupTableAccount));
    if (uniqueLookupTables?.length > 0) {
      const lookupTableAccounts = await Promise.all(
        uniqueLookupTables.map(async (address) => {
          const pubkey = new anchor.web3.PublicKey(address);
          const account = await this.connection
            .getAddressLookupTable(pubkey)
            .then((res) => res.value);
          if (!account) {
            throw new Error(`Could not fetch lookup table account ${address}`);
          }
          return account;
        }),
      );
      addressLookupTableAccounts.push(...lookupTableAccounts);
    }

    return {
      instructions,
      addressLookupTableAccounts,
      computeUnitLimit,
      computeUnitPrice,
    };
  }

  /**
   * Submit Bundle - Executes the complete optimistic execution flow
   *
   * This is the core method that orchestrates the entire optimistic execution
   * process through Jito bundles. The flow consists of three sequential
   * transactions that must be executed atomically:
   *
   * 1. Optimistic Validation (txPromise1):
   *    - Creates and signs transaction intent with WebAuthn authentication
   *    - Validates the transaction through the smart account program
   *
   * 2. Execution Validation (txPromise2):
   *    - Validates transaction with signed intent
   *    - Executes the actual business logic (memo, transfer, swap)
   *
   * 3. Post-Execution (txPromise3):
   *    - Records the execution completion and Jito tip payment
   *    - Finalizes the optimistic execution cycle
   *
   * @param {any} convertedPayload - Instructions and lookup table accounts
   * @param {boolean} isSimulationOnly - If true, only simulate the transactions
   * @returns {Promise<any>} Execution result or simulation data
   *
   * @throws {Error} If transaction preparation or execution fails
   *
   * @example
   * ```typescript
   * const payload = { instructions: [memoIx], addressLookupTableAccounts: [] };
   * const result = await this.submitBundle(payload, true);  // simulation
   * const result = await this.submitBundle(payload, false); // execution
   * ```
   */
  private async submitBundle(convertedPayload: any, isSimulationOnly: boolean) {
    // Extract instructions and address lookup tables from the payload
    const {
      instructions,
      addressLookupTableAccounts,
      computeUnitLimit = 200_000, // Default value
      computeUnitPrice = 100_000, // Default value
    } = convertedPayload;

    // Get latest blockhash for transaction freshness
    const { blockhash } = await this.connection.getLatestBlockhash();

    // Select random Jito tip account and estimate tip amount
    const jitoTipAccount = this.jito.getRandomTipAccount();
    const jitoTipAmount = await this.jito.estimateTipAmount();

    const executionFee = 5 * LAMPORTS_PER_SIGNER;
    const totalFee = executionFee + jitoTipAmount;

    // Create main transaction and add all instructions
    const mainTx = new anchor.web3.Transaction();
    instructions.forEach((ix) => mainTx.add(ix));

    // Set maximum slot for optimistic execution (current + 60 slots)
    const maxSlot = (await this.connection.getSlot()) + 60;

    // Prepare optimistic validation intent with smart account
    const {
      serializedMessage,
      deconstructedInstructions,
      remainingAccounts,
      validationArgs,
    } = await this.user.prepareOptimisticValidationIntent(
      mainTx,
      {
        tokenAmount: totalFee,
      },
      maxSlot,
      this.signer.publicKey,
    );

    // Add some dynamic buffer based on the number of remaining accounts
    const dynamicComputeUnitLimit = Math.min(
      computeUnitLimit + remainingAccounts.length * 5_000,
      1_400_000,
    );

    // Sign the intent
    const [message, signature] = this.user.signIntent(
      Uint8Array.from(serializedMessage),
    );

    // Transaction 1: Optimistic Validation
    const txPromise1 = this.saProgram.methods
      .optimisticValidation(
        validationArgs,
        {
          clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
          authData: WebAuthnAuthDataHelpers.Index(0),
        } as any,
        null,
      )
      .accountsPartial({
        smartAccount: this.user.sa,
        mandatorySigner: this.signer.publicKey,
        tokenMint: null,
        webauthnTable: this.webauthnTable,
      })
      .postInstructions([
        createSecp256r1Instruction(
          message,
          this.user.getPasskeyPubkey(),
          signature,
        ),
      ])
      .signers([this.signer])
      .transaction();

    // Transaction 2: Execute Business Logic
    const txPromise2 = this.saProgram.methods
      .validateOptimisticExecution()
      .accountsPartial({
        smartAccount: this.user.sa,
        vaultState: this.user.vaultState,
        smartAccountVault: this.user.vault,
      })
      .preInstructions([
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: dynamicComputeUnitLimit,
        }),
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: computeUnitPrice,
        }),
      ])
      .postInstructions([
        // Execute the batch of instructions through the vault program
        await this.vaultProgram.methods
          .executeBatch({ deconstructedInstructions })
          .accounts({
            vaultState: this.user.vaultState,
            smartAccountVault: this.user.vault,
          })
          .remainingAccounts(remainingAccounts)
          .instruction(),
      ])
      .transaction();

    // Transaction 3: Post-Execution
    const txPromise3 = this.saProgram.methods
      .postOptimisticExecution(new anchor.BN(jitoTipAmount))
      .accountsPartial({
        jitoTipAccount: jitoTipAccount,
        smartAccount: this.user.sa,
        vaultState: this.user.vaultState,
        smartAccountVault: this.user.vault,
        vaultTokenAccount: null,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
      })
      .transaction();

    // Build the complete transaction bundle
    const bundle = await Promise.all([txPromise1, txPromise2, txPromise3]).then(
      ([tx1, tx2, tx3]) => [
        buildVersionedTransaction(this.signer, blockhash, tx1.instructions),
        buildVersionedTransaction(
          this.signer,
          blockhash,
          tx2.instructions,
          addressLookupTableAccounts,
        ),
        buildVersionedTransaction(this.signer, blockhash, tx3.instructions),
      ],
    );

    // Execute the bundle through Jito infrastructure
    const result = await this.jito.executeBundle(
      bundle,
      this.user.sa,
      isSimulationOnly,
    );
    return result;
  }
}

/**
 * Main execution function - CLI entry point for the DEX-Jito test script
 *
 * This function serves as the primary entry point when the script is executed
 * directly. It handles:
 * - Command-line argument parsing and validation
 * - Operation selection and execution
 * - Error handling and user feedback
 *
 * The script supports three main operations (memo, transfer, swap) and can
 * operate in either simulation mode (default) or on-chain execution mode.
 *
 * CLI Interface:
 *   Usage: yarn tsx scripts/test-dex-jito.ts <operation> [paramSetIndex] [--execute|-x]
 *
 *   Operations:
 *     memo         - Execute a simple memo transaction
 *     transfer     - Execute a SOL transfer transaction
 *     swap         - Execute a token swap through OKX DEX
 *
 *   Flags:
 *     --execute, -x - Execute on-chain instead of simulation
 *
 *   Examples:
 *     yarn tsx scripts/test-dex-jito.ts memo
 *     yarn tsx scripts/test-dex-jito.ts transfer --execute
 *     yarn tsx scripts/test-dex-jito.ts swap
 *     yarn tsx scripts/test-dex-jito.ts swap 2
 *     yarn tsx scripts/test-dex-jito.ts swap --execute 3
 *     yarn tsx scripts/test-dex-jito.ts swap -x 4
 *
 * @throws {Error} If invalid arguments are provided or execution fails
 * @returns {Promise<void>} Resolves when execution completes
 */
async function main() {
  try {
    // Parse CLI arguments
    const args = process.argv.slice(2);
    if (args.length < 1 || args.length > 3) {
      console.error(
        "Usage: yarn tsx scripts/test-dex-jito.ts <operation> [paramSetIndex] [--execute|-x]",
      );
      console.error("Operations: memo, transfer, swap");
      console.error("Optional flags:");
      console.error(
        "  --execute, -x: Execute on-chain instead of simulation (default: simulation only)",
      );
      console.error(
        "  paramSetIndex: Index of the swap parameter set to use (0-4, default: 0)",
      );
      console.error("");
      console.error(
        "For swap operations, you can specify a parameter set index (0-4):",
      );
      process.exit(1);
    }

    const operation = args[0].toLowerCase();

    const isSimulationOnly = !(
      args.includes("--execute") || args.includes("-x")
    );
    const paramSetIndex = parseInt(args[1] || "0", 10);

    const tester = new DexJitoTester();
    await tester.setup();

    let result;
    switch (operation) {
      case "memo":
        result = await tester.testMemo(isSimulationOnly);
        break;
      case "transfer":
        result = await tester.testTransfer(isSimulationOnly);
        break;
      case "swap":
        result = await tester.testSwap(isSimulationOnly, paramSetIndex);
        break;
      default:
        console.error(`Unknown operation: ${operation}`);
        console.error("Valid operations: memo, transfer, swap");
        process.exit(1);
    }
    console.log(result);
    console.log(`\n🎊 Success! Optimistic Execution (${operation}) completed.`);
  } catch (error: any) {
    console.error(
      `❌ Error executing DEX-Jito Optimistic Execution Flow:`,
      error.message,
    );
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
