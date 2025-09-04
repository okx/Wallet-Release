import * as anchor from "@coral-xyz/anchor";
import {
  SMART_ACCOUNT_SEED,
  SMART_ACCOUNT_VAULT_SEED,
  VAULT_PROGRAM_ID,
  VAULT_STATE_SEED,
  ORIGIN,
  ANDROID_PACKAGE_NAME,
  PRE_JSON,
  POST_JSON,
} from "../consts";
import { SMART_ACCOUNT_SOLANA_PROGRAM_ID } from "../consts";
import { SmartAccountSolana } from "../../../../target/types/smart_account_solana";
import { FailedTransactionMetadata, LiteSVM } from "litesvm";
import { ethers } from "ethers";
import { buildAuthData, buildWebauthnMessage } from "../webauthn";
import { TestR1KeyHelper } from "../../../helpers/r1-test-helper";
import { keccak_256 } from "@noble/hashes/sha3";
import { generateIdFromString } from "../helpers";
import { TestBase } from "../testBase";

export interface DeconstructedInstruction {
  ixData: Buffer;
  accountCount: number;
}

export interface BatchExecutionOptions {
  vaultProgram: any;
  provider: anchor.AnchorProvider;
  payer: anchor.web3.Keypair;

  // Optional optimization
  useAddressLookupTable?: boolean;
  additionalLookupAccounts?: anchor.web3.PublicKey[];

  // Optional validation - bypass smart account validation
  bypassSmartAccountValidation?: boolean;
  skipValidation?: boolean;

  // Simulation mode - uses simulate instruction instead of execute_batch
  isSimulation?: boolean;

  // Compute units to allocate for the transaction
  computeUnits?: number;
}

export interface BatchExecutionResult {
  versionedTransaction: anchor.web3.VersionedTransaction;
  transactionSize: number;
}

