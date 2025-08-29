import * as anchor from "@coral-xyz/anchor";
import { fromWorkspace, LiteSVMProvider } from "anchor-litesvm";
import { ComputeBudget, LiteSVM } from "litesvm";
import { Program } from "@coral-xyz/anchor";
import { SmartAccountSolana } from "../../target/types/smart_account_solana";
import { ZkEmailVerifier } from "../../target/types/zk_email_verifier";
import { UpgradeMock } from "../../target/types/upgrade_mock";
import { Vault } from "../../target/types/vault";
import * as path from "path";
import { Transaction, AccountMeta, PublicKey } from "@solana/web3.js";
import { createSecp256r1Instruction } from "./r1-utils";
import {
  UPGRADEABLE_LOADER_PROGRAM_ID,
  CONFIG_SEED,
  SMART_ACCOUNT_SOLANA_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  WEB_AUTHN_TABLE_SEED,
  ORIGIN,
  PRE_JSON,
  POST_JSON,
  LAMPORTS_PER_SIGNER,
} from "./consts";
import {
  deriveWebAuthnTableAddress,
  getConfigAccount,
  getVaultConfigAccount,
  toBytesUInt32,
  toBytesUint32LE,
  toBytesUInt64,
} from "./helpers";
import {
  mockConfigData,
  mockDkimOracleEntryData,
  mockDkimOracleConfigData,
  mockVaultConfigData,
} from "./configSerializer";
import {
  SmartAccountHelper,
  BatchExecutionOptions,
  BatchExecutionResult,
} from "./smartAccount/helpers";
import { expect } from "chai";
import { FeatureSet } from "litesvm";
import { TransactionMetadata } from "litesvm";
import {
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
  getAccount,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { DkimKeyOracle } from "../../target/types/dkim_key_oracle";
import {
  WebAuthnStringHelpers,
  WebAuthnAuthDataHelpers,
  buildAuthData,
} from "./webauthn";

const SA_IDL = require("../../target/idl/smart_account_solana.json");
const ZK_IDL = require("../../target/idl/zk_email_verifier.json");
const VAULT_IDL = require("../../target/idl/vault.json");
const UPGRADE_MOCK_IDL = require("../../target/idl/upgrade_mock.json");
const DKIM_IDL = require("../../target/idl/dkim_key_oracle.json");

export class TestBase {
  public client: LiteSVM;
  public provider: LiteSVMProvider;
  public saProgram: Program<SmartAccountSolana>;
  public zkProgram: Program<ZkEmailVerifier>;
  public vaultProgram: Program<Vault>; // Will be set by test that needs vault functionality
  public programData: anchor.web3.PublicKey;
  public upgradeMockProgram: Program<UpgradeMock>;
  public txPayer: anchor.web3.Keypair;
  public webauthnModerator: anchor.web3.Keypair;
  public admin: anchor.web3.Keypair;
  public creator: anchor.web3.Keypair;
  public mandatorySigner: anchor.web3.Keypair;
  public config: anchor.web3.PublicKey;
  public vaultConfig: anchor.web3.PublicKey;
  public webauthnTable: anchor.web3.PublicKey;
  public INITIAL_AIRDROP: bigint = BigInt(10 * anchor.web3.LAMPORTS_PER_SOL);
  public oracleTimelock: number = 60;

  // keccack256 hash of "gmail.com"
  public domainHash: Buffer = Buffer.from(
    "de997f4d4968f67729cc671fb1c42560f22cdc63e46dbd5f0f0eb87bfe73d6e2",
    "hex"
  );
  public keyHash: Buffer = Buffer.from(
    "0EA9C777DC7110E5A9E89B13F0CFC540E3845BA120B2B6DC24024D61488D4788",
    "hex"
  );

  // Token testing properties
  public testSPL2022TokenMint: anchor.web3.PublicKey;
  public testSPL2022TokenMintKeypair: anchor.web3.Keypair;

  public testSPLTokenMint: anchor.web3.PublicKey;
  public testSPLTokenMintKeypair: anchor.web3.Keypair;
  public dkimProgram: Program<DkimKeyOracle>;

  async assertConfigState() {
    let configAccount = await this.saProgram.account.config.fetch(this.config);
    let bump = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_SEED)],
      this.saProgram.programId
    )[1];
    expect(configAccount.bump[0]).to.equal(bump);
    expect(configAccount.admin.toBase58()).to.equal(
      this.admin.publicKey.toBase58()
    );
    expect(configAccount.creator.toBase58()).to.equal(
      this.creator.publicKey.toBase58()
    );

    expect(configAccount.webauthnModerator.toBase58()).to.equal(
      this.webauthnModerator.publicKey.toBase58()
    );
  }

  async assertVaultConfigState() {
    let bump = await anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_CONFIG_SEED)],
      this.vaultProgram.programId
    )[1];
    let vaultConfigAccount = await this.vaultProgram.account.vaultConfig.fetch(
      this.vaultConfig
    );
    expect(vaultConfigAccount.bump).to.equal(bump);
    expect(vaultConfigAccount.admin.toBase58()).to.equal(
      this.admin.publicKey.toBase58()
    );
    expect(vaultConfigAccount.authorizedPrograms.length).to.equal(1);
    expect(vaultConfigAccount.authorizedPrograms[0].toBase58()).to.equal(
      SMART_ACCOUNT_SOLANA_PROGRAM_ID.toBase58()
    );
  }

  async createSmartAccount(helper: SmartAccountHelper) {
    const createPayAccountArgs = {
      id: helper.getId(),
      userPasskey: helper.getPasskey(),
      mandatorySigner: helper.getMandatorySignerPubkey(),
      initialRecoverySigner: helper.recoverySigners[0].publicKey,
    };

    const smartAccountSize = BigInt(296);
    const vaultStateSize = BigInt(107);
    const rent =
      this.client.getRent().minimumBalance(smartAccountSize) +
      this.client.getRent().minimumBalance(vaultStateSize);
    const totalFees = rent + BigInt(LAMPORTS_PER_SIGNER * 3);

    const createAccountArgsBuffer = this.saProgram.coder.types.encode(
      "createPayAccountArgs",
      createPayAccountArgs
    );
    const tokenAmountBuffer = Buffer.alloc(8);
    tokenAmountBuffer.writeBigUInt64LE(totalFees);
    const tokenMintBuffer = Buffer.alloc(1);
    tokenMintBuffer.writeUInt8(0); // None variant (no token mint)
    const saBuffer = helper.sa.toBuffer();
    const vaultBuffer = helper.vault.toBuffer();
    const vaultStateBuffer = helper.vaultState.toBuffer();
    const serializedIntent = Buffer.concat([
      tokenAmountBuffer,
      tokenMintBuffer,
      createAccountArgsBuffer,
      saBuffer,
      vaultBuffer,
      vaultStateBuffer,
    ]);

    const [message, signature, authData, clientJson] = helper.signIntent(
      Uint8Array.from(serializedIntent)
    );

    const tx = await this.saProgram.methods
      .createPayAccount(
        createPayAccountArgs,
        new anchor.BN(totalFees),
        {
          clientDataJson: WebAuthnStringHelpers.Direct(clientJson),
          authData: WebAuthnAuthDataHelpers.Direct(authData),
        } as any,
        null
      )
      .accountsPartial({
        txPayer: this.txPayer.publicKey,
        creator: this.creator.publicKey,
        vaultProgram: this.vaultProgram.programId,
        config: this.config,
        vaultConfig: this.vaultConfig,
        vaultState: helper.vaultState,
        smartAccountVault: helper.vault,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
        vaultTokenAccount: null,
        webauthnTable: null,
      })
      .preInstructions([
        createSecp256r1Instruction(
          message,
          helper.getPasskeyPubkey(),
          signature
        ),
      ])
      .signers([this.txPayer, this.creator])
      .transaction();

    const result = await helper.createVersionedTransaction(
      this.provider as any,
      tx.instructions,
      [this.txPayer, this.creator]
    );
    let res = await this.provider.client.sendTransaction(
      result.versionedTransaction
    );
    res = res as TransactionMetadata;
  }

  /**
   * Creates a smart account using SPL tokens instead of SOL
   */
  async createSmartAccountWithSPL(
    helper: SmartAccountHelper,
    tokenMint: anchor.web3.PublicKey,
    tokenAmount: bigint,
    is2022: boolean = true
  ) {
    const createPayAccountArgs = {
      id: helper.getId(),
      userPasskey: helper.getPasskey(),
      mandatorySigner: helper.getMandatorySignerPubkey(),
      initialRecoverySigner: helper.recoverySigners[0].publicKey,
    };

    const smartAccountSize = BigInt(292);
    const vaultStateSize = BigInt(107);
    const rent =
      this.client.getRent().minimumBalance(smartAccountSize) +
      this.client.getRent().minimumBalance(vaultStateSize);
    const totalFees = rent + BigInt(LAMPORTS_PER_SIGNER * 3);

    const createAccountArgsBuffer = this.saProgram.coder.types.encode(
      "createPayAccountArgs",
      createPayAccountArgs
    );
    const tokenAmountBuffer = Buffer.alloc(8);
    tokenAmountBuffer.writeBigUInt64LE(tokenAmount);
    const tokenMintBuffer = Buffer.alloc(33); // 1 byte for Some variant + 32 bytes for pubkey
    tokenMintBuffer.writeUInt8(1); // Some variant (has token mint)
    tokenMintBuffer.set(tokenMint.toBuffer(), 1); // Write pubkey starting at byte 1
    const saBuffer = helper.sa.toBuffer();
    const vaultBuffer = helper.vault.toBuffer();
    const vaultStateBuffer = helper.vaultState.toBuffer();
    const serializedIntent = Buffer.concat([
      tokenAmountBuffer,
      tokenMintBuffer,
      createAccountArgsBuffer,
      saBuffer,
      vaultBuffer,
      vaultStateBuffer,
    ]);

    const [message, signature, authData, clientJson] = helper.signIntent(
      Uint8Array.from(serializedIntent)
    );

    // Get token program ID based on whether it's 2022 or regular SPL
    const tokenProgramId = is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;

    // Get vault token account address
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      helper.vault,
      true, // allowOwnerOffCurve = true for PDA
      tokenProgramId
    );

    // Get destination token account (txPayer's token account)
    const destinationTokenAccount = getAssociatedTokenAddressSync(
      tokenMint,
      this.txPayer.publicKey,
      false, // allowOwnerOffCurve = false for regular account
      tokenProgramId
    );

    const tx = await this.saProgram.methods
      .createPayAccount(
        createPayAccountArgs,
        new anchor.BN(tokenAmount),
        {
          clientDataJson: WebAuthnStringHelpers.Direct(clientJson),
          authData: WebAuthnAuthDataHelpers.Direct(authData),
        } as any,
        null
      )
      .accountsPartial({
        txPayer: this.txPayer.publicKey,
        creator: this.creator.publicKey,
        vaultProgram: this.vaultProgram.programId,
        config: this.config,
        vaultConfig: this.vaultConfig,
        vaultState: helper.vaultState,
        smartAccountVault: helper.vault,
        tokenMint: tokenMint,
        destinationTokenAccount: destinationTokenAccount,
        tokenProgram: tokenProgramId,
        vaultTokenAccount: vaultTokenAccount,
        webauthnTable: null,
      })
      .preInstructions([
        createSecp256r1Instruction(
          message,
          helper.getPasskeyPubkey(),
          signature
        ),
      ])
      .signers([this.txPayer, this.creator])
      .transaction();

    const result = await helper.createVersionedTransaction(
      this.provider as any,
      tx.instructions,
      [this.txPayer, this.creator]
    );
    let res = await this.provider.client.sendTransaction(
      result.versionedTransaction
    );
    res = res as TransactionMetadata;
  }

  /**
   * Convenient wrapper for batch execution using this test base's configuration
   * Returns a versioned transaction ready for submission
   */
  async executeBatch(
    instructions: anchor.web3.TransactionInstruction[],
    smartAccountHelper: SmartAccountHelper,
    options?: Partial<
      Omit<BatchExecutionOptions, "vaultProgram" | "provider" | "payer">
    >
  ): Promise<BatchExecutionResult> {
    if (!this.vaultProgram) {
      throw new Error(
        "Vault program not set. Please set this.vaultProgram before using batch execution."
      );
    }

    const batchOptions: BatchExecutionOptions = {
      vaultProgram: this.vaultProgram,
      provider: this.provider as any,
      payer: this.txPayer,
      // Default to bypass smart account validation for LiteSVM compatibility
      bypassSmartAccountValidation: true,
      useAddressLookupTable: true,
      ...options,
    };

    return smartAccountHelper.executeBatch(instructions, batchOptions);
  }

  /**
   * Creates and initializes a test token mint using TOKEN_2022_PROGRAM_ID
   * This is useful for testing token operations in LiteSVM environment
   */
  async createTestSPL2022TokenMint(): Promise<void> {
    // Create a test token mint keypair
    this.testSPL2022TokenMintKeypair = anchor.web3.Keypair.generate();
    this.testSPL2022TokenMint = this.testSPL2022TokenMintKeypair.publicKey;

    // Get minimum rent for mint account
    const mintRent = await getMinimumBalanceForRentExemptMint(
      this.provider.connection
    );

    // Create mint account
    const createMintAccountIx = anchor.web3.SystemProgram.createAccount({
      fromPubkey: this.txPayer.publicKey,
      newAccountPubkey: this.testSPL2022TokenMint,
      lamports: Number(mintRent),
      space: MINT_SIZE,
      programId: TOKEN_2022_PROGRAM_ID,
    });

    // Initialize mint
    const initializeMintIx = createInitializeMintInstruction(
      this.testSPL2022TokenMint,
      6, // decimals
      this.txPayer.publicKey, // mint authority
      this.txPayer.publicKey, // freeze authority
      TOKEN_2022_PROGRAM_ID
    );

    const mintTransaction = new anchor.web3.Transaction()
      .add(createMintAccountIx)
      .add(initializeMintIx);

    this.provider.client.withSigverify(false);
    await this.provider.sendAndConfirm(mintTransaction, [
      this.txPayer,
      this.testSPL2022TokenMintKeypair,
    ]);
    this.provider.client.withSigverify(true);
  }

  /**
   * Creates and initializes a test token mint using TOKEN_PROGRAM_ID (regular SPL Token)
   * This is useful for testing regular SPL token operations
   */
  async createTestSPLTokenMint(): Promise<anchor.web3.PublicKey> {
    // Create a test token mint keypair
    this.testSPLTokenMintKeypair = anchor.web3.Keypair.generate();
    this.testSPLTokenMint = this.testSPLTokenMintKeypair.publicKey;

    // Get minimum rent for mint account
    const mintRent = await getMinimumBalanceForRentExemptMint(
      this.provider.connection
    );

    // Create mint account
    const createMintAccountIx = anchor.web3.SystemProgram.createAccount({
      fromPubkey: this.txPayer.publicKey,
      newAccountPubkey: this.testSPLTokenMint,
      lamports: Number(mintRent),
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    });

    // Initialize mint
    const initializeMintIx = createInitializeMintInstruction(
      this.testSPLTokenMint,
      6, // decimals
      this.txPayer.publicKey, // mint authority
      this.txPayer.publicKey, // freeze authority
      TOKEN_PROGRAM_ID
    );

    const mintTransaction = new anchor.web3.Transaction()
      .add(createMintAccountIx)
      .add(initializeMintIx);

    this.provider.client.withSigverify(false);
    await this.provider.sendAndConfirm(mintTransaction, [
      this.txPayer,
      this.testSPLTokenMintKeypair,
    ]);
    this.provider.client.withSigverify(true);

    return this.testSPLTokenMint;
  }

  /**
   * Check token account balance using TOKEN_2022_PROGRAM_ID
   */
  async getTokenBalance(
    tokenAccount: anchor.web3.PublicKey,
    is2022: boolean = true
  ): Promise<bigint | null> {
    try {
      const accountInfo = await getAccount(
        this.provider.connection,
        tokenAccount,
        undefined,
        is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      );
      return accountInfo.amount;
    } catch (error) {
      // Account might not exist
      return null;
    }
  }

  /**
   * Get SOL balance for any account
   * Fetches account info and returns lamports balance
   */
  async getBalance(account: anchor.web3.PublicKey): Promise<number> {
    try {
      const accountInfo =
        await this.provider.connection.getAccountInfo(account);
      return accountInfo ? accountInfo.lamports : 0;
    } catch (error) {
      // Account doesn't exist
      return 0;
    }
  }

  /**
   * Verify token balances for multiple accounts
   */
  async verifyTokenBalances(
    tokenAccounts: anchor.web3.PublicKey[],
    expectedAmounts: (bigint | number)[],
    accountLabels?: string[]
  ): Promise<boolean> {
    let allCorrect = true;

    for (let i = 0; i < tokenAccounts.length; i++) {
      const balance = await this.getTokenBalance(tokenAccounts[i]);
      const expected =
        typeof expectedAmounts[i] === "number"
          ? BigInt(expectedAmounts[i] as number)
          : (expectedAmounts[i] as bigint);
      const label = accountLabels?.[i] || `Account ${i + 1}`;

      if (balance === null) {
        console.log(`❌ ${label}: Could not fetch balance`);
        allCorrect = false;
      } else if (balance !== expected) {
        console.log(`❌ ${label}: Expected ${expected}, got ${balance}`);
        allCorrect = false;
      }
    }

    return allCorrect;
  }

  /**
   * Creates instructions for token operations: create ATA (idempotent) + transfer
   * @param payer - The account that will pay for ATA creation
   * @param sourceTokenAccount - The source token account to transfer from
   * @param authority - The authority that can transfer from source
   * @param recipients - Array of recipient public keys
   * @param transferAmount - Amount to transfer to each recipient
   * @returns Array of instructions (create ATA + transfer for each recipient)
   */
  createAccountAndTransferInstructions(
    payer: anchor.web3.PublicKey,
    sourceTokenAccount: anchor.web3.PublicKey,
    authority: anchor.web3.PublicKey,
    recipients: anchor.web3.PublicKey[],
    transferAmount: number,
    is2022: boolean = true
  ): {
    instructions: anchor.web3.TransactionInstruction[];
    recipientTokenAccounts: anchor.web3.PublicKey[];
  } {
    const instructions: anchor.web3.TransactionInstruction[] = [];
    const recipientTokenAccounts: anchor.web3.PublicKey[] = [];

    for (const recipient of recipients) {
      // Get recipient's token account address
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        is2022 ? this.testSPL2022TokenMint : this.testSPLTokenMint,
        recipient,
        false,
        is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      );
      recipientTokenAccounts.push(recipientTokenAccount);

      // 1. Create ATA for recipient (idempotent)
      const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
        payer, // payer
        recipientTokenAccount,
        recipient, // owner
        is2022 ? this.testSPL2022TokenMint : this.testSPLTokenMint,
        is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
      );
      instructions.push(createAtaIx);

      // 2. Transfer tokens
      const transferIx = createTransferInstruction(
        sourceTokenAccount, // source
        recipientTokenAccount, // destination
        authority, // authority
        transferAmount,
        [],
        TOKEN_2022_PROGRAM_ID
      );
      instructions.push(transferIx);
    }

    return { instructions, recipientTokenAccounts };
  }

  /**
   * Helper to get token account address for a given owner
   */
  getTokenAccountAddress(
    owner: anchor.web3.PublicKey,
    allowOwnerOffCurve: boolean = false,
    is2022: boolean = true
  ): anchor.web3.PublicKey {
    return getAssociatedTokenAddressSync(
      is2022 ? this.testSPL2022TokenMint : this.testSPLTokenMint,
      owner,
      allowOwnerOffCurve,
      is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID
    );
  }

  /**
   * Parse signature verification errors from LiteSVM
   * @param error - The caught error object
   * @returns Object with parsed error information
   */
  parseSignatureError(error: any): {
    isSignatureError: boolean;
    missingSignatures: string[];
    errorMessage: string;
  } {
    const errorMessage = error?.message || error?.toString() || "";

    // Check for signature verification failure patterns
    const isSignatureError =
      errorMessage.includes("Signature verification failed") ||
      errorMessage.includes("Missing signature for public key") ||
      errorMessage.includes("signature verification failed") ||
      errorMessage.includes("invalid signature");

    const missingSignatures: string[] = [];

    // Extract missing signature public keys
    const signatureRegex = /Missing signature for public key \[`([^`]+)`\]/g;
    let match;
    while ((match = signatureRegex.exec(errorMessage)) !== null) {
      missingSignatures.push(match[1]);
    }

    return {
      isSignatureError,
      missingSignatures,
      errorMessage,
    };
  }

  /**
   * Parse native Solana program errors (System Program, SPL Token, etc.)
   * @param error - The caught error object
   * @returns Object with parsed native Solana error information
   */
  parseSolanaError(error: any): {
    isSolanaError: boolean;
    isInsufficientFunds: boolean;
    isInvalidAccount: boolean;
    isCustomProgramError: boolean;
    customErrorCode: string | null;
    programId: string | null;
    errorMessage: string;
    logs: string[];
    transactionError: string | null;
  } {
    const errorMessage = error?.message || error?.toString() || "";
    const logs = error?.logs || [];

    // Check if it's a native Solana error
    const isSolanaError =
      errorMessage.includes("TransactionErrorInstructionError") ||
      errorMessage.includes("custom program error") ||
      logs.some(
        (log: string) =>
          log.includes("insufficient lamports") ||
          log.includes("Transfer: insufficient") ||
          log.includes("custom program error") ||
          log.includes("Program 11111111111111111111111111111111") // System Program
      );

    // Check for specific error types
    const isInsufficientFunds = logs.some(
      (log: string) =>
        log.includes("insufficient lamports") ||
        log.includes("insufficient funds") ||
        log.includes("Transfer: insufficient")
    );

    const isInvalidAccount = logs.some(
      (log: string) =>
        log.includes("invalid account") ||
        log.includes("account not found") ||
        log.includes("AccountNotFound")
    );

    const isCustomProgramError =
      errorMessage.includes("custom program error") ||
      logs.some((log: string) => log.includes("custom program error"));

    let customErrorCode: string | null = null;
    let programId: string | null = null;
    let transactionError: string | null = null;

    // Extract transaction error type
    const transactionErrorMatch = errorMessage.match(
      /TransactionErrorInstructionError[^}]*}/
    );
    if (transactionErrorMatch) {
      transactionError = transactionErrorMatch[0];
    }

    // Extract custom error code (e.g., "custom program error: 0x1")
    const customErrorMatch = errorMessage.match(
      /custom program error:\s*0x([0-9a-fA-F]+)/
    );
    if (customErrorMatch) {
      customErrorCode = customErrorMatch[1];
    }

    // Extract program ID from logs (first program that invoked)
    const programIdMatch = logs.find(
      (log: string) => log.includes("Program") && log.includes("invoke")
    );
    if (programIdMatch) {
      const programMatch = programIdMatch.match(
        /Program ([A-Za-z0-9]+) invoke/
      );
      if (programMatch) {
        programId = programMatch[1];
      }
    }

    return {
      isSolanaError,
      isInsufficientFunds,
      isInvalidAccount,
      isCustomProgramError,
      customErrorCode,
      programId,
      errorMessage,
      logs,
      transactionError,
    };
  }

  /**
   * Parse Anchor program errors
   * @param error - The caught error object
   * @returns Object with parsed Anchor error information
   */
  parseAnchorError(error: any): {
    isAnchorError: boolean;
    errorCode: string | null;
    errorName: string | null;
    programId: string | null;
    errorMessage: string;
    logs: string[];
  } {
    const errorMessage = error?.message || error?.toString() || "";
    const logs = error?.logs || [];

    // Check if it's an Anchor error (more specific patterns)
    const isAnchorError =
      errorMessage.includes("AnchorError") ||
      errorMessage.includes("Error Code:") ||
      errorMessage.includes("Error Number:") ||
      logs.some(
        (log: string) =>
          log.includes("AnchorError") ||
          log.includes("Error Code:") ||
          (log.includes("Error:") && !log.includes("custom program error"))
      );

    let errorCode: string | null = null;
    let errorName: string | null = null;
    let programId: string | null = null;

    // First try to extract from the structured error object (modern Anchor)
    if (error?.error?.errorCode?.code) {
      errorName = error.error.errorCode.code;
      errorCode = error.error.errorCode.number?.toString() || null;
    }

    // Fallback: Extract Anchor error code from message (e.g., "Error Code: Unauthorized")
    if (!errorName) {
      const errorCodeMatch = errorMessage.match(/Error Code:\s*([A-Za-z]+)/);
      if (errorCodeMatch) {
        errorName = errorCodeMatch[1];
      }
    }

    // Extract numeric error code (e.g., "Error Number: 6006")
    if (!errorCode) {
      const errorNumberMatch = errorMessage.match(/Error Number:\s*(\d+)/);
      if (errorNumberMatch) {
        errorCode = errorNumberMatch[1];
      }
    }

    // Extract program ID from logs (look for Anchor program patterns)
    const programIdMatch = logs.find(
      (log: string) =>
        log.includes("Program") &&
        log.includes("invoke") &&
        !log.includes("11111111111111111111111111111111") // Exclude System Program
    );
    if (programIdMatch) {
      const programMatch = programIdMatch.match(
        /Program ([A-Za-z0-9]+) invoke/
      );
      if (programMatch) {
        programId = programMatch[1];
      }
    }

    // Check for Anchor error patterns in logs as additional fallback
    if (!errorName) {
      for (const log of logs) {
        if (log.includes("Error Code:")) {
          const logErrorMatch = log.match(/Error Code:\s*([A-Za-z]+)/);
          if (logErrorMatch) {
            errorName = logErrorMatch[1];
            break;
          }
        }
      }
    }

    return {
      isAnchorError,
      errorCode,
      errorName,
      programId,
      errorMessage,
      logs,
    };
  }

  /**
   * Comprehensive error parser that handles signature, Solana native, and Anchor errors
   * @param error - The caught error object
   * @returns Combined error analysis
   */
  parseError(error: any): {
    signature: ReturnType<typeof this.parseSignatureError>;
    solana: ReturnType<typeof this.parseSolanaError>;
    anchor: ReturnType<typeof this.parseAnchorError>;
    isKnownError: boolean;
    summary: string;
  } {
    const signature = this.parseSignatureError(error);
    const solana = this.parseSolanaError(error);
    const anchor = this.parseAnchorError(error);

    const isKnownError =
      signature.isSignatureError ||
      solana.isSolanaError ||
      anchor.isAnchorError;

    let summary = "";
    if (signature.isSignatureError) {
      summary = `Signature Error: ${
        signature.missingSignatures.length > 0
          ? `Missing signatures for: ${signature.missingSignatures.join(", ")}`
          : "Signature verification failed"
      }`;
    } else if (solana.isInsufficientFunds) {
      // Extract the specific insufficient funds message from logs
      const insufficientLog = solana.logs.find(
        (log) =>
          log.includes("insufficient lamports") ||
          log.includes("Transfer: insufficient")
      );
      summary = `Insufficient Funds: ${
        insufficientLog || "Insufficient lamports for transaction"
      }`;
    } else if (solana.isSolanaError) {
      if (solana.isCustomProgramError) {
        summary = `Solana Program Error: Custom error code 0x${
          solana.customErrorCode || "unknown"
        }`;
      } else if (solana.isInvalidAccount) {
        summary = `Solana Error: Invalid account`;
      } else {
        summary = `Solana Error: ${
          solana.transactionError || "Unknown native error"
        }`;
      }
    } else if (anchor.isAnchorError) {
      summary = `Anchor Error: ${anchor.errorName || "Unknown"} (Code: ${
        anchor.errorCode || "Unknown"
      })`;
    } else {
      summary = `Unknown Error: ${
        error?.message || error?.toString() || "No message"
      }`;
    }

    return {
      signature,
      solana,
      anchor,
      isKnownError,
      summary,
    };
  }

  /**
   * Assert that an error is a signature verification error
   * @param error - The caught error
   * @param expectedMissingSignature - Optional specific public key that should be missing
   */
  assertSignatureError(error: any, expectedMissingSignature?: string): void {
    const parsed = this.parseSignatureError(error);

    if (!parsed.isSignatureError) {
      throw new Error(
        `Expected signature error, but got: ${parsed.errorMessage}`
      );
    }

    if (expectedMissingSignature) {
      const found = parsed.missingSignatures.some(
        (sig) =>
          sig === expectedMissingSignature ||
          sig.includes(expectedMissingSignature.slice(0, 8)) // Check first 8 chars
      );

      if (!found) {
        throw new Error(
          `Expected missing signature for ${expectedMissingSignature}, but missing signatures were: ${parsed.missingSignatures.join(
            ", "
          )}`
        );
      }
    }
  }

  /**
   * Assert that an error is an Anchor program error
   * @param error - The caught error
   * @param expectedErrorName - Expected error name (e.g., "UnauthorizedProgram")
   */
  assertAnchorError(error: any, expectedErrorName: string): void {
    const parsed = this.parseAnchorError(error);

    if (!parsed.isAnchorError) {
      throw new Error(`Expected Anchor error, but got: ${parsed.errorMessage}`);
    }

    if (expectedErrorName && parsed.errorName !== expectedErrorName) {
      throw new Error(
        `Expected Anchor error "${expectedErrorName}", but got "${parsed.errorName}"`
      );
    }
  }

  /**
   * Assert that an error is an insufficient funds error
   * @param error - The caught error
   */
  assertInsufficientFundsError(error: any): void {
    const parsed = this.parseSolanaError(error);

    if (!parsed.isInsufficientFunds) {
      throw new Error(
        `Expected insufficient funds error, but got: ${parsed.errorMessage}`
      );
    }
  }

  /**
   * Extract gas usage from a successful transaction
   */
  getTransactionGasUsage(signature: string): number | null {
    // For LiteSVM, we need to get transaction details
    const providerAny = this.provider as any;

    if (
      providerAny.client &&
      typeof providerAny.client.getTransaction === "function"
    ) {
      // LiteSVM case
      try {
        const tx = providerAny.client.getTransaction(signature);
        if (tx && tx.meta && tx.meta.computeUnitsConsumed) {
          return tx.meta.computeUnitsConsumed;
        }
      } catch (error) {
        console.warn("Failed to get transaction from LiteSVM:", error);
      }
    }

    // No fallback - return null if we can't get the actual gas usage
    return null;
  }

  async setup() {
    this.admin = (anchor.AnchorProvider.env().wallet as anchor.Wallet).payer;
    this.creator = new anchor.web3.Keypair();
    this.mandatorySigner = new anchor.web3.Keypair();
    this.webauthnModerator = new anchor.web3.Keypair();
    this.txPayer = new anchor.web3.Keypair();
    this.config = getConfigAccount();
    this.vaultConfig = getVaultConfigAccount();

    const workspacePath = path.resolve(__dirname, "../..");
    const computeBudget = new ComputeBudget();
    this.client = fromWorkspace(workspacePath).withComputeBudget(computeBudget);
    this.provider = new LiteSVMProvider(
      this.client,
      new anchor.Wallet(this.txPayer)
    );
    this.saProgram = new Program<SmartAccountSolana>(SA_IDL, this.provider);
    this.zkProgram = new Program<ZkEmailVerifier>(ZK_IDL, this.provider);
    this.vaultProgram = new Program<Vault>(VAULT_IDL, this.provider);
    this.upgradeMockProgram = new Program<UpgradeMock>(
      UPGRADE_MOCK_IDL,
      this.provider
    );
    this.dkimProgram = new Program<DkimKeyOracle>(DKIM_IDL, this.provider);

    [this.programData] = anchor.web3.PublicKey.findProgramAddressSync(
      [this.saProgram.programId.toBuffer()],
      UPGRADEABLE_LOADER_PROGRAM_ID
    );

    // add accounts to override
    let configData = mockConfigData(
      this.admin.publicKey,
      this.creator.publicKey,
      this.webauthnModerator.publicKey
    );

    let vaultConfigData = mockVaultConfigData(this.admin.publicKey, [
      SMART_ACCOUNT_SOLANA_PROGRAM_ID,
    ]);

    let dkimConfigData = mockDkimOracleConfigData(
      this.admin.publicKey,
      new anchor.BN(this.oracleTimelock)
    );

    let dkimEntryData = mockDkimOracleEntryData(this.domainHash, this.keyHash);

    //set initial features
    this.provider.client.withBuiltins(FeatureSet.allEnabled());
    this.provider.client.withSysvars();
    this.provider.client.withSplPrograms();
    this.provider.client.withPrecompiles(FeatureSet.allEnabled());

    //set accounts
    this.provider.client.setAccount(configData.address, configData.info);
    this.provider.client.setAccount(
      vaultConfigData.address,
      vaultConfigData.info
    );
    this.provider.client.setAccount(
      dkimConfigData.address,
      dkimConfigData.info
    );
    this.provider.client.setAccount(dkimEntryData.address, dkimEntryData.info);

    this.provider.client.airdrop(this.txPayer.publicKey, this.INITIAL_AIRDROP);
    this.provider.client.airdrop(this.creator.publicKey, this.INITIAL_AIRDROP);
    this.provider.client.airdrop(this.admin.publicKey, this.INITIAL_AIRDROP);
    this.provider.client.airdrop(
      this.webauthnModerator.publicKey,
      this.INITIAL_AIRDROP
    );

    //initialise webauthn table
    await this.createAndInitializeWebauthnTable();

    //initialise mint after airdrop
    await this.createTestSPL2022TokenMint();
    await this.createTestSPLTokenMint();

    const initialClock = this.provider.client.getClock();
    initialClock.unixTimestamp = BigInt(Math.floor(Date.now() / 1000));
    this.provider.client.setClock(initialClock);
  }

  async prepareUserIntent(tx: Transaction, helper: SmartAccountHelper) {
    const serializedIntent: number[] = [];

    const nonce = await helper.fetchNonce();
    serializedIntent.push(...toBytesUInt64(nonce.toNumber()));

    const deconstructedInstructions: {
      ixData: Buffer<ArrayBufferLike>;
      accountCount: number;
    }[] = [];
    const remainingAccounts: AccountMeta[] = [];

    let numSigners = 0;

    for (const ix of tx.instructions) {
      serializedIntent.push(...ix.data);

      const programIdAccountMeta = {
        pubkey: ix.programId,
        isSigner: false,
        isWritable: false,
      };

      [programIdAccountMeta, ...ix.keys].forEach((v) => {
        let isSigner = v.isSigner;
        let isWritable = v.isWritable;

        if (v.pubkey.equals(helper.vault)) {
          isSigner = false;
          isWritable = true;
        } else if (isSigner) {
          numSigners++;
        }

        serializedIntent.push(isSigner ? 1 : 0);
        serializedIntent.push(isWritable ? 1 : 0);
        serializedIntent.push(...v.pubkey.toBuffer());

        remainingAccounts.push({
          ...v,
          isSigner,
          isWritable,
        });
      });

      deconstructedInstructions.push({
        ixData: ix.data,
        accountCount: ix.keys.length + 1,
      });
    }

    return {
      serializedIntent,
      deconstructedInstructions,
      remainingAccounts,
      numSigners,
    };
  }

  async createAndInitializeWebauthnTable() {
    // Derive the WebAuthn table address
    [this.webauthnTable] = deriveWebAuthnTableAddress(0);

    // Initialize table
    await this.saProgram.methods
      .createWebauthnTable({ tableIndex: 0 })
      .accountsPartial({
        webauthnModerator: this.webauthnModerator.publicKey,
        webauthnTable: this.webauthnTable,
      })
      .signers([this.webauthnModerator])
      .rpc();

    // add pre_json (origin)
    await this.saProgram.methods
      .addWebauthnTableEntry({
        entry: { preJson: [PRE_JSON] },
      } as any)
      .accountsPartial({
        webauthnModerator: this.webauthnModerator.publicKey,
        webauthnTable: this.webauthnTable,
      })
      .signers([this.webauthnModerator])
      .rpc();

    // add post_json (android package name)
    await this.saProgram.methods
      .addWebauthnTableEntry({
        entry: { postJson: [POST_JSON] },
      } as any)
      .accountsPartial({
        webauthnModerator: this.webauthnModerator.publicKey,
        webauthnTable: this.webauthnTable,
      })
      .signers([this.webauthnModerator])
      .rpc();

    let authData = buildAuthData(ORIGIN);

    // add auth_data (rpId)
    await this.saProgram.methods
      .addWebauthnTableEntry({
        entry: { authData: [authData] },
      } as any)
      .accountsPartial({
        webauthnModerator: this.webauthnModerator.publicKey,
        webauthnTable: this.webauthnTable,
      })
      .signers([this.webauthnModerator])
      .rpc();

    //fetch and assert account state
    const webauthnTableAccount =
      await this.saProgram.account.webauthnTable.fetch(this.webauthnTable);
    expect(webauthnTableAccount.tableIndex).to.equal(0);
    expect(webauthnTableAccount.preJsonTable.length).to.equal(1);
    expect(webauthnTableAccount.postJsonTable.length).to.equal(1);
    expect(webauthnTableAccount.authDataTable.length).to.equal(1);
    expect(webauthnTableAccount.preJsonTable[0]).to.equal(PRE_JSON);
    expect(webauthnTableAccount.postJsonTable[0]).to.equal(POST_JSON);
    expect(
      Buffer.from(webauthnTableAccount.authDataTable[0]).toString("hex")
    ).to.equal(Buffer.from(authData).toString("hex"));
  }
  // async prepareMigrationIntent(
  //   migrateIx: anchor.web3.TransactionInstruction,
  //   helper: SmartAccountHelper
  // ) {
  //   const serializedIntent: number[] = [];

  //   const nonce = await helper.fetchNonce();
  //   serializedIntent.push(...toBytesUInt64(nonce));

  //   serializedIntent.push(...migrateIx.data);
  //   serializedIntent.push(...migrateIx.programId.toBytes());

  //   return serializedIntent;
  // }
}
