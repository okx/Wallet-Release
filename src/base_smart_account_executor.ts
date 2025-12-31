#!/usr/bin/env tsx
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  VersionedTransaction,
  TransactionMessage,
  TransactionInstruction,
} from "@solana/web3.js";
import { loadEnv } from "./helpers/setup";
import { loadKeyFromEnv } from "./helpers/key-loader";
import { SmartAccountHelper } from "./tests/utils/smartAccount/helpers";
import {
  generateIdFromString,
  getLookupTableAccounts,
} from "./tests/utils/helpers";
import { LOOKUP_TABLE_ADDRESS } from "./consts";

export interface ExecutionResult {
  txSignature: string;
  [key: string]: any; // Allow additional protocol-specific data
}

export class BaseSmartAccountExecutor {
  public provider: anchor.AnchorProvider;
  protected saProgram: any; // Using any to avoid complex typing issues
  protected vaultProgram: any; // Using any to avoid complex typing issues
  public smartAccountHelper: SmartAccountHelper;
  public payerInfo: any;
  protected mandatorySignerInfo: any;
  protected lookupTableAddress: PublicKey;

  constructor(protected saId: string) {
    console.log("🔍 BaseSmartAccountExecutor constructor starting...");
    console.log("🔍 saId:", saId);

    this.validateEnvironment();

    this.setupProvider();

    this.loadKeys();
    
    this.setupSmartAccount();

    this.loadLookupTableFromEnv();
  }

  private validateEnvironment(): void {
    if (!this.saId) {
      throw new Error("SOL_DEXTRADING_ADDRESS environment variable is required");
    }
  }

  private setupProvider(): void {
    const env = loadEnv();
    this.saProgram = env.saProgram;
    this.vaultProgram = env.vaultProgram;
    this.provider = anchor.getProvider() as anchor.AnchorProvider;
  }

  private loadKeys(): void {
    // const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
    // this.mandatorySignerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");
    // this.payerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");
    this.mandatorySignerInfo = loadKeyFromEnv("SOL_EOA_PRIVATE_KEY");
    this.payerInfo = loadKeyFromEnv("SOL_EOA_PRIVATE_KEY");

    // if (r1KeyInfo.type !== "r1") {
    //   throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
    // }
    if (this.mandatorySignerInfo.type !== "solana") {
      throw new Error(
        "Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY"
      );
    }
    if (this.payerInfo.type !== "solana") {
      throw new Error("Expected Solana key type for SOL_EOA_PRIVATE_KEY");
    }
  }

  private setupSmartAccount(): void {
    const id = this.saId;

    // Parse sa_id as hex string if it's a hex string, otherwise treat as regular string
    let idBuffer: Buffer;
    if (id.length === 64 && /^[0-9a-fA-F]+$/.test(id)) {
      // 64-character hex string (32 bytes)
      idBuffer = Buffer.from(id, "hex");
    } else {
      // Regular string
      idBuffer = generateIdFromString(id);
    }

    this.smartAccountHelper = SmartAccountHelper.createWithEnvKeys(
      idBuffer,
      this.saProgram,
      null,
      null
    );
  }

  protected logSetupInfo(): void {
    console.log(`Smart Account ID: ${this.saId}`);
    console.log(`📍 Smart Account: ${this.smartAccountHelper.sa.toBase58()}`);
    console.log(
      `🏦 Smart Account Vault: ${this.smartAccountHelper.vault.toBase58()}`
    );
  }