// TypeScript interfaces matching Rust structs for general account creation
export interface GeneralPasskey {
  pubkey: number[]; // [u8; 32]
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

export interface GeneralSolanaKey {
  pubkey: anchor.web3.PublicKey; // Pubkey
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

export type SmartAccountType =
  | { payWallet: {} }
  | { easyWallet: {} }
  | { ceDeFiWallet: {} };

export interface CreateGeneralAccountArgs {
  userPasskey: GeneralPasskey;
  initialSolanaSigner: GeneralSolanaKey | null;
  initialRecoverySigner: anchor.web3.PublicKey;
  accountType: SmartAccountType;
  salt: number[]; // [u8; 32]
}

/**
 * Serialize CreateGeneralAccountArgs exactly as the Rust program does
 * This is used both for ID generation and message signing
 */
export function serializeCreateGeneralAccountArgs(
  args: CreateGeneralAccountArgs
): Buffer {
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

  // Add initial_recovery_signer (Pubkey)
  chunks.push(Buffer.from(args.initialRecoverySigner.toBytes()));

  // Add account_type (1 byte for enum discriminant)
  // SmartAccountType: PayWallet=0, EasyWallet=1, CeDeFiWallet=2
  let accountTypeDiscriminant: number;
  if ("payWallet" in args.accountType) {
    accountTypeDiscriminant = 0;
  } else if ("easyWallet" in args.accountType) {
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
  return Buffer.concat(chunks);
}

/**
 * Generate account ID by serializing args and hashing with keccak256
 * This replicates the Rust generate_id() function exactly
 */
export function generateGeneralAccountId(
  args: CreateGeneralAccountArgs
): number[] {
  const serialized = serializeCreateGeneralAccountArgs(args);
  // Hash with keccak256
  const hash = keccak_256(serialized);
  return Array.from(hash);
}

export class SmartAccountHelper {
  id: Buffer<ArrayBufferLike>;
  passkeyKeypair: TestR1KeyHelper;
  mandatorySigner: anchor.web3.Keypair;
  recoverySigners: anchor.web3.Keypair[];
  sa: anchor.web3.PublicKey;
  vault: anchor.web3.PublicKey;
  vaultState: anchor.web3.PublicKey;
  saProgram: anchor.Program<SmartAccountSolana>;
  validFrom: anchor.BN;
  validUntil: anchor.BN;
  ORIGIN: string = ORIGIN;
  ANDROID_PACKAGE_NAME: string = ANDROID_PACKAGE_NAME;
  PRE_JSON: string = PRE_JSON;
  POST_JSON: string = POST_JSON;
  AUTH_DATA: Buffer<ArrayBufferLike>;

  constructor(
    id: Buffer<ArrayBufferLike>,
    mandatorySigner: anchor.web3.Keypair | undefined,
    saProgram: anchor.Program<SmartAccountSolana>,
    initialRecoverySigner: anchor.web3.Keypair = anchor.web3.Keypair.generate(),
    validFrom?: anchor.BN,
    validUntil?: anchor.BN,
    passkeyKeypair?: any
  ) {
    this.id = id;
    this.saProgram = saProgram;
    this.recoverySigners = [initialRecoverySigner];

    // Generate mandatory signer if not provided
    this.mandatorySigner = mandatorySigner || anchor.web3.Keypair.generate();

    // Handle R1 keypair - ensure it's always a TestR1KeyHelper
    if (passkeyKeypair) {
      if (passkeyKeypair instanceof TestR1KeyHelper) {
        // Already a TestR1KeyHelper
        this.passkeyKeypair = passkeyKeypair;
      } else if (passkeyKeypair.encodePrivateKey) {
        // Raw ec-pem key object - convert to TestR1KeyHelper
        const pemString = passkeyKeypair.encodePrivateKey();
        this.passkeyKeypair = new TestR1KeyHelper(pemString);
      } else {
        // Try to use as-is if it already has the required methods
        if (passkeyKeypair.getPublicKey && passkeyKeypair.sign) {
          this.passkeyKeypair = passkeyKeypair;
        } else {
          throw new Error(
            "Invalid passkeyKeypair format. Expected TestR1KeyHelper or raw ec-pem object with encodePrivateKey method"
          );
        }
      }
    } else {
      // Generate new R1 keypair
      const ecPem = require("ec-pem");
      const rawKey = ecPem(null, "prime256v1");
      rawKey.generateKeys();
      const pemString = rawKey.encodePrivateKey();
      this.passkeyKeypair = new TestR1KeyHelper(pemString);
    }

    // Set default validity period if not provided
    const now = Math.floor((Date.now() - 1000) / 1000);
    this.validFrom = validFrom ? validFrom : new anchor.BN(now);
    this.validUntil = validUntil
      ? validUntil
      : new anchor.BN(now + 365 * 24 * 60 * 60); // Default 1 year validity

    [this.sa] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SMART_ACCOUNT_SEED), this.id],
      SMART_ACCOUNT_SOLANA_PROGRAM_ID
    );
    this.vault = this.getVaultPda();
    this.vaultState = this.getVaultStatePda();
    this.AUTH_DATA = buildAuthData(this.ORIGIN);
  }

  /**
   * Create SmartAccountHelper with keys from environment
   */
  public static createWithEnvKeys(
    id: Buffer<ArrayBufferLike>,
    saProgram: anchor.Program<SmartAccountSolana>,
    r1KeyObject?: any,
    mandatorySignerKeypair?: anchor.web3.Keypair,
    validFrom?: anchor.BN,
    validUntil?: anchor.BN
  ): SmartAccountHelper {
    // Handle R1KeyInfo objects from key-loader by extracting the raw keyObject
    let actualR1Key = r1KeyObject;
    if (r1KeyObject && r1KeyObject.type === "r1" && r1KeyObject.keyObject) {
      actualR1Key = r1KeyObject.keyObject; // Extract the raw ec-pem key
    }

    return new SmartAccountHelper(
      id,
      mandatorySignerKeypair,
      saProgram,
      mandatorySignerKeypair, // mocking as recovery signer
      validFrom,
      validUntil,
      actualR1Key // Pass the raw key object
    );
  }

