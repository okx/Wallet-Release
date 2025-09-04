#!/usr/bin/env tsx
import * as anchor from "@coral-xyz/anchor";
import {
  PublicKey,
  Transaction,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import { loadEnv } from "../../../helpers/setup";
import { loadKeyFromEnv } from "../../../helpers/key-loader";
import { SmartAccountHelper } from "../../../tests/utils/smartAccount/helpers";
import {
  deriveWebAuthnTableAddress,
  generateIdFromString,
  getLookupTableAccounts,
} from "../../../tests/utils/helpers";
import { createSecp256r1Instruction } from "../../../tests/utils/r1-utils";
import { simulateBatchExecution } from "../../utils";
import { WebAuthnAuthDataHelpers } from "../../../tests/utils/webauthn";
import { WebAuthnStringHelpers } from "../../../tests/utils/webauthn";
import { WEB_AUTHN_TABLE_SEED } from "../../../tests/utils/consts";
export interface ExecutionResult {
  txSignature: string;
  optimization?: any;
  [key: string]: any;
}

export class BaseSmartAccountHelper {
  public provider: anchor.AnchorProvider;
  protected saProgram: any;
  protected vaultProgram: any;
  public smartAccountHelper: SmartAccountHelper;
  protected payerInfo: any;
  protected r1KeyInfo: any;
  protected mandatorySignerInfo: any;
  protected useComputeBudgetOptimization: boolean;
  protected lookupTableAddress: PublicKey;

  // Public getter for payer public key
  public get payerPublicKey(): PublicKey {
    return this.payerInfo.keyObject.publicKey;
  }

  constructor(
    protected saId: string,
    useComputeBudgetOptimization: boolean = false
  ) {
    this.useComputeBudgetOptimization = useComputeBudgetOptimization;
    this.validateEnvironment();
    this.setupProvider();
    this.loadKeys();
    this.setupSmartAccount();
    this.loadLookupTableFromEnv();
  }

  private validateEnvironment(): void {
    if (!this.saId) {
      throw new Error("SA_ID environment variable is required");
    }
  }

  private setupProvider(): void {
    const env = loadEnv();
    this.saProgram = env.saProgram;
    this.vaultProgram = env.vaultProgram;
    this.provider = anchor.getProvider() as anchor.AnchorProvider;
  }

  private loadKeys(): void {
    this.r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
    this.mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");
    this.payerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

    if (this.r1KeyInfo.type !== "r1") {
      throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
    }
    if (this.mandatorySignerInfo.type !== "solana") {
      throw new Error(
        "Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY"
      );
    }
    if (this.payerInfo.type !== "solana") {
      throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
    }
  }

  private setupSmartAccount(): void {
    const id = this.saId;

    // Parse SA_ID as hex string if it's a hex string, otherwise treat as regular string
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
      this.r1KeyInfo.keyObject,
      this.mandatorySignerInfo.keyObject
    );

    console.log("smartAccount:", this.smartAccountHelper.sa.toBase58());
  }

  private loadLookupTableFromEnv(): void {
    if (process.env.LOOKUP_TABLE_ADDRESS) {
      this.lookupTableAddress = new PublicKey(process.env.LOOKUP_TABLE_ADDRESS);
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

  protected async executeTransaction(
    instructions: TransactionInstruction[],
    description: string,
    lookupTableAddresses?: PublicKey[],
    additionalSigners?: anchor.web3.Keypair[]
  ): Promise<ExecutionResult> {
    console.log(`Executing ${description}...`);
    let [webauthnTable] = deriveWebAuthnTableAddress(0);

    const tx = new Transaction();
    instructions.forEach((ix) => tx.add(ix));

    let optimization;
    if (this.useComputeBudgetOptimization) {
      optimization = await simulateBatchExecution(
        this.saProgram,
        this.vaultProgram,
        this.provider,
        this.smartAccountHelper,
        tx,
        true
      );
    }

    let computeBudgetInstructions: anchor.web3.TransactionInstruction[] = [];
    if (optimization) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: optimization.optimalComputeUnits,
        });
      const computePriceIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
          microLamports: 1000,
        });
      computeBudgetInstructions = [computeBudgetIx, computePriceIx];
    }

    const {
      serializedIntent,
      deconstructedInstructions,
      remainingAccounts,
      numSigners,
    } = await this.smartAccountHelper.prepareUserIntent(tx, {
      tokenAmount: 0,
    });

    const [message, signature, authData] = this.smartAccountHelper.signIntent(
      Uint8Array.from(serializedIntent)
    );

    const preInstructions: anchor.web3.TransactionInstruction[] = [
      ...computeBudgetInstructions,
    ];
    const executeTx = await this.saProgram.methods
      .validateExecution(
        {
          clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
          authData: WebAuthnAuthDataHelpers.Index(0),
        } as any,
        new anchor.BN(0),
        null
      )
      .accountsPartial({
        txPayer: this.payerInfo.keyObject.publicKey,
        smartAccount: this.smartAccountHelper.sa,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        vaultProgram: this.vaultProgram.programId,
        vaultState: this.smartAccountHelper.vaultState,
        smartAccountVault: this.smartAccountHelper.vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        webauthnTable: webauthnTable,
        mandatorySigner: null,
        vaultTokenAccount: null,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
      })
      .preInstructions(preInstructions)
      .postInstructions([
        createSecp256r1Instruction(
          message,
          this.smartAccountHelper.getPasskeyPubkey(),
          signature
        ),
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
      .signers([this.payerInfo.keyObject])
      .transaction();

    let lookupTableAccounts: anchor.web3.AddressLookupTableAccount[] = [];
    // Get lookup table accounts if provided
    let updatedLookupTableAddresses: PublicKey[] = [this.lookupTableAddress];
    if (lookupTableAddresses && lookupTableAddresses.length > 0) {
      updatedLookupTableAddresses = [...lookupTableAddresses];
      updatedLookupTableAddresses.push(this.lookupTableAddress);
    }

    lookupTableAccounts = await getLookupTableAccounts(
      this.provider.connection,
      updatedLookupTableAddresses
    );

    // Set recent blockhash
    let latestBlockhash = await this.provider.connection.getLatestBlockhash();

    // Convert to v0 transaction
    const messageV0 = new TransactionMessage({
      payerKey: this.payerInfo.keyObject.publicKey,
      recentBlockhash: latestBlockhash.blockhash,
      instructions: executeTx.instructions,
    }).compileToV0Message(lookupTableAccounts);

    const v0Transaction = new VersionedTransaction(messageV0);

    // Sign with payer and any additional signers
    const signers = [this.payerInfo.keyObject];
    if (additionalSigners && additionalSigners.length > 0) {
      signers.push(...additionalSigners);
    }
    v0Transaction.sign(signers);

    // Log transaction size
    const serializedTx = v0Transaction.serialize();
    console.log(`📏 Final v0 transaction size: ${serializedTx.length} bytes`);

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
      optimization,
    };
  }

  async execute(
    instructions: TransactionInstruction[],
    description: string,
    lookupTableAddresses?: PublicKey[],
    additionalSigners?: anchor.web3.Keypair[]
  ): Promise<ExecutionResult> {
    try {
      return await this.executeTransaction(
        instructions,
        description,
        lookupTableAddresses,
        additionalSigners
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
}
