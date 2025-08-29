import { generateIdFromString } from "../utils/helpers";
import * as anchor from "@coral-xyz/anchor";
import {
  DeconstructedInstruction,
  SmartAccountHelper,
} from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import {
  AccountMeta,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { createSecp256r1Instruction } from "../utils/r1-utils";
import {
  LAMPORTS_PER_SIGNER,
  SMART_ACCOUNT_VAULT_SEED,
  VAULT_STATE_SEED,
} from "../utils/consts";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../utils/webauthn";
import { keccak_256 } from "@noble/hashes/sha3";
import { MockATA } from "../setup/config";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { IntentTree } from "../utils/intent-tree";
import { ethers } from "ethers";

// TypeScript interfaces matching Rust structs for general account creation
interface GeneralPasskey {
  pubkey: number[]; // [u8; 32]
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

interface GeneralSolanaKey {
  pubkey: anchor.web3.PublicKey; // Pubkey
  validFrom: anchor.BN; // u64
  validUntil: anchor.BN; // u64
}

type SmartAccountType =
  | { payWallet: {} }
  | { easyWallet: {} }
  | { ceDeFiWallet: {} };

interface CreateGeneralAccountArgs {
  userPasskey: GeneralPasskey;
  initialSolanaSigner: GeneralSolanaKey | null; // Option<SolanaKey>
  initialRecoverySigner: PublicKey;
  accountType: SmartAccountType;
  salt: number[]; // [u8; 32]
}

/**
 * Serialize CreateGeneralAccountArgs exactly as the Rust program does
 * This is used both for ID generation and message signing
 */
function serializeCreateGeneralAccountArgs(
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
function generateGeneralAccountId(args: CreateGeneralAccountArgs): number[] {
  const serialized = serializeCreateGeneralAccountArgs(args);
  // Hash with keccak256
  const hash = keccak_256(serialized);
  return Array.from(hash);
}

describe("general-account", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;
  let bob: SmartAccountHelper;
  let charlie: SmartAccountHelper;
  let daniel: SmartAccountHelper;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();

    // Create Alice's helper for EasyWallet type (with initial Solana signer)
    // First create a dummy helper to get the passkey, then generate proper ID
    const aliceDummyHelper = new SmartAccountHelper(
      generateIdFromString("temp alice"),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    const now = Math.floor(Date.now() / 1000);
    const validFrom = new anchor.BN(now);
    const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60); // 1 year
    const salt = new Uint8Array(32); // Zero salt

    const aliceCreateArgs: CreateGeneralAccountArgs = {
      userPasskey: {
        pubkey: Array.from(aliceDummyHelper.getPasskeyPubkey()),
        validFrom,
        validUntil,
      },
      initialSolanaSigner: {
        pubkey: testBase.mandatorySigner.publicKey,
        validFrom,
        validUntil,
      },
      initialRecoverySigner: aliceDummyHelper.recoverySigners[0].publicKey,
      accountType: { easyWallet: {} },
      salt: Array.from(salt),
    };

    const aliceGeneratedId = generateGeneralAccountId(aliceCreateArgs);

    alice = new SmartAccountHelper(
      Buffer.from(aliceGeneratedId),
      testBase.mandatorySigner,
      testBase.saProgram,
      aliceDummyHelper.recoverySigners[0],
      validFrom,
      validUntil,
      aliceDummyHelper.passkeyKeypair // Use the same passkey
    );

    // Create Bob's helper for CeDeFiWallet type (no initial Solana signer)
    const bobDummyHelper = new SmartAccountHelper(
      generateIdFromString("temp bob"),
      undefined, // No mandatory signer for CeDeFiWallet
      testBase.saProgram
    );

    const bobCreateArgs: CreateGeneralAccountArgs = {
      userPasskey: {
        pubkey: Array.from(bobDummyHelper.getPasskeyPubkey()),
        validFrom,
        validUntil,
      },
      initialSolanaSigner: null, // CeDeFiWallet has no initial Solana signer
      initialRecoverySigner: bobDummyHelper.recoverySigners[0].publicKey,
      accountType: { ceDeFiWallet: {} },
      salt: Array.from(salt),
    };

    const bobGeneratedId = generateGeneralAccountId(bobCreateArgs);

    bob = new SmartAccountHelper(
      Buffer.from(bobGeneratedId),
      undefined, // No mandatory signer for CeDeFiWallet
      testBase.saProgram,
      bobDummyHelper.recoverySigners[0],
      validFrom,
      validUntil,
      bobDummyHelper.passkeyKeypair // Use the same passkey
    );

    // Create Charlie's helper for SPL token testing (EasyWallet type with initial Solana signer)
    const charlieDummyHelper = new SmartAccountHelper(
      generateIdFromString("temp charlie"),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    const charlieCreateArgs: CreateGeneralAccountArgs = {
      userPasskey: {
        pubkey: Array.from(charlieDummyHelper.getPasskeyPubkey()),
        validFrom,
        validUntil,
      },
      initialSolanaSigner: {
        pubkey: testBase.mandatorySigner.publicKey,
        validFrom,
        validUntil,
      },
      initialRecoverySigner: charlieDummyHelper.recoverySigners[0].publicKey,
      accountType: { easyWallet: {} },
      salt: Array.from(salt),
    };

    const charlieGeneratedId = generateGeneralAccountId(charlieCreateArgs);

    charlie = new SmartAccountHelper(
      Buffer.from(charlieGeneratedId),
      testBase.mandatorySigner,
      testBase.saProgram,
      charlieDummyHelper.recoverySigners[0],
      validFrom,
      validUntil,
      charlieDummyHelper.passkeyKeypair // Use the same passkey
    );

    // Create Daniel's helper for CeDeFiWallet type (no initial Solana signer) - for intent tree test
    const danielDummyHelper = new SmartAccountHelper(
      generateIdFromString("temp daniel"),
      undefined, // No mandatory signer for CeDeFiWallet
      testBase.saProgram
    );

    const danielCreateArgs: CreateGeneralAccountArgs = {
      userPasskey: {
        pubkey: Array.from(danielDummyHelper.getPasskeyPubkey()),
        validFrom,
        validUntil,
      },
      initialSolanaSigner: null, // CeDeFiWallet has no initial Solana signer
      initialRecoverySigner: danielDummyHelper.recoverySigners[0].publicKey,
      accountType: { ceDeFiWallet: {} },
      salt: Array.from(salt),
    };

    const danielGeneratedId = generateGeneralAccountId(danielCreateArgs);

    daniel = new SmartAccountHelper(
      Buffer.from(danielGeneratedId),
      undefined, // No mandatory signer for CeDeFiWallet
      testBase.saProgram,
      danielDummyHelper.recoverySigners[0],
      validFrom,
      validUntil,
      danielDummyHelper.passkeyKeypair // Use the same passkey
    );
  });

  describe("config state", () => {
    it("config state should be successfully written", async () => {
      await testBase.assertConfigState();
      await testBase.assertVaultConfigState();
    });
  });

  describe("general account creation", () => {
    it("should create EasyWallet general account with initial Solana signer", async () => {
      // Fund the vault
      testBase.client.airdrop(
        alice.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      // Prepare general account creation arguments for EasyWallet
      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60); // 1 year
      const salt = new Uint8Array(32); // Zero salt

      const createGeneralAccountArgs: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(alice.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: {
          pubkey: testBase.mandatorySigner.publicKey,
          validFrom,
          validUntil,
        },
        initialRecoverySigner: alice.recoverySigners[0].publicKey,
        accountType: { easyWallet: {} },
        salt: Array.from(salt),
      };

      // Generate account ID (should match Alice's ID)
      const id = generateGeneralAccountId(createGeneralAccountArgs);
      expect(id).to.deep.equal(alice.getId());

      const smartAccountSize = BigInt(316); // EasyWallet with 2 signers
      const vaultStateSize = BigInt(107);
      const rent =
        testBase.client.getRent().minimumBalance(smartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const totalFees = rent + BigInt(LAMPORTS_PER_SIGNER * 2);

      // Create signature for general account creation - match contract format exactly
      // Step 1: Serialize CreateGeneralAccountArgs using native serialization
      const serializedArgsBuffer = serializeCreateGeneralAccountArgs(
        createGeneralAccountArgs
      );

      // Step 2: Add token_amount (8 bytes, little endian)
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(totalFees);

      // Step 3: Serialize Option<token_mint> using AnchorSerialize format
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant (no token mint)

      // Step 4: Add account keys (32 bytes each)
      const smartAccountKeyBuffer = Buffer.from(alice.sa.toBytes());
      const vaultKeyBuffer = Buffer.from(alice.vault.toBytes());
      const vaultStateKeyBuffer = Buffer.from(alice.vaultState.toBytes());

      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        serializedArgsBuffer,
        smartAccountKeyBuffer,
        vaultKeyBuffer,
        vaultStateKeyBuffer,
      ]);

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Execute general account creation with vault paying the fees
      await testBase.saProgram.methods
        .createGeneralAccount(
          createGeneralAccountArgs,
          new anchor.BN(totalFees),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,
          smartAccount: alice.sa,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: alice.vault,
          vaultState: alice.vaultState,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: testBase.webauthnTable,
        })
        .preInstructions([
          createSecp256r1Instruction(
            message,
            alice.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer])
        .rpc();

      // Verify balances - vault pays fees to tx_payer
      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      expect(aliceBalAfter).to.equal(aliceBalBefore - totalFees);
      expect(txPayerBalAfter).to.equal(txPayerBalBefore);
    });

    it("should create CeDeFiWallet general account without initial Solana signer", async () => {
      // Fund the vault
      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const bobBalBefore = testBase.client.getBalance(bob.vault);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      // Prepare general account creation arguments for CeDeFiWallet (no initial Solana signer)
      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60); // 1 year
      const salt = new Uint8Array(32); // Zero salt

      const createGeneralAccountArgs: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(bob.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: null, // CeDeFiWallet has no initial Solana signer
        initialRecoverySigner: bob.recoverySigners[0].publicKey,
        accountType: { ceDeFiWallet: {} },
        salt: Array.from(salt),
      };

      // Calculate expected fees for CeDeFiWallet (1 passkey + 0 Solana keys = 1 signer)
      // SmartAccount base size calculation from Rust:
      // 8 (anchor discriminator) + 1 (bump) + 1 (account_type) + 32 (id) +
      // AuthorizationModel::Signers size + 8 (nonce) + 32 (email_ptr) + 32 (zk_verifier_program) +
      // 8 (last_recovery) + 1 + OptimisticValidationState::size_of()
      //
      // AuthorizationModel::Signers size = 1 (discriminant) + SmartAccountSigners::size(1)
      // SmartAccountSigners::size(1) = 4 (Vec len) + 4 (Vec len) + max(Passkey::size(), SolanaKey::size()) * 1
      // max(49, 48) * 1 = 49
      // So: SmartAccountSigners::size(1) = 4 + 4 + 49 = 57
      // AuthorizationModel::Signers size = 1 + 57 = 58
      //
      // OptimisticValidationState::size_of() = 1 + 32 + 8 + 8 + 32 + 32 + 8 + 1 = 122
      //
      // Total: 8 + 1 + 1 + 32 + 58 + 8 + 32 + 32 + 8 + 1 + 122 = 303
      const smartAccountSize = BigInt(267); // CeDeFiWallet with 1 signer
      const vaultStateSize = BigInt(107);
      const rent =
        testBase.client.getRent().minimumBalance(smartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const totalFees = rent + BigInt(LAMPORTS_PER_SIGNER * 2);

      // Create signature for general account creation - match contract format exactly
      const serializedArgsBuffer = serializeCreateGeneralAccountArgs(
        createGeneralAccountArgs
      );
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(totalFees);
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant

      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        serializedArgsBuffer,
        Buffer.from(bob.sa.toBytes()),
        Buffer.from(bob.vault.toBytes()),
        Buffer.from(bob.vaultState.toBytes()),
      ]);

      const [message, signature, authData] = bob.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Execute general account creation with vault paying the fees
      await testBase.saProgram.methods
        .createGeneralAccount(
          createGeneralAccountArgs,
          new anchor.BN(totalFees),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,
          smartAccount: bob.sa,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: bob.vault,
          vaultState: bob.vaultState,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: testBase.webauthnTable,
        })
        .preInstructions([
          createSecp256r1Instruction(
            message,
            bob.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer])
        .rpc();

      // Verify balances - vault pays fees to tx_payer
      const bobBalAfter = testBase.client.getBalance(bob.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      expect(bobBalAfter).to.equal(bobBalBefore - totalFees);
      expect(txPayerBalAfter).to.equal(txPayerBalBefore);
    });

    it("should create general account with correct fields", async () => {
      // Verify Alice's EasyWallet account
      let aliceAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );

      expect(aliceAccount.id).to.deep.equal(alice.getId());
      expect(aliceAccount.accountType).to.deep.equal({ easyWallet: {} });
      expect(aliceAccount.nonce.toNumber()).to.equal(0);

      // Verify authorization model for EasyWallet (should have both passkey and Solana signers)
      if (aliceAccount.authorizationModel.signers) {
        const signers = aliceAccount.authorizationModel.signers[0];
        expect(signers.passkeySigners).to.have.length(1);
        expect(signers.solanaKeySigners).to.have.length(1);
        expect(Array.from(signers.passkeySigners[0].pubkey)).to.deep.equal(
          Array.from(alice.getPasskeyPubkey())
        );
        expect(signers.solanaKeySigners[0].pubkey.toBase58()).to.equal(
          testBase.mandatorySigner.publicKey.toBase58()
        );
      } else {
        throw new Error("Expected signers authorization model for EasyWallet");
      }

      // Verify Bob's CeDeFiWallet account
      let bobAccount = await testBase.saProgram.account.smartAccount.fetch(
        bob.sa
      );

      expect(bobAccount.id).to.deep.equal(bob.getId());
      expect(bobAccount.accountType).to.deep.equal({ ceDeFiWallet: {} });
      expect(bobAccount.nonce.toNumber()).to.equal(0);

      // Verify authorization model for CeDeFiWallet (should have only passkey signers)
      if (bobAccount.authorizationModel.signers) {
        const signers = bobAccount.authorizationModel.signers[0];
        expect(signers.passkeySigners).to.have.length(1);
        expect(signers.solanaKeySigners).to.have.length(0); // No Solana signers for CeDeFiWallet
        expect(Array.from(signers.passkeySigners[0].pubkey)).to.deep.equal(
          Array.from(bob.getPasskeyPubkey())
        );
      } else {
        throw new Error(
          "Expected signers authorization model for CeDeFiWallet"
        );
      }
    });

    it("should create vault state with the right fields", async () => {
      // Verify Alice's vault state
      let aliceVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);

      expect(aliceVaultState.id).to.deep.equal(alice.getId());
      expect(aliceVaultState.smartAccount.toBase58()).to.equal(
        alice.sa.toBase58()
      );
      expect(aliceVaultState.isValidated).to.equal(false);

      // Verify the vault bump matches the derived bump
      const [, expectedVaultBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(SMART_ACCOUNT_VAULT_SEED), Buffer.from(alice.getId())],
          testBase.vaultProgram.programId
        );
      expect(aliceVaultState.vaultBump).to.equal(expectedVaultBump);

      // Verify the state bump matches the derived bump
      const [, expectedStateBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(VAULT_STATE_SEED), Buffer.from(alice.getId())],
          testBase.vaultProgram.programId
        );
      expect(aliceVaultState.stateBump).to.equal(expectedStateBump);

      // Verify Bob's vault state
      let bobVaultState = await testBase.vaultProgram.account.vaultState.fetch(
        bob.vaultState
      );

      expect(bobVaultState.id).to.deep.equal(bob.getId());
      expect(bobVaultState.smartAccount.toBase58()).to.equal(bob.sa.toBase58());
      expect(bobVaultState.isValidated).to.equal(false);
    });

    it("should create general account with SPL token pay support", async () => {
      // Create a test SPL token mint if not already created
      if (!testBase.testSPL2022TokenMint) {
        await testBase.createTestSPL2022TokenMint();
      }

      // Fund the vault with SOL for rent and execution fees
      testBase.client.airdrop(
        charlie.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      // Create token accounts for testing
      const charlieTokenAccount = testBase.getTokenAccountAddress(
        charlie.vault,
        true, // allowOwnerOffCurve = true for PDA
        true // is2022 = true
      );

      const txPayerTokenAccount = testBase.getTokenAccountAddress(
        testBase.txPayer.publicKey,
        false, // allowOwnerOffCurve = false for regular account
        true // is2022 = true
      );

      // Mock token accounts with initial balances
      const charlieMockATA = MockATA(
        charlie.vault,
        testBase.testSPL2022TokenMint,
        BigInt(LAMPORTS_PER_SOL * 1000), // 1000 tokens
        true, // is2022 = true
        true // allowOwnerOffCurve = true for PDA
      );

      const txPayerMockATA = MockATA(
        testBase.txPayer.publicKey,
        testBase.testSPL2022TokenMint,
        BigInt(LAMPORTS_PER_SOL * 1000), // 1000 tokens
        true, // is2022 = true
        false // allowOwnerOffCurve = false for regular account
      );

      // Set up mock token accounts
      testBase.provider.client.setAccount(
        charlieMockATA.address,
        charlieMockATA.info
      );
      testBase.provider.client.setAccount(
        txPayerMockATA.address,
        txPayerMockATA.info
      );

      const charlieBalBefore = testBase.client.getBalance(charlie.vault);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      // Get initial token balances
      const initialCharlieSPLBalance =
        await testBase.getTokenBalance(charlieTokenAccount);
      const initialTxPayerSPLBalance =
        await testBase.getTokenBalance(txPayerTokenAccount);

      // Prepare general account creation arguments for EasyWallet with SPL token pay
      const createGeneralAccountArgs: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(charlie.getPasskeyPubkey()),
          validFrom: charlie.validFrom,
          validUntil: charlie.validUntil,
        },
        initialSolanaSigner: {
          pubkey: testBase.mandatorySigner.publicKey,
          validFrom: charlie.validFrom,
          validUntil: charlie.validUntil,
        },
        initialRecoverySigner: charlie.recoverySigners[0].publicKey,
        accountType: { easyWallet: {} },
        salt: Array.from(new Uint8Array(32)), // Zero salt, same as used in helper creation
      };

      // Calculate expected fees for EasyWallet (1 passkey + 1 Solana key = 2 signers)
      const smartAccountSize = BigInt(316); // EasyWallet with 2 signers
      const vaultStateSize = BigInt(107);
      const rent =
        testBase.client.getRent().minimumBalance(smartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 2);
      const totalFees = rent + executionFees;

      // Use token amount for execution fees (rent still paid in SOL)
      const tokenAmount = BigInt(1000000); // 1 token with 6 decimals

      // Create signature for general account creation with SPL token mint
      const serializedArgsBuffer = serializeCreateGeneralAccountArgs(
        createGeneralAccountArgs
      );
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(tokenAmount);

      // Serialize Option<token_mint> using AnchorSerialize format
      const tokenMintBuffer = Buffer.alloc(33); // 1 byte for Some variant + 32 bytes for pubkey
      tokenMintBuffer.writeUInt8(1); // Some variant (has token mint)
      tokenMintBuffer.set(testBase.testSPL2022TokenMint.toBuffer(), 1); // Write pubkey starting at byte 1

      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        serializedArgsBuffer,
        Buffer.from(charlie.sa.toBytes()),
        Buffer.from(charlie.vault.toBytes()),
        Buffer.from(charlie.vaultState.toBytes()),
      ]);

      const [message, signature, authData] = charlie.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Execute general account creation with SPL token pay
      await testBase.saProgram.methods
        .createGeneralAccount(
          createGeneralAccountArgs,
          new anchor.BN(tokenAmount),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,
          smartAccount: charlie.sa,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: charlie.vault,
          vaultState: charlie.vaultState,
          vaultTokenAccount: charlieTokenAccount,
          tokenMint: testBase.testSPL2022TokenMint,
          destinationTokenAccount: txPayerTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          webauthnTable: testBase.webauthnTable,
        })
        .preInstructions([
          createSecp256r1Instruction(
            message,
            charlie.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer])
        .rpc();

      const charlieBalAfter = testBase.client.getBalance(charlie.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      // Get final token balances
      const finalCharlieSPLBalance =
        await testBase.getTokenBalance(charlieTokenAccount);
      const finalTxPayerSPLBalance =
        await testBase.getTokenBalance(txPayerTokenAccount);

      // Verify SOL balance deductions
      expect(charlieBalAfter).to.equal(charlieBalBefore);
      expect(txPayerBalBefore).to.equal(txPayerBalAfter + totalFees);

      // Verify token balance changes
      expect(finalCharlieSPLBalance).to.equal(
        initialCharlieSPLBalance - tokenAmount
      );
      expect(finalTxPayerSPLBalance).to.equal(
        initialTxPayerSPLBalance + tokenAmount
      );

      // Verify general account was created with correct fields
      let charlieAccount = await testBase.saProgram.account.smartAccount.fetch(
        charlie.sa
      );

      expect(charlieAccount.id).to.deep.equal(charlie.getId());

      expect(charlieAccount.accountType).to.deep.equal({ easyWallet: {} });
      expect(charlieAccount.recoverySigners.length).to.equal(1);
      expect(charlieAccount.recoverySigners[0].toString()).to.equal(
        charlie.recoverySigners[0].publicKey.toString()
      );
      expect(charlieAccount.nonce.toNumber()).to.equal(0);

      // Verify authorization model for EasyWallet (should have both passkey and Solana signers)
      if (charlieAccount.authorizationModel.signers) {
        const signers = charlieAccount.authorizationModel.signers[0];
        expect(signers.passkeySigners).to.have.length(1);
        expect(signers.solanaKeySigners).to.have.length(1);
        expect(Array.from(signers.passkeySigners[0].pubkey)).to.deep.equal(
          Array.from(charlie.getPasskeyPubkey())
        );
        expect(signers.solanaKeySigners[0].pubkey.toBase58()).to.equal(
          testBase.mandatorySigner.publicKey.toBase58()
        );
      } else {
        throw new Error("Expected signers authorization model for EasyWallet");
      }

      // Verify vault state was created
      let charlieVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(
          charlie.vaultState
        );
      expect(charlieVaultState.id).to.deep.equal(charlie.getId());
      expect(charlieVaultState.smartAccount.toBase58()).to.equal(
        charlie.sa.toBase58()
      );
      expect(charlieVaultState.isValidated).to.equal(false);

      // Verify the vault bump matches the derived bump
      const [, expectedCharlieVaultBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(SMART_ACCOUNT_VAULT_SEED), Buffer.from(charlie.getId())],
          testBase.vaultProgram.programId
        );
      expect(charlieVaultState.vaultBump).to.equal(expectedCharlieVaultBump);

      // Verify the state bump matches the derived bump
      const [, expectedCharlieStateBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(VAULT_STATE_SEED), Buffer.from(charlie.getId())],
          testBase.vaultProgram.programId
        );
      expect(charlieVaultState.stateBump).to.equal(expectedCharlieStateBump);
    });
  });

  describe("general account transaction execution", () => {
    it("should validate and execute transaction through EasyWallet", async () => {
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);
      const recipient = PublicKey.unique();

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer (for EasyWallet)
        1 + // Tx Payer
        1; // R1 Signature
      const executionFee = BigInt(numSignatures * LAMPORTS_PER_SIGNER);

      const {
        serializedIntent,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
      } = await alice.prepareUserIntent(cpiTX, {
        tokenAmount: Number(executionFee),
      });

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Execute transaction using validateExecution (general accounts use this)
      await testBase.saProgram.methods
        .validateExecution(
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          new anchor.BN(executionFee),
          null
        )
        .accountsPartial({
          solanaSigner: testBase.mandatorySigner.publicKey,
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: testBase.webauthnTable,
        })
        .postInstructions([
          createSecp256r1Instruction(
            message,
            alice.getPasskeyPubkey(),
            signature
          ),
          await testBase.vaultProgram.methods
            .executeBatch({
              deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .signers([testBase.mandatorySigner])
        .rpc();

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const nonceAfter = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      expect(aliceBalAfter).to.equal(
        aliceBalBefore - executionFee - transferAmount
      );
      expect(txPayerBalBefore).to.equal(txPayerBalAfter);
      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
    });

    it("should validate and execute transaction through CeDeFiWallet", async () => {
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const bobBalBefore = testBase.client.getBalance(bob.vault);
      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(bob.sa)
        .then((v) => v.nonce);

      const transferAmount = BigInt(0.5 * LAMPORTS_PER_SOL);
      const recipient = PublicKey.unique();

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: bob.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Tx Payer
        1; // R1 Signature (no mandatory signer for CeDeFiWallet)
      const executionFee = BigInt(numSignatures * LAMPORTS_PER_SIGNER);

      const {
        serializedIntent,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
      } = await bob.prepareUserIntent(cpiTX, {
        tokenAmount: Number(executionFee),
      });

      const [message, signature, authData] = bob.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Execute transaction through CeDeFiWallet (no mandatory signer required)
      await testBase.saProgram.methods
        .validateExecution(
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          new anchor.BN(executionFee),
          null
        )
        .accountsPartial({
          solanaSigner: null, // No mandatory signer for CeDeFiWallet
          smartAccount: bob.sa,
          vaultState: bob.vaultState,
          smartAccountVault: bob.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: testBase.webauthnTable,
        })
        .postInstructions([
          createSecp256r1Instruction(
            message,
            bob.getPasskeyPubkey(),
            signature
          ),
          await testBase.vaultProgram.methods
            .executeBatch({
              deconstructedInstructions,
            })
            .accounts({
              vaultState: bob.vaultState,
              smartAccountVault: bob.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .signers([testBase.txPayer])
        .rpc();

      const bobBalAfter = testBase.client.getBalance(bob.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const nonceAfter = await testBase.saProgram.account.smartAccount
        .fetch(bob.sa)
        .then((v) => v.nonce);

      expect(bobBalAfter).to.equal(
        bobBalBefore - executionFee - transferAmount
      );
      expect(txPayerBalBefore).to.equal(txPayerBalAfter);
      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
    });

    it("should create general account + transfer with intent tree proofs", async () => {
      // Fund the vault
      testBase.client.airdrop(
        daniel.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      // Prepare general account creation arguments
      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60); // 1 year
      const salt = new Uint8Array(32); // Zero salt

      const createGeneralAccountArgs: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(daniel.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: null, // No initial Solana signer
        initialRecoverySigner: daniel.recoverySigners[0].publicKey,
        accountType: { ceDeFiWallet: {} },
        salt: Array.from(salt),
      };

      // Intent 1 - creation
      const createAccountArgsBuffer = daniel.saProgram.coder.types.encode(
        "createGeneralAccountArgs",
        createGeneralAccountArgs
      );
      const saBuffer = daniel.sa.toBuffer();
      const vaultBuffer = daniel.vault.toBuffer();
      const vaultStateBuffer = daniel.vaultState.toBuffer();
      const createIntent = Buffer.concat([
        createAccountArgsBuffer,
        saBuffer,
        vaultBuffer,
        vaultStateBuffer,
      ]);

      // Intent 2 - execute transfer
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);
      const executionFee = BigInt(LAMPORTS_PER_SIGNER * 2); // 1 passkey + 1 R1 Signature Verify
      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: daniel.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const {
        serializedIntent: transferIntent,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
      } = await daniel.prepareUserIntent(
        cpiTX,
        {
          tokenAmount: Number(executionFee),
        },
        undefined,
        new anchor.BN(0) // first tx
      );

      const createIntentHash = ethers.keccak256(Buffer.from(createIntent));
      const transferIntentHash = ethers.keccak256(Buffer.from(transferIntent));

      const intentTree = new IntentTree([createIntentHash, transferIntentHash]);

      const [message, signature, authData] = daniel.signIntent(
        Buffer.from(ethers.toBeArray(intentTree.getRoot())),
        false
      );

      // Execute creation with proof 1
      let proof1 = intentTree.getProof(createIntentHash);
      const createTx = await daniel.saProgram.methods
        .createGeneralAccount(
          createGeneralAccountArgs,
          new anchor.BN(0), // No fees for general account creation
          {
            origin: WebAuthnStringHelpers.Direct(daniel.ORIGIN),
            androidPackageName: WebAuthnStringHelpers.Direct(
              daniel.ANDROID_PACKAGE_NAME
            ),
            authData: WebAuthnAuthDataHelpers.Direct(authData),
          } as any,
          proof1
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,

          smartAccount: daniel.sa,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: daniel.vault,
          vaultState: daniel.vaultState,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: null,
        })
        .preInstructions([
          createSecp256r1Instruction(
            message,
            daniel.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer])
        .rpc();

      // Execute transfer with proof 2
      let proof2 = intentTree.getProof(transferIntentHash);
      let transferTx = await testBase.saProgram.methods
        .validateExecution(
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          new anchor.BN(executionFee),
          proof2
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,
          solanaSigner: null,
          smartAccount: daniel.sa,
          vaultState: daniel.vaultState,
          smartAccountVault: daniel.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          webauthnTable: testBase.webauthnTable,
        })
        .postInstructions([
          createSecp256r1Instruction(
            message,
            daniel.getPasskeyPubkey(),
            signature
          ),
          await testBase.vaultProgram.methods
            .executeBatch({
              deconstructedInstructions,
            })
            .accounts({
              vaultState: daniel.vaultState,
              smartAccountVault: daniel.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .signers([testBase.txPayer])
        .rpc();

      // Verify the general account was created and transfer executed
      const generalAccount =
        await testBase.saProgram.account.smartAccount.fetch(daniel.sa);
      expect(generalAccount.accountType.ceDeFiWallet).to.not.be.undefined;
      expect(generalAccount.nonce.toNumber()).to.equal(1); // Should be incremented after transfer
    });
  });

  describe("optimistic execution for general accounts", () => {
    let testUserTX: Transaction;
    const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
    const numTransfers = 1;

    let initialTxPayerBalance: bigint;
    let initialAliceBalance: bigint;
    let initialBobBalance: bigint;

    let aliceDeconstructedInstructions: DeconstructedInstruction[];
    let aliceRemainingAccounts: AccountMeta[];
    let bobDeconstructedInstructions: DeconstructedInstruction[];
    let bobRemainingAccounts: AccountMeta[];

    const jitoTipAccount = PublicKey.unique();
    const jitoTip = 0.0001 * LAMPORTS_PER_SOL;
    let totalFeeAlice: bigint;
    let totalFeeBob: bigint;

    before(async () => {
      // Create a test transaction
      const recipient = PublicKey.unique();
      testUserTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault, // Will be updated per test
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );
    });

    it("should perform optimistic validation for EasyWallet", async () => {
      initialTxPayerBalance = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      initialAliceBalance = testBase.client.getBalance(alice.vault);

      // Calculate execution fees for EasyWallet optimistic flow
      const executionFee =
        (2 + // optimistic validation: 1 R1 + 1 tx_payer
          1 + // optimistic execution: 1 tx_payer
          1) * // post optimistic execution: 1 tx_payer
        LAMPORTS_PER_SIGNER;
      totalFeeAlice = BigInt(executionFee + jitoTip);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      // Update transaction to use Alice's vault
      testUserTX.instructions[0] = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: testUserTX.instructions[0].keys[1].pubkey,
        lamports: transferAmount,
      });

      const {
        serializedMessage,
        deconstructedInstructions: generatedDeconstructedInstructions,
        remainingAccounts: generatedRemainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        {
          tokenAmount: Number(totalFeeAlice),
        },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      aliceDeconstructedInstructions = generatedDeconstructedInstructions;
      aliceRemainingAccounts = generatedRemainingAccounts;

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      await testBase.saProgram.methods
        .optimisticValidation(
          validationArgs,
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          smartAccount: alice.sa,
          solanaSigner: null,
          tokenMint: null,
          webauthnTable: testBase.webauthnTable,
        })
        .postInstructions([
          createSecp256r1Instruction(
            message,
            alice.getPasskeyPubkey(),
            signature
          ),
        ])
        .rpc();

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      expect(
        BigInt(optimisticValidationStateAccount.tokenAmount.toNumber())
      ).to.equal(totalFeeAlice);
      expect(optimisticValidationStateAccount.tokenMint).to.equal(null);
      expect(optimisticValidationStateAccount.maxSlot.toNumber()).to.equal(
        Number(maxSlot)
      );
      expect(optimisticValidationStateAccount.targetHash).to.deep.equal(
        Array.from(hashBytes)
      );
      expect(optimisticValidationStateAccount.txPayer.toString()).to.equal(
        testBase.txPayer.publicKey.toString()
      );
      expect(
        optimisticValidationStateAccount.validationSlot.toNumber()
      ).to.equal(Number(testBase.client.getClock().slot));
      expect(optimisticValidationStateAccount.isExecuted).to.equal(false);
    });

    it("should perform optimistic execution for EasyWallet", async () => {
      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({
              deconstructedInstructions: aliceDeconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(aliceRemainingAccounts)
            .instruction(),
        ])
        .rpc();

      const nonceAfter = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
      expect(optimisticValidationStateAccount.isExecuted).to.equal(true);
    });

    it("should complete post optimistic execution for EasyWallet", async () => {
      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(jitoTip))
        .accountsPartial({
          jitoTipAccount: jitoTipAccount,
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
        })
        .rpc();

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const jitoTipAccountBalAfter = testBase.client.getBalance(jitoTipAccount);

      expect(optimisticValidationStateAccount).to.equal(null);
      expect(aliceBalAfter).to.equal(
        initialAliceBalance -
          totalFeeAlice -
          transferAmount * BigInt(numTransfers)
      );
      expect(txPayerBalAfter).to.equal(initialTxPayerBalance);
      expect(jitoTipAccountBalAfter).to.equal(BigInt(jitoTip));
    });

    it("should perform optimistic validation for CeDeFiWallet", async () => {
      initialBobBalance = testBase.client.getBalance(bob.vault);

      // Calculate execution fees for CeDeFiWallet optimistic flow (no mandatory signer)
      const executionFee =
        (2 + // optimistic validation: 1 R1 + 1 tx_payer (no mandatory signer)
          1 + // optimistic execution: 1 tx_payer
          1) * // post optimistic execution: 1 tx_payer
        LAMPORTS_PER_SIGNER;
      totalFeeBob = BigInt(executionFee + jitoTip);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      // Update transaction to use Bob's vault
      testUserTX.instructions[0] = SystemProgram.transfer({
        fromPubkey: bob.vault,
        toPubkey: testUserTX.instructions[0].keys[1].pubkey,
        lamports: transferAmount,
      });

      const {
        serializedMessage,
        deconstructedInstructions: generatedDeconstructedInstructions,
        remainingAccounts: generatedRemainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await bob.prepareOptimisticValidationIntent(
        testUserTX,
        {
          tokenAmount: Number(totalFeeBob),
        },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      bobDeconstructedInstructions = generatedDeconstructedInstructions;
      bobRemainingAccounts = generatedRemainingAccounts;

      const [message, signature, authData] = bob.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // CeDeFiWallet doesn't require mandatory signer
      await testBase.saProgram.methods
        .optimisticValidation(
          validationArgs,
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          smartAccount: bob.sa,
          solanaSigner: null, // No mandatory signer for CeDeFiWallet
          tokenMint: null,
          webauthnTable: testBase.webauthnTable,
        })
        .postInstructions([
          createSecp256r1Instruction(
            message,
            bob.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer])
        .rpc();

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(bob.sa)
          .then((v) => v.optimisticValidationState);

      expect(
        BigInt(optimisticValidationStateAccount.tokenAmount.toNumber())
      ).to.equal(totalFeeBob);
      expect(optimisticValidationStateAccount.tokenMint).to.equal(null);
      expect(optimisticValidationStateAccount.maxSlot.toNumber()).to.equal(
        Number(maxSlot)
      );
      expect(optimisticValidationStateAccount.targetHash).to.deep.equal(
        Array.from(hashBytes)
      );
      expect(optimisticValidationStateAccount.txPayer.toString()).to.equal(
        testBase.txPayer.publicKey.toString()
      );
      expect(
        optimisticValidationStateAccount.validationSlot.toNumber()
      ).to.equal(Number(testBase.client.getClock().slot));
      expect(optimisticValidationStateAccount.isExecuted).to.equal(false);
    });

    it("should perform optimistic execution for CeDeFiWallet", async () => {
      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(bob.sa)
        .then((v) => v.nonce);

      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: bob.sa,
          vaultState: bob.vaultState,
          smartAccountVault: bob.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({
              deconstructedInstructions: bobDeconstructedInstructions,
            })
            .accounts({
              vaultState: bob.vaultState,
              smartAccountVault: bob.vault,
            })
            .remainingAccounts(bobRemainingAccounts)
            .instruction(),
        ])
        .rpc();

      const nonceAfter = await testBase.saProgram.account.smartAccount
        .fetch(bob.sa)
        .then((v) => v.nonce);

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(bob.sa)
          .then((v) => v.optimisticValidationState);

      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
      expect(optimisticValidationStateAccount.isExecuted).to.equal(true);
    });

    it("should complete post optimistic execution for CeDeFiWallet", async () => {
      const jitoTipAccount2 = PublicKey.unique(); // Use different jito tip account

      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(jitoTip))
        .accountsPartial({
          jitoTipAccount: jitoTipAccount2,
          smartAccount: bob.sa,
          vaultState: bob.vaultState,
          smartAccountVault: bob.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
        })
        .rpc();

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(bob.sa)
          .then((v) => v.optimisticValidationState);

      const bobBalAfter = testBase.client.getBalance(bob.vault);
      const jitoTipAccount2BalAfter =
        testBase.client.getBalance(jitoTipAccount2);

      expect(optimisticValidationStateAccount).to.equal(null);
      expect(bobBalAfter).to.equal(
        initialBobBalance - totalFeeBob - transferAmount * BigInt(numTransfers)
      );
      expect(jitoTipAccount2BalAfter).to.equal(BigInt(jitoTip));
    });
  });

  describe("negative flow tests", () => {
    it("should fail to create EasyWallet without initial Solana signer", async () => {
      // Create dummy helper to get passkey
      const invalidDummyHelper = new SmartAccountHelper(
        generateIdFromString("temp invalid"),
        undefined, // No mandatory signer
        testBase.saProgram
      );

      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60);
      const salt = new Uint8Array(32);

      const invalidCreateArgs: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(invalidDummyHelper.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: null, // EasyWallet requires this to be Some
        initialRecoverySigner: invalidDummyHelper.recoverySigners[0].publicKey,
        accountType: { easyWallet: {} },
        salt: Array.from(salt),
      };

      const invalidId = generateGeneralAccountId(invalidCreateArgs);
      const invalidHelper = new SmartAccountHelper(
        Buffer.from(invalidId),
        undefined, // No mandatory signer
        testBase.saProgram,
        invalidDummyHelper.recoverySigners[0],
        validFrom,
        validUntil,
        invalidDummyHelper.passkeyKeypair
      );

      testBase.client.airdrop(
        invalidHelper.vault,
        BigInt(10 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const serializedArgsBuffer =
        serializeCreateGeneralAccountArgs(invalidCreateArgs);
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(1000000)); // 0.001 SOL for negative test
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0);

      const serializedIntent = Buffer.concat([
        serializedArgsBuffer,
        tokenAmountBuffer,
        tokenMintBuffer,
        Buffer.from(invalidHelper.sa.toBytes()),
        Buffer.from(invalidHelper.vault.toBytes()),
        Buffer.from(invalidHelper.vaultState.toBytes()),
      ]);

      const [message, signature, authData] = invalidHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      try {
        await testBase.saProgram.methods
          .createGeneralAccount(
            invalidCreateArgs,
            new anchor.BN(1000000),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            smartAccount: invalidHelper.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: invalidHelper.vault,
            vaultState: invalidHelper.vaultState,
            vaultTokenAccount: null,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              message,
              invalidHelper.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer])
          .rpc();

        assert.fail(
          "Should have failed without initial Solana signer for EasyWallet"
        );
      } catch (error) {
        expect(error.error.errorMessage).to.include(
          "Initial Solana keysigner not found"
        );
      }
    });

    it("should fail to create CeDeFiWallet with initial Solana signer", async () => {
      // Create dummy helper to get passkey
      const invalidDummyHelper2 = new SmartAccountHelper(
        generateIdFromString("temp invalid 2"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60);
      const salt = new Uint8Array(32);

      const invalidCreateArgs2: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(invalidDummyHelper2.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: {
          pubkey: testBase.mandatorySigner.publicKey,
          validFrom,
          validUntil,
        }, // CeDeFiWallet requires this to be None
        initialRecoverySigner: invalidDummyHelper2.recoverySigners[0].publicKey,
        accountType: { ceDeFiWallet: {} },
        salt: Array.from(salt),
      };

      const invalidId2 = generateGeneralAccountId(invalidCreateArgs2);
      const invalidHelper = new SmartAccountHelper(
        Buffer.from(invalidId2),
        testBase.mandatorySigner,
        testBase.saProgram,
        invalidDummyHelper2.recoverySigners[0],
        validFrom,
        validUntil,
        invalidDummyHelper2.passkeyKeypair
      );

      testBase.client.airdrop(
        invalidHelper.vault,
        BigInt(10 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const serializedArgsBuffer =
        serializeCreateGeneralAccountArgs(invalidCreateArgs2);
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(1000000)); // 0.001 SOL for negative test
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0);

      const serializedIntent = Buffer.concat([
        serializedArgsBuffer,
        tokenAmountBuffer,
        tokenMintBuffer,
        Buffer.from(invalidHelper.sa.toBytes()),
        Buffer.from(invalidHelper.vault.toBytes()),
        Buffer.from(invalidHelper.vaultState.toBytes()),
      ]);

      const [message, signature, authData] = invalidHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      try {
        await testBase.saProgram.methods
          .createGeneralAccount(
            invalidCreateArgs2,
            new anchor.BN(1000000),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            smartAccount: invalidHelper.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: invalidHelper.vault,
            vaultState: invalidHelper.vaultState,
            vaultTokenAccount: null,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              message,
              invalidHelper.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer])
          .rpc();

        assert.fail(
          "Should have failed with initial Solana signer for CeDeFiWallet"
        );
      } catch (error) {
        expect(error.error.errorMessage).to.include(
          "Initial Solana keysigner not allowed"
        );
      }
    });

    it("should fail to create account with invalid account type", async () => {
      // Create dummy helper to get passkey
      const invalidDummyHelper3 = new SmartAccountHelper(
        generateIdFromString("temp invalid 3"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

      const now = Math.floor(Date.now() / 1000);
      const validFrom = new anchor.BN(now);
      const validUntil = new anchor.BN(now + 365 * 24 * 60 * 60);
      const salt = new Uint8Array(32);

      const invalidCreateArgs3: CreateGeneralAccountArgs = {
        userPasskey: {
          pubkey: Array.from(invalidDummyHelper3.getPasskeyPubkey()),
          validFrom,
          validUntil,
        },
        initialSolanaSigner: null,
        initialRecoverySigner: invalidDummyHelper3.recoverySigners[0].publicKey,
        accountType: { payWallet: {} }, // payWallet is not supported by createGeneralAccount
        salt: Array.from(salt),
      };

      const invalidId3 = generateGeneralAccountId(invalidCreateArgs3);
      const invalidHelper = new SmartAccountHelper(
        Buffer.from(invalidId3),
        testBase.mandatorySigner,
        testBase.saProgram,
        invalidDummyHelper3.recoverySigners[0],
        validFrom,
        validUntil,
        invalidDummyHelper3.passkeyKeypair
      );

      testBase.client.airdrop(
        invalidHelper.vault,
        BigInt(10 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const serializedArgsBuffer =
        serializeCreateGeneralAccountArgs(invalidCreateArgs3);
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(1000000)); // 0.001 SOL for negative test
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0);

      const serializedIntent = Buffer.concat([
        serializedArgsBuffer,
        tokenAmountBuffer,
        tokenMintBuffer,
        Buffer.from(invalidHelper.sa.toBytes()),
        Buffer.from(invalidHelper.vault.toBytes()),
        Buffer.from(invalidHelper.vaultState.toBytes()),
      ]);

      const [message, signature, authData] = invalidHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      try {
        await testBase.saProgram.methods
          .createGeneralAccount(
            invalidCreateArgs3,
            new anchor.BN(1000000),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            smartAccount: invalidHelper.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: invalidHelper.vault,
            vaultState: invalidHelper.vaultState,
            vaultTokenAccount: null,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              message,
              invalidHelper.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer])
          .rpc();

        assert.fail("Should have failed with invalid account type");
      } catch (error) {
        expect(error.error.errorMessage).to.include(
          "Invalid smart account type in arguments"
        );
      }
    });
  });
});