  /**
   * Create a new smart account helper for general account
   */
  public static createWithGeneralAccount(
    testBase: TestBase,
    idSeed: string,
    emailSeed: string
  ): SmartAccountHelper {
    const dummyHelper = new SmartAccountHelper(
      generateIdFromString(idSeed),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    const now = Math.floor(Date.now() / 1000);
    const validFrom = new anchor.BN(now);
    const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60); // 1 year
    const salt = new Uint8Array(32); // Zero salt

    // Set up SA helper
    const createArgs: CreateGeneralAccountArgs = {
      userPasskey: {
        pubkey: Array.from(dummyHelper.getPasskeyPubkey()),
        validFrom,
        validUntil,
      },
      initialSolanaSigner: {
        pubkey: testBase.mandatorySigner.publicKey,
        validFrom,
        validUntil,
      },
      initialRecoverySigner: dummyHelper.recoverySigners[0].publicKey,
      accountType: { easyWallet: {} },
      salt: Array.from(salt),
    };

    const generatedId = generateGeneralAccountId(createArgs);

    return new SmartAccountHelper(
      Buffer.from(generatedId),
      testBase.mandatorySigner,
      testBase.saProgram,
      dummyHelper.recoverySigners[0],
      validFrom,
      validUntil,
      dummyHelper.passkeyKeypair
    );
  }