  protected async executeTransaction(
    instructions: TransactionInstruction[],
    description: string,
    lookupTableAddresses?: PublicKey[],
    additionalSigners?: anchor.web3.Keypair[],
    tokenAmount?: number,
    recipientPubKey?: PublicKey,
    assetType?: string
  ): Promise<ExecutionResult> {
    console.log(`Executing ${description}...`);

    // Create transaction with protocol instructions
    const tx = new Transaction();

    // If recipientPubKey is NOT the payer, add the instructions to the transaction
    if (assetType === "SPL Token" || recipientPubKey.toBase58() != this.payerInfo.keyObject.publicKey.toBase58()) {
      instructions.forEach((ix) => tx.add(ix));
      tokenAmount = 0;
    }

    // Prepare user intent
    const { deconstructedInstructions, remainingAccounts } =
      await this.smartAccountHelper.prepareUserIntent(tx, {
        tokenAmount: tokenAmount,
      });

    // Execute transaction
    const executeTx = await this.saProgram.methods
      .validateExecution(null, null, null, new anchor.BN(tokenAmount), null)
      .accounts({
        txPayer: this.payerInfo.keyObject.publicKey,
        solanaSigner: this.mandatorySignerInfo.keyObject.publicKey,
        smartAccount: this.smartAccountHelper.sa,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        vaultProgram: this.vaultProgram.programId,
        vaultState: this.smartAccountHelper.vaultState,
        smartAccountVault: this.smartAccountHelper.vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        webauthnTable: null,
        vaultTokenAccount: null,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
        nonceAccount: null,
      }).postInstructions([
        await this.vaultProgram.methods
          .executeBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: this.smartAccountHelper.vaultState,
            smartAccountVault: this.smartAccountHelper.vault,
          })
          .remainingAccounts(remainingAccounts)
          .instruction(),
      ])
      .transaction();

    // Set recent blockhash
    let latestBlockhash = await this.provider.connection.getLatestBlockhash();

    // Convert to v0 transaction
    const messageV0 = new TransactionMessage({
      payerKey: this.payerInfo.keyObject.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: executeTx.instructions,
    }).compileToV0Message();

    const v0Transaction = new VersionedTransaction(messageV0);

    // Sign with payer and any additional signers
    const signers = [
      this.payerInfo.keyObject,
      this.mandatorySignerInfo.keyObject,
    ];
    if (additionalSigners && additionalSigners.length > 0) {
      signers.push(...additionalSigners);
    }
    v0Transaction.sign(signers);

    // Log transaction size
    const serializedTx = v0Transaction.serialize();
    console.log(`📏 Final v0 transaction size: ${serializedTx.length} bytes`);

    // Simulate transaction before sending
    console.log("🔍 Simulating transaction...");

    const simulationResult = await this.provider.connection.simulateTransaction(v0Transaction, {
      sigVerify: false,
      replaceRecentBlockhash: true,
      commitment: "processed",
    });
    // console.log("🔍 Simulation result:", simulationResult);

    // Execute transaction
    const txSignature = await this.provider.connection.sendTransaction(
      v0Transaction,
      {
        preflightCommitment: "processed",
        skipPreflight: true,
      }
    );

    console.log(`✅ Transaction sent: ${txSignature}`);

    return {
      txSignature,
    };
  }

  // Main execution method - now accepts instructions directly
  async execute(
    instructions: TransactionInstruction[],
    description: string,
    lookupTableAddresses?: PublicKey[],
    additionalSigners?: anchor.web3.Keypair[],
    tokenAmount?: number,
    recipientPubKey?: PublicKey,
    assetType?: string
  ): Promise<ExecutionResult> {
    try {
      this.logSetupInfo();
      return await this.executeTransaction(
        instructions,
        description,
        lookupTableAddresses,
        additionalSigners,
        tokenAmount,
        recipientPubKey,
        assetType
      );
    } catch (error) {
      console.error("Transaction execution failed:");
      console.error("Error details:", error);

      if (error.logs) {
        console.error("Transaction logs:");
        error.logs.forEach((log: string, index: number) => {
          console.error(`  ${index}: ${log}`);
        });
      }

      throw error;
    }
  }

  private loadLookupTableFromEnv(): void {
    if (LOOKUP_TABLE_ADDRESS) {
      this.lookupTableAddress = new PublicKey(LOOKUP_TABLE_ADDRESS);
      console.log(
        "📋 Loaded lookup table from env:",
        this.lookupTableAddress.toBase58()
      );
    } else {
      console.log(
        "⚠️  No LOOKUP_TABLE_ADDRESS found in environment. Run setup-lookup-table.ts first."
      );
    }
  }
}