  /**
   * Prepare user intent for execution
   * Creates serialized intent and deconstructed instructions for vault execution
   */
  public async prepareUserIntent(
    tx: anchor.web3.Transaction,
    tokenPaymentArgs: {
      tokenMint?: anchor.web3.PublicKey;
      tokenAmount: number;
    },
    computeBudgetInstructions?: anchor.web3.TransactionInstruction[],
    nonce?: anchor.BN,
    setVaultToMutable: boolean = true
  ): Promise<{
    serializedIntent: number[];
    deconstructedInstructions: DeconstructedInstruction[];
    remainingAccounts: anchor.web3.AccountMeta[];
    numSigners: number;
  }> {
    const serializedIntent: number[] = [];
    nonce = nonce ? nonce : await this.fetchNonce();
    serializedIntent.push(...this.toBytesUInt64(nonce.toNumber()));

    if (tokenPaymentArgs) {
      serializedIntent.push(
        ...this.toBytesUInt64(tokenPaymentArgs.tokenAmount)
      );
      serializedIntent.push(tokenPaymentArgs.tokenMint ? 1 : 0);
      if (tokenPaymentArgs.tokenMint) {
        serializedIntent.push(...tokenPaymentArgs.tokenMint.toBytes());
      }
    }

    // Include compute budget instructions in the intent hash if provided
    // This matches the contract's format: [nonce, compute_budget_ixs..., vault_ix]
    if (computeBudgetInstructions && computeBudgetInstructions.length > 0) {
      for (const computeIx of computeBudgetInstructions) {
        // Serialize compute budget instruction data
        serializedIntent.push(...computeIx.data);

        // Serialize program ID
        serializedIntent.push(...computeIx.programId.toBytes());

        // Serialize accounts (compute budget instructions typically have no accounts)
        computeIx.keys.forEach((acc) => {
          serializedIntent.push(acc.isSigner ? 1 : 0);
          serializedIntent.push(acc.isWritable ? 1 : 0);
          serializedIntent.push(...acc.pubkey.toBytes());
        });
      }
    }

    const deconstructedInstructions: DeconstructedInstruction[] = [];
    const remainingAccounts: anchor.web3.AccountMeta[] = [];

    let numSigners = 0;

    const lastSeenAccountMeta = new Map<string, anchor.web3.AccountMeta>();

    const allAccountMetas = tx.instructions.flatMap((ix) => ix.keys);

    allAccountMetas.forEach((v) => {
      let isSigner = v.isSigner;
      let isWritable = v.isWritable;

      if (v.pubkey.equals(this.vault)) {
        isSigner = false;
        isWritable = setVaultToMutable ? true : isWritable;
      }

      const keyLastSeen = lastSeenAccountMeta.get(v.pubkey.toString());
      if (keyLastSeen) {
        isSigner = keyLastSeen.isSigner || isSigner;
        isWritable = keyLastSeen.isWritable || isWritable;
      }

      lastSeenAccountMeta.set(v.pubkey.toString(), {
        ...v,
        isSigner,
        isWritable,
      });
    });

    lastSeenAccountMeta.forEach((v) => {
      if (v.isSigner) {
        numSigners++;
      }
    });

    for (const ix of tx.instructions) {
      serializedIntent.push(...ix.data);

      const programIdAccountMeta = {
        pubkey: ix.programId,
        isSigner: false,
        isWritable: false,
      };

      [programIdAccountMeta, ...ix.keys].forEach((v) => {
        let isSigner = lastSeenAccountMeta.get(v.pubkey.toString())?.isSigner;
        let isWritable = lastSeenAccountMeta.get(
          v.pubkey.toString()
        )?.isWritable;

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

  public async prepareOptimisticValidationIntent(
    tx: anchor.web3.Transaction,
    tokenPaymentArgs: {
      tokenMint?: anchor.web3.PublicKey;
      tokenAmount: number;
    },
    maxSlot: number,
    txPayer: anchor.web3.PublicKey
  ) {
    const {
      serializedIntent: serializedTx,
      deconstructedInstructions,
      remainingAccounts,
      numSigners,
    } = await this.prepareUserIntent(tx, null, null, null, false);

    const hashBytes = Buffer.from(
      ethers.toBeArray(ethers.keccak256(Uint8Array.from(serializedTx)))
    );

    const validationArgs = {
      tokenAmount: new anchor.BN(tokenPaymentArgs.tokenAmount),
      maxSlot: new anchor.BN(maxSlot),
      targetHash: Array.from(hashBytes),
    };

    const serializedArgs = this.saProgram.coder.types.encode(
      "optimisticValidationArgs",
      validationArgs
    );

    const serializedMessage: number[] = [
      ...serializedArgs,
      tokenPaymentArgs.tokenMint ? 1 : 0,
      ...(tokenPaymentArgs.tokenMint?.toBuffer() ?? []),
      ...txPayer.toBuffer(),
    ];

    return {
      serializedMessage,
      deconstructedInstructions,
      remainingAccounts,
      numSigners,
      validationArgs,
      hashBytes,
    };
  }

  /**
   * Convert number to 4-byte little-endian array
   */
  public toBytesUInt32(value: number): number[] {
    const buffer = Buffer.allocUnsafe(4);
    buffer.writeUInt32LE(value, 0);
    return Array.from(buffer);
  }

  /**
   * Convert number to 8-byte little-endian array (for u64)
   */
  public toBytesUInt64(value: number): number[] {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigUInt64LE(BigInt(value), 0);
    return Array.from(buffer);
  }

  public toBytesInt64(value: bigint): number[] {
    const buffer = Buffer.allocUnsafe(8);
    buffer.writeBigInt64LE(value, 0);
    return Array.from(buffer);
  }

  public getId(): number[] {
    return Array.from(this.id);
  }

  public getPasskey(): any {
    return {
      pubkey: this.getPasskeyPubkey(),
      validFrom: this.validFrom,
      validUntil: this.validUntil,
    };
  }
  public getPasskeyPubkey(): any {
    // Get compressed public key from ec-pem (33 bytes)
    const publicKeyHex = this.passkeyKeypair.getPublicKey("hex", "compressed");
    const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");

    return publicKeyBuffer;
  }

  public getMandatorySignerPubkey(): anchor.web3.PublicKey {
    return this.mandatorySigner.publicKey;
  }

  public signIntent(
    intent: Uint8Array,
    toHash: boolean = true
  ): [
    message: Buffer<ArrayBufferLike>,
    signature: Buffer<ArrayBufferLike>,
    authData: Buffer<ArrayBufferLike>,
    clientJson: string,
  ] {
    const hashBytes = toHash
      ? Buffer.from(ethers.toBeArray(ethers.keccak256(intent)))
      : Buffer.from(intent);

    const challenge = hashBytes.toString("base64url");
    const { message, authData, clientJson } = buildWebauthnMessage(
      challenge,
      this.ORIGIN,
      this.ANDROID_PACKAGE_NAME
    );
    return [message, this.signPasskey(message), authData, clientJson];
  }

  public signPasskey(message: Buffer<ArrayBufferLike>): any {
    return this.passkeyKeypair.sign(message);
  }

  public async fetchNonce() {
    const sa = await this.saProgram.account.smartAccount.fetch(this.sa);
    return sa.nonce;
  }

  /**
   * Get the smart account vault PDA for this smart account
   */
  public getVaultPda(): anchor.web3.PublicKey {
    const [vaultPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(SMART_ACCOUNT_VAULT_SEED), this.id],
      VAULT_PROGRAM_ID
    );
    return vaultPda;
  }

  /**
   * Get the vault state PDA for this smart account
   */
  public getVaultStatePda(): anchor.web3.PublicKey {
    const [vaultStatePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_STATE_SEED), this.id],
      VAULT_PROGRAM_ID
    );
    return vaultStatePda;
  }

  /**
   * Execute a batch of instructions using this smart account
   * Returns a versioned transaction ready for submission
   */
  public async executeBatch(
    instructions: anchor.web3.TransactionInstruction[],
    options: BatchExecutionOptions,
    signers: anchor.web3.Keypair[] = []
  ): Promise<BatchExecutionResult> {
    const {
      vaultProgram,
      provider,
      payer,
      useAddressLookupTable = true,
      additionalLookupAccounts = [],
      bypassSmartAccountValidation = true, // Default to bypass for LiteSVM
      skipValidation = false,
      isSimulation = false,
      computeUnits,
    } = options;

    // Convert instructions to deconstructed format
    const deconstructedInstructions =
      this.convertToDeconstructedInstructions(instructions);

    // Set up remaining accounts for batch execution
    const remainingAccounts = this.setupRemainingAccounts(
      instructions,
      this.vault
    );

    // Create address lookup table if requested
    let lookupTableAccount: anchor.web3.AddressLookupTableAccount | null = null;
    if (useAddressLookupTable) {
      lookupTableAccount = await this.createAddressLookupTable(
        provider,
        payer,
        [
          this.sa,
          this.vault,
          this.vaultState,
          VAULT_PROGRAM_ID,
          SMART_ACCOUNT_SOLANA_PROGRAM_ID,
          anchor.web3.SystemProgram.programId,
          ...additionalLookupAccounts,
        ]
      );
    }

    // Build transaction instructions
    const txInstructions: anchor.web3.TransactionInstruction[] = [];

    // Add compute budget instruction if specified
    if (computeUnits && computeUnits > 0) {
      const computeBudgetIx =
        anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
          units: computeUnits,
        });
      txInstructions.push(computeBudgetIx);
    }

    // Add validation instruction - either through smart account or directly to vault
    if (!skipValidation) {
      if (bypassSmartAccountValidation) {
        // Direct vault approval - bypass smart account validation
        const approveInstruction = await vaultProgram.methods
          .approveExecution()
          .accountsPartial({
            vaultState: this.vaultState,
            smartAccount: this.sa,
          })
          .instruction();

        txInstructions.push(approveInstruction);
      } else {
        // Traditional flow through smart account program (if validate_batch_execution exists)
        // This would typically call the smart account program's validate_batch_execution
        // which then calls the vault's approve_execution
        throw new Error(
          "Smart account validation not yet implemented. Use bypassSmartAccountValidation: true"
        );
      }
    }

    // Add execution instruction - either simulate or execute_batch
    let executionInstruction;
    if (isSimulation) {
      // Use simulate instruction
      executionInstruction = await vaultProgram.methods
        .simulateBatch({
          deconstructedInstructions,
        })
        .accountsPartial({
          vaultState: this.vaultState,
          smartAccountVault: this.vault,
        })
        .remainingAccounts(remainingAccounts)
        .instruction();
    } else {
      // Use regular execute_batch instruction
      executionInstruction = await vaultProgram.methods
        .executeBatch({
          deconstructedInstructions,
        })
        .accountsPartial({
          vaultState: this.vaultState,
          smartAccountVault: this.vault,
        })
        .remainingAccounts(remainingAccounts)
        .instruction();
    }

    txInstructions.push(executionInstruction);

    // Create versioned transaction (don't submit)
    const result = await this.createVersionedTransaction(
      provider,
      txInstructions,
      [payer, ...signers], // Only payer signs - mandatory signer is for validation only
      lookupTableAccount
    );

    return result;
  }

  /**
   * Convert regular instructions to deconstructed format
   */
  private convertToDeconstructedInstructions(
    instructions: anchor.web3.TransactionInstruction[]
  ): DeconstructedInstruction[] {
    return instructions.map((ix) => ({
      ixData: Buffer.from(ix.data),
      accountCount: ix.keys.length + 1,
    }));
  }

  /**
   * Set up remaining accounts in the correct order for batch execution
   * Layout: [program_account, account1, account2, ..., accountN] for each instruction
   */
  private setupRemainingAccounts(
    instructions: anchor.web3.TransactionInstruction[],
    smartAccountVaultPda: anchor.web3.PublicKey
  ): anchor.web3.AccountMeta[] {
    const remainingAccounts: anchor.web3.AccountMeta[] = [];

    for (const ix of instructions) {
      // Add program account first
      remainingAccounts.push({
        pubkey: ix.programId,
        isSigner: false,
        isWritable: false,
      });

      // Add instruction accounts
      for (const accountMeta of ix.keys) {
        remainingAccounts.push({
          pubkey: accountMeta.pubkey,
          // Vault signer flag set to false - will be handled by the vault program
          isSigner: accountMeta.pubkey.equals(smartAccountVaultPda)
            ? false
            : accountMeta.isSigner,
          isWritable: accountMeta.isWritable,
        });
      }
    }

    return remainingAccounts;
  }

  /**
   * Create and setup address lookup table for compression
   */
  private async createAddressLookupTable(
    provider: anchor.AnchorProvider,
    payer: anchor.web3.Keypair,
    accounts: anchor.web3.PublicKey[]
  ): Promise<anchor.web3.AddressLookupTableAccount> {
    // Get current slot - handle both regular connection and LiteSVM
    let currentSlot: number;
    const providerAny = provider as any;
    if (
      providerAny.client &&
      typeof providerAny.client.getClock === "function"
    ) {
      // LiteSVM case
      const clock = providerAny.client.getClock();
      currentSlot = Number(clock.slot);

      // For LiteSVM, we need to ensure the slot is sufficiently recent
      // LiteSVM starts with slot 0, so we need to advance it
      if (currentSlot < 100) {
        // Advance the clock to a reasonable slot
        const newClock = { ...clock };
        newClock.slot = BigInt(Math.max(currentSlot + 150, 200));
        providerAny.client.setClock(newClock);
        currentSlot = Number(newClock.slot);
      }
    } else {
      // Regular connection case
      currentSlot = await provider.connection.getSlot();
    }

    // Use current slot minus a small offset for recent slot requirement
    const recentSlot = Math.max(currentSlot - 50, 1);

    // Create lookup table
    const [lookupTableInstruction, lookupTableAddress] =
      anchor.web3.AddressLookupTableProgram.createLookupTable({
        authority: payer.publicKey,
        payer: payer.publicKey,
        recentSlot: recentSlot,
      });

    // Send lookup table creation transaction
    const createLookupTableTx = new anchor.web3.Transaction().add(
      lookupTableInstruction
    );
    await provider.sendAndConfirm(createLookupTableTx, [payer]);

    // Extend lookup table with accounts
    const extendInstruction =
      anchor.web3.AddressLookupTableProgram.extendLookupTable({
        payer: payer.publicKey,
        authority: payer.publicKey,
        lookupTable: lookupTableAddress,
        addresses: accounts,
      });

    const extendLookupTableTx = new anchor.web3.Transaction().add(
      extendInstruction
    );
    await provider.sendAndConfirm(extendLookupTableTx, [payer]);

    // Wait for lookup table to be usable
    await new Promise((resolve) => setTimeout(resolve, 1000));

    // For LiteSVM, we'll create a mock lookup table account since getAddressLookupTable doesn't exist
    if (
      providerAny.client &&
      typeof providerAny.client.getClock === "function"
    ) {
      // LiteSVM case - create a mock lookup table account
      const mockLookupTableAccount: anchor.web3.AddressLookupTableAccount = {
        key: lookupTableAddress,
        state: {
          deactivationSlot: BigInt(0),
          lastExtendedSlot: currentSlot,
          lastExtendedSlotStartIndex: 0,
          authority: payer.publicKey,
          addresses: accounts,
        },
        isActive: () => true,
      };
      return mockLookupTableAccount;
    } else {
      // Regular connection case
      const lookupTableAccount =
        await provider.connection.getAddressLookupTable(lookupTableAddress);

      if (!lookupTableAccount.value) {
        throw new Error("Failed to fetch lookup table");
      }
      return lookupTableAccount.value;
    }
  }

  /**
   * Create versioned transaction ready for submission
   */
  public async createVersionedTransaction(
    provider: anchor.AnchorProvider,
    instructions: anchor.web3.TransactionInstruction[],
    signers: anchor.web3.Keypair[],
    lookupTableAccount?: anchor.web3.AddressLookupTableAccount | null
  ): Promise<BatchExecutionResult> {
    // Get blockhash - handle both regular connection and LiteSVM
    let blockhash: string;
    const providerAny = provider as any;
    if (
      providerAny.client &&
      typeof providerAny.client.latestBlockhash === "function"
    ) {
      // LiteSVM case
      blockhash = providerAny.client.latestBlockhash();
    } else {
      // Regular connection case
      const result = await provider.connection.getLatestBlockhash();
      blockhash = result.blockhash;
    }

    // Create versioned transaction message
    const messageV0 = new anchor.web3.TransactionMessage({
      payerKey: signers[0].publicKey,
      recentBlockhash: blockhash,
      instructions,
    }).compileToV0Message(lookupTableAccount ? [lookupTableAccount] : []);

    const versionedTx = new anchor.web3.VersionedTransaction(messageV0);
    versionedTx.sign(signers);

    // Calculate transaction size
    const serializedTxSize = versionedTx.serialize().length;

    return {
      versionedTransaction: versionedTx,
      transactionSize: serializedTxSize,
    };
  }

  /**
   * Helper method to create multiple SOL transfer instructions
   */
  public createSolTransferInstructions(
    recipients: Array<{ publicKey: anchor.web3.PublicKey; amount: number }>,
    source?: anchor.web3.PublicKey
  ): anchor.web3.TransactionInstruction[] {
    const sourceKey = source || this.getVaultPda();

    return recipients.map((recipient) =>
      anchor.web3.SystemProgram.transfer({
        fromPubkey: sourceKey,
        toPubkey: recipient.publicKey,
        lamports: recipient.amount,
      })
    );
  }

  /**
   * Simulate execution via RPC to get gas estimates, then execute with proper compute units
   * Uses the existing executeBatch infrastructure with simulation flag
   */
  public async simulateAndGetExecuteBatchTx(
    instructions: anchor.web3.TransactionInstruction[],
    options: BatchExecutionOptions & { errorParser?: (error: any) => any }
  ): Promise<{
    simulationResult: {
      gasUsed: number | null;
      err: any;
      logs: string[];
      parsedError?: any;
    };
    executionResult: BatchExecutionResult;
    executionSignature?: string;
  }> {
    const { errorParser, ...batchOptions } = options;

    // Step 1: Run simulation using existing simulate instruction
    const simulationTx = await this.executeBatch(instructions, {
      ...batchOptions,
      isSimulation: true,
    });

    // Step 2: Use RPC simulate on the complete versioned transaction
    const simulationResult = await this.simulateVersionedTransaction(
      batchOptions.provider,
      simulationTx.versionedTransaction,
      errorParser
    );

    // Step 3: Check if simulation was successful
    if (simulationResult.logs) {
      // Check if this is our expected SimulationComplete error using the parsed error
      const isSimulationComplete =
        simulationResult.parsedError?.anchor?.errorName ===
          "SimulationComplete" ||
        simulationResult.parsedError?.anchor?.errorCode === "6013" ||
        simulationResult.logs?.some(
          (log) =>
            log.includes("SimulationComplete") ||
            log.includes("Error Number: 6013") ||
            log.includes("custom program error: 0x177d")
        );

      if (!isSimulationComplete) {
        throw new Error(
          `Simulation failed with unexpected error: ${JSON.stringify(
            simulationResult.parsedError.summary
          )}`
        );
      }
      // If it's SimulationComplete, that's expected and good
    }

    if (simulationResult.gasUsed === null) {
      throw new Error("Simulation did not provide gas usage estimate");
    }

    // Step 4: Build execution transaction with computed gas units
    const computeUnits = simulationResult.gasUsed; //no buffer

    const executionTx = await this.executeBatch(instructions, {
      ...batchOptions,
      computeUnits,
    });

    return {
      simulationResult,
      executionResult: executionTx,
    };
  }

  /**
   * Simulate a versioned transaction using RPC
   */
  private async simulateVersionedTransaction(
    provider: anchor.AnchorProvider,
    transaction: anchor.web3.VersionedTransaction,
    errorParser?: (error: any) => any
  ): Promise<{
    gasUsed: number | null;
    err: any;
    logs: string[];
    parsedError?: any;
  }> {
    const providerAny = provider as any;

    if (providerAny.client && typeof providerAny.simulate === "function") {
      // LiteSVM case
      let client = providerAny.client as LiteSVM;
      const result = await client.simulateTransaction(transaction);

      // For our simulation case, this will always be FailedTransactionMetadata due to SimulationComplete revert
      const failedResult = result as FailedTransactionMetadata;
      const err = failedResult.err();
      const logs = failedResult.meta().logs() || [];

      const parsedError = errorParser ? errorParser({ logs }) : undefined;

      return {
        gasUsed: Number(failedResult.meta().computeUnitsConsumed()) || null,
        err,
        logs,
        parsedError,
      };
    } else {
      // Regular RPC case
      try {
        const result = await provider.connection.simulateTransaction(
          transaction,
          {
            sigVerify: false,
            commitment: "processed",
          }
        );

        const err = result.value.err;
        const logs = result.value.logs || [];

        return {
          gasUsed: result.value.unitsConsumed || null,
          err,
          logs,
          parsedError: errorParser ? errorParser({ logs }) : undefined,
        };
      } catch (error) {
        const logs: string[] = [];
        return {
          gasUsed: null,
          err: error,
          logs,
          parsedError: errorParser ? errorParser(error) : undefined,
        };
      }
    }
  }

  async prepareMigrationIntent(
    migrateIx: anchor.web3.TransactionInstruction,
    tokenAmount: number = 0,
    tokenMint?: anchor.web3.PublicKey
  ) {
    const serializedIntent: number[] = [];

    const nonce = await this.fetchNonce();
    serializedIntent.push(...this.toBytesUInt64(nonce.toNumber()));

    // Add token amount
    serializedIntent.push(...this.toBytesUInt64(tokenAmount));

    // Add token mint (optional)
    if (tokenMint) {
      serializedIntent.push(1); // Some variant
      serializedIntent.push(...tokenMint.toBytes());
    } else {
      serializedIntent.push(0); // None variant
    }

    // Add migration instruction
    serializedIntent.push(...migrateIx.data);
    serializedIntent.push(...migrateIx.programId.toBytes());

    // Add migration instruction accounts
    migrateIx.keys.forEach((acc) => {
      serializedIntent.push(acc.isSigner ? 1 : 0);
      serializedIntent.push(acc.isWritable ? 1 : 0);
      serializedIntent.push(...acc.pubkey.toBytes());
    });

    return serializedIntent;
  }
}