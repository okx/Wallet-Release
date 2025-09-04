import * as anchor from "@coral-xyz/anchor";
import { assert, expect } from "chai";
import { TestBase } from "../utils/testBase";
import { SmartAccountHelper } from "../utils/smartAccount/helpers";
import { LAMPORTS_PER_SIGNER, SMART_ACCOUNT_SEED } from "../utils/consts";
import { Program } from "@coral-xyz/anchor";
import { UpgradeMock } from "../../../target/types/upgrade_mock";
import {
  generateIdFromString,
  getConfigAccount,
  getDkimEntryAccount,
} from "../utils/helpers";
import { createSecp256r1Instruction } from "../utils/r1-utils";
import { buildBn128, utils } from "ffjavascript";
import { g1Uncompressed, g2Uncompressed } from "../utils/zkUtils";
const { unstringifyBigInts } = utils;
import fs, { readFileSync } from "fs";
import path, { parse } from "path";
import * as wasm from "../../wasm/pkg/wasm";
import { LAMPORTS_PER_SOL } from "@solana/web3.js";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../utils/webauthn";
import { MockATA } from "../setup/config";
import { TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { IntentTree } from "../utils/intent-tree";
import { ethers } from "ethers";

describe("Smart Account Migration Tests", () => {
  let testBase: TestBase;
  let upgradeMockProgram: Program<UpgradeMock>;

  // Migration-specific test data
  let smartAccountHelper: SmartAccountHelper;
  let mandatorySigner: anchor.web3.Keypair;
  let smartAccountV1: anchor.web3.PublicKey;
  let smartAccountV2: anchor.web3.PublicKey;
  let vault: anchor.web3.PublicKey;
  let vaultState: anchor.web3.PublicKey;
  let emailNulliferHex: string;
  let emailHashHex: string;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();
    upgradeMockProgram = testBase.upgradeMockProgram;

    // Create isolated test data for migration using existing helpers
    mandatorySigner = anchor.web3.Keypair.generate();

    emailNulliferHex =
      "0x26D3980C92EFA3BD5D1E4E204F9C80D71CEB0D7BF4D2C53457BF45E71C457EE6";
    emailHashHex =
      "0x0668EC67BE5F7C5A5F57D65AA96741AE2EDCC9F53C3446074BA2CE84920183C5";

    // Create smart account helper with isolated test data
    smartAccountHelper = new SmartAccountHelper(
      generateIdFromString("migration"),
      mandatorySigner,
      testBase.saProgram,
      undefined,
      new anchor.BN(1730264400)
    );

    testBase.client.airdrop(
      smartAccountHelper.vault,
      BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
    );

    // Get the derived addresses from the helper
    smartAccountV1 = smartAccountHelper.sa;
    vault = smartAccountHelper.vault;
    vaultState = smartAccountHelper.vaultState;

    // Derive V2 address using the same ID but different program
    [smartAccountV2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from(SMART_ACCOUNT_SEED),
        Buffer.from(smartAccountHelper.getId()),
      ],
      upgradeMockProgram.programId
    );

    // Create the V1 smart account using existing helper
    await testBase.createSmartAccount(smartAccountHelper);
  });

  describe("Migration from V1 to V2", () => {
    it("should fail upgrades when program is not authorized", async () => {
      // Create migration instruction for the upgrade-mock program
      const migrationInstruction = await upgradeMockProgram.methods
        .migrateSmartAccountV1()
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          smartAccountV1: smartAccountV1,
          smartAccountV2: smartAccountV2,
          smartAccountVault: smartAccountHelper.vault,
          vaultState: smartAccountHelper.vaultState,
        })
        .instruction();

      const serializedIntent = await smartAccountHelper.prepareMigrationIntent(
        migrationInstruction,
        0,
        undefined, // No token mint for basic test
      );
      const [message, signature, authData] = smartAccountHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      try {
        // Call close_and_migrate on smart-account-solana program, which orchestrates the full migration
        await testBase.saProgram.methods
          .closeAndMigrate(
            migrationInstruction.data,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            payer: testBase.txPayer.publicKey,
            solanaSigner: mandatorySigner.publicKey,
            smartAccount: smartAccountV1,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: vault,
            vaultState: vaultState,
            newDelegatedProgram: upgradeMockProgram.programId,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .remainingAccounts(
            migrationInstruction.keys.map((account) => ({
              ...account,
              isSigner: account.pubkey.equals(smartAccountV1)
                ? false
                : account.isSigner,
            }))
          )
          .preInstructions([
            createSecp256r1Instruction(
              message,
              smartAccountHelper.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer, mandatorySigner])
          .rpc();
        expect.fail("Should have failed due to unauthorized program");
      } catch (error) {
        const parsed = testBase.parseError(error);
        // Should be an Anchor error with Unauthorized constraint violation
        expect(parsed.anchor.isAnchorError).to.be.true;
        expect(parsed.anchor.errorName).to.equal("UnauthorizedProgram");
      }
    });

    it("should successfully migrate smart account from V1 to V2 with complete state migration and vault update", async () => {
      // Add upgrade-mock program as authorized program in vault config
      await testBase.vaultProgram.methods
        .addAuthorizedProgram(upgradeMockProgram.programId)
        .accountsPartial({
          admin: testBase.admin.publicKey,
          config: testBase.vaultConfig,
        })
        .signers([testBase.admin])
        .rpc();
      testBase.provider.client.expireBlockhash();
      const txPayerBalanceBefore = await testBase.getBalance(
        testBase.txPayer.publicKey
      );

      // Get initial vault balance before migration (smart accounts don't hold funds)
      const initialVaultBalance = await testBase.getBalance(vault);

      // Fetch V1 state before migration
      const v1Account =
        await testBase.saProgram.account.smartAccount.fetch(smartAccountV1);

      // Calculate rent for the smart account that will be closed
      const smartAccountInfo =
        await testBase.provider.connection.getAccountInfo(smartAccountV1);
      const smartAccountRent = smartAccountInfo ? smartAccountInfo.lamports : 0;

      // Create migration instruction for the upgrade-mock program
      const migrationInstruction = await upgradeMockProgram.methods
        .migrateSmartAccountV1()
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          smartAccountV1: smartAccountV1,
          smartAccountV2: smartAccountV2,
          smartAccountVault: smartAccountHelper.vault,
          vaultState: smartAccountHelper.vaultState,
        })
        .instruction();

      let numSigners = 3; // 2 EOA signers + 1 R1 signature
      let executionFee = numSigners * LAMPORTS_PER_SIGNER;

      const serializedIntent = await smartAccountHelper.prepareMigrationIntent(
        migrationInstruction,
        executionFee,
        undefined, // No token mint for basic test
      );
      const [message, signature, authData] = smartAccountHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Call close_and_migrate on smart-account-solana program, which orchestrates the full migration
      await testBase.saProgram.methods
        .closeAndMigrate(
          migrationInstruction.data,
          new anchor.BN(executionFee),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          solanaSigner: mandatorySigner.publicKey,
          smartAccount: smartAccountV1,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: vault,
          vaultState: vaultState,
          newDelegatedProgram: upgradeMockProgram.programId,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          vaultTokenAccount: null,
          webauthnTable: testBase.webauthnTable,
        })
        .remainingAccounts(
          migrationInstruction.keys.map((account) => ({
            ...account,
            isSigner: account.pubkey.equals(smartAccountV1)
              ? false
              : account.isSigner,
          }))
        )
        .preInstructions([
          createSecp256r1Instruction(
            message,
            smartAccountHelper.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer, mandatorySigner])
        .rpc();

      // Fetch V2 state after migration
      const v2Account =
        await upgradeMockProgram.account.smartAccountV2.fetch(smartAccountV2);

      // Get the expected bump for V2 account
      const [_, expectedV2Bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [
          Buffer.from(SMART_ACCOUNT_SEED),
          Buffer.from(smartAccountHelper.getId()),
        ],
        upgradeMockProgram.programId
      );

      // Validate state transfer - only fields that exist in both V1 and V2
      expect(v2Account.id).to.deep.equal(v1Account.id);
      expect(v2Account.bump).to.deep.equal([expectedV2Bump]);
      expect(v2Account.nonce.toNumber()).to.equal(
        v1Account.nonce.toNumber() + 1
      );
      expect(v2Account.authorizationModel.payMultisig[0].threshold).to.equal(
        v1Account.authorizationModel.payMultisig[0].threshold
      );
      expect(
        v2Account.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      ).to.equal(
        v1Account.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      );
      for (
        let i = 0;
        i < v1Account.authorizationModel.payMultisig[0].userSigners.length;
        i++
      ) {
        expect(
          v2Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].pubkey.toString()
        ).to.equal(
          v1Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].pubkey.toString()
        );
        expect(
          v2Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].validFrom.toNumber()
        ).to.equal(
          v1Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].validFrom.toNumber()
        );
        expect(
          v2Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].validUntil.toNumber()
        ).to.equal(
          v1Account.authorizationModel.payMultisig[0].userSigners[
            i
          ].validUntil.toNumber()
        );
      }

      // Verify vault balance includes the reclaimed rent from closed smart account
      const smartAccountV2Rent = await testBase.getBalance(smartAccountV2);
      const vaultBalanceAfterMigration = await testBase.getBalance(vault);
      const expectedVaultBalance =
        initialVaultBalance +
        smartAccountRent -
        smartAccountV2Rent -
        executionFee;
      expect(vaultBalanceAfterMigration).to.equal(expectedVaultBalance);

      const txPayerBalanceAfter = await testBase.getBalance(
        testBase.txPayer.publicKey
      );
      expect(txPayerBalanceAfter).to.equal(txPayerBalanceBefore);

      // Verify vault state was updated automatically by close_and_migrate
      const updatedVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(vaultState);
      expect(updatedVaultState.delegatedProgram.toBase58()).to.equal(
        upgradeMockProgram.programId.toBase58()
      );
      expect(updatedVaultState.smartAccount.toBase58()).to.equal(
        smartAccountV2.toBase58()
      );
    });

    it("should successfully migrate smart account from V1 to V2 using SPL token pay", async () => {
      // Create a test SPL token mint if not already created
      if (!testBase.testSPL2022TokenMint) {
        await testBase.createTestSPL2022TokenMint();
      }

      // Create a new smart account helper for SPL token testing
      const splTokenHelper = new SmartAccountHelper(
        generateIdFromString("migration-spl-token"),
        mandatorySigner,
        testBase.saProgram
      );

      testBase.client.airdrop(
        splTokenHelper.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      // Get the derived addresses for SPL token testing
      const splTokenSmartAccountV1 = splTokenHelper.sa;
      const splTokenVault = splTokenHelper.vault;
      const splTokenVaultState = splTokenHelper.vaultState;

      // Derive V2 address using the same ID but different program
      const [splTokenSmartAccountV2] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [
            Buffer.from(SMART_ACCOUNT_SEED),
            Buffer.from(splTokenHelper.getId()),
          ],
          upgradeMockProgram.programId
        );

      // Create the V1 smart account
      await testBase.createSmartAccount(splTokenHelper);

      // Create token accounts for testing
      const splTokenVaultTokenAccount = testBase.getTokenAccountAddress(
        splTokenVault,
        true, // allowOwnerOffCurve = true for PDA
        true // is2022 = true
      );

      const splTokenTxPayerTokenAccount = testBase.getTokenAccountAddress(
        testBase.txPayer.publicKey,
        false, // allowOwnerOffCurve = false for regular account
        true // is2022 = true
      );

      // Mock token accounts with initial balances
      const splTokenVaultMockATA = MockATA(
        splTokenVault,
        testBase.testSPL2022TokenMint,
        BigInt(LAMPORTS_PER_SOL * 1000), // 1000 tokens
        true, // is2022 = true
        true // allowOwnerOffCurve = true for PDA
      );

      const splTokenTxPayerMockATA = MockATA(
        testBase.txPayer.publicKey,
        testBase.testSPL2022TokenMint,
        BigInt(LAMPORTS_PER_SOL * 1000), // 1000 tokens
        true, // is2022 = true
        false // allowOwnerOffCurve = false for regular account
      );

      // Set up mock token accounts
      testBase.provider.client.setAccount(
        splTokenVaultMockATA.address,
        splTokenVaultMockATA.info
      );
      testBase.provider.client.setAccount(
        splTokenTxPayerMockATA.address,
        splTokenTxPayerMockATA.info
      );

      // Get initial balances
      const initialVaultBalance = await testBase.getBalance(splTokenVault);
      const initialVaultTokenBalance = await testBase.getTokenBalance(
        splTokenVaultTokenAccount
      );
      const initialTxPayerTokenBalance = await testBase.getTokenBalance(
        splTokenTxPayerTokenAccount
      );

      testBase.provider.client.expireBlockhash();

      // Fetch V1 state before migration
      const v1Account = await testBase.saProgram.account.smartAccount.fetch(
        splTokenSmartAccountV1
      );

      // Calculate rent for the smart account that will be closed
      const smartAccountInfo =
        await testBase.provider.connection.getAccountInfo(
          splTokenSmartAccountV1
        );
      const smartAccountRent = smartAccountInfo ? smartAccountInfo.lamports : 0;

      // Create migration instruction for the upgrade-mock program
      const migrationInstruction = await upgradeMockProgram.methods
        .migrateSmartAccountV1()
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          smartAccountV1: splTokenSmartAccountV1,
          smartAccountV2: splTokenSmartAccountV2,
          smartAccountVault: splTokenVault,
          vaultState: splTokenVaultState,
        })
        .instruction();

      const tokenAmount = BigInt(1000000); // 1 token with 6 decimals

      const serializedIntent = await splTokenHelper.prepareMigrationIntent(
        migrationInstruction,
        Number(tokenAmount), // Convert bigint to number
        testBase.testSPL2022TokenMint, // Use SPL token mint
      );
      const [message, signature, authData] = splTokenHelper.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Call close_and_migrate on smart-account-solana program with SPL token pay
      await testBase.saProgram.methods
        .closeAndMigrate(
          migrationInstruction.data,
          new anchor.BN(tokenAmount),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          null
        )
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          solanaSigner: mandatorySigner.publicKey,
          smartAccount: splTokenSmartAccountV1,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: splTokenVault,
          vaultState: splTokenVaultState,
          newDelegatedProgram: upgradeMockProgram.programId,
          tokenMint: testBase.testSPL2022TokenMint,
          destinationTokenAccount: splTokenTxPayerTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
          vaultTokenAccount: splTokenVaultTokenAccount,
          webauthnTable: testBase.webauthnTable,
        })
        .remainingAccounts(
          migrationInstruction.keys.map((account) => ({
            ...account,
            isSigner: account.pubkey.equals(splTokenSmartAccountV1)
              ? false
              : account.isSigner,
          }))
        )
        .preInstructions([
          createSecp256r1Instruction(
            message,
            splTokenHelper.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer, mandatorySigner])
        .rpc();

      // Fetch V2 state after migration
      const v2Account = await upgradeMockProgram.account.smartAccountV2.fetch(
        splTokenSmartAccountV2
      );

      // Get the expected bump for V2 account
      const [_, expectedV2Bump] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(SMART_ACCOUNT_SEED), Buffer.from(splTokenHelper.getId())],
        upgradeMockProgram.programId
      );

      // Validate state transfer - only fields that exist in both V1 and V2
      expect(v2Account.id).to.deep.equal(v1Account.id);
      expect(v2Account.bump).to.deep.equal([expectedV2Bump]);
      expect(v2Account.nonce.toNumber()).to.equal(
        v1Account.nonce.toNumber() + 1
      );
      expect(v2Account.authorizationModel.payMultisig[0].threshold).to.equal(
        v1Account.authorizationModel.payMultisig[0].threshold
      );

      expect(
        v2Account.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      ).to.equal(
        v1Account.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      );

      // Verify vault balance includes the reclaimed rent from closed smart account
      const smartAccountV2Rent = await testBase.getBalance(
        splTokenSmartAccountV2
      );
      const vaultBalanceAfterMigration =
        await testBase.getBalance(splTokenVault);
      const expectedVaultBalance =
        initialVaultBalance + smartAccountRent - smartAccountV2Rent;
      expect(vaultBalanceAfterMigration).to.equal(expectedVaultBalance);

      // Verify token balance changes
      const finalVaultTokenBalance = await testBase.getTokenBalance(
        splTokenVaultTokenAccount
      );
      const finalTxPayerTokenBalance = await testBase.getTokenBalance(
        splTokenTxPayerTokenAccount
      );

      expect(finalVaultTokenBalance).to.equal(
        initialVaultTokenBalance - tokenAmount
      );
      expect(finalTxPayerTokenBalance).to.equal(
        initialTxPayerTokenBalance + tokenAmount
      );

      // Verify vault state was updated automatically by close_and_migrate
      const updatedVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(
          splTokenVaultState
        );
      expect(updatedVaultState.delegatedProgram.toBase58()).to.equal(
        upgradeMockProgram.programId.toBase58()
      );
      expect(updatedVaultState.smartAccount.toBase58()).to.equal(
        splTokenSmartAccountV2.toBase58()
      );
    });

    it("should demonstrate that V2 can be used as delegated account in vault operations", async () => {
      // Create a test recipient
      const recipient = anchor.web3.Keypair.generate();
      const transferAmount = 1000000; // 0.001 SOL

      // Airdrop SOL to the vault using LiteSVM
      testBase.provider.client.airdrop(vault, BigInt(transferAmount * 3));

      // Get initial balances
      const vaultInitialBalance = await testBase.getBalance(vault);
      const recipientInitialBalance = await testBase.getBalance(
        recipient.publicKey
      );

      // Test direct vault transfer using V2 as the delegated smart account
      try {
        const transferTx = await upgradeMockProgram.methods
          .vaultTransferSol(new anchor.BN(transferAmount))
          .accountsPartial({
            payer: testBase.txPayer.publicKey,
            mandatorySigner: mandatorySigner.publicKey,
            smartAccount: smartAccountV2, // Use V2 as the delegated account
            vaultProgram: testBase.vaultProgram.programId,
            vaultState: vaultState,
            smartAccountVault: vault,
            systemProgram: anchor.web3.SystemProgram.programId,
            recipient: recipient.publicKey,
          })
          .signers([testBase.txPayer, mandatorySigner])
          .rpc();

        // Verify the transfer occurred
        const vaultFinalBalance = await testBase.getBalance(vault);
        const recipientFinalBalance = await testBase.getBalance(
          recipient.publicKey
        );

        // Verify balances changed correctly
        expect(vaultFinalBalance).to.be.lessThan(vaultInitialBalance);
        expect(recipientFinalBalance).to.be.greaterThan(
          recipientInitialBalance
        );
      } catch (error) {
        console.error("V2 vault operation failed:", error);
        const parsedError = testBase.parseError(error);
        console.log("Error analysis:", parsedError.summary);
        throw error;
      }
    });

    it("should verify V1 account was closed during migration", async () => {
      // Verify that the V1 account was properly closed during the migration process
      try {
        await testBase.saProgram.account.smartAccount.fetch(smartAccountV1);
        throw new Error(
          "V1 smart account should have been closed but still exists"
        );
      } catch (error) {
        // This is expected - the account should be closed
        if (
          error.message.includes("Account does not exist") ||
          error.message.includes("Could not find")
        ) {
        } else {
          throw error; // Re-throw if it's a different error
        }
      }
    });

    it("should migrate with intent tree proofs", async () => {
      let bob = new SmartAccountHelper(
        generateIdFromString("migration_bob"),
        mandatorySigner,
        testBase.saProgram
      );

      // Add some initial balance to vault so it exists
      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      let [bobV2] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(SMART_ACCOUNT_SEED), Buffer.from(bob.getId())],
        upgradeMockProgram.programId
      );
      await testBase.createSmartAccount(bob);

      // Create migration instruction for the upgrade-mock program
      let migrationIx = await upgradeMockProgram.methods
        .migrateSmartAccountV1()
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          smartAccountV1: bob.sa,
          smartAccountV2: bobV2,
          smartAccountVault: bob.vault,
          vaultState: bob.vaultState,
        })
        .instruction();

      let intent = await bob.prepareMigrationIntent(
        migrationIx,
        0,
        undefined, // No token mint for basic test
      );

      const intentTree = new IntentTree([
        ethers.keccak256(Buffer.from(intent)),
        ethers.keccak256(ethers.keccak256(Buffer.from(intent))), // mock hash
      ]);

      const [bobMessage, bobSignature, bobAuthData] = bob.signIntent(
        Uint8Array.from(ethers.toBeArray(intentTree.getRoot())),
        false
      );

      let proof = intentTree.getProof(ethers.keccak256(Buffer.from(intent)));

      await testBase.saProgram.methods
        .closeAndMigrate(
          migrationIx.data,
          new anchor.BN(0),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          proof
        )
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          solanaSigner: mandatorySigner.publicKey,
          smartAccount: bob.sa,
          vaultProgram: testBase.vaultProgram.programId,
          vaultConfig: testBase.vaultConfig,
          smartAccountVault: bob.vault,
          vaultState: bob.vaultState,
          newDelegatedProgram: upgradeMockProgram.programId,
          webauthnTable: testBase.webauthnTable,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
          vaultTokenAccount: null,
        })
        .remainingAccounts(
          migrationIx.keys.map((account) => ({
            ...account,
            isSigner: account.pubkey.equals(bob.sa) ? false : account.isSigner,
          }))
        )
        .preInstructions([
          createSecp256r1Instruction(
            bobMessage,
            bob.getPasskeyPubkey(),
            bobSignature
          ),
        ])
        .signers([testBase.txPayer, mandatorySigner])
        .rpc();
    });
  });

  describe("recover", () => {
    let curve: any;
    let proof: any;
    let newPasskeyPublicKeyBase64: string;
    let newPasskeyPublicKey: any;
    let pi_a_0_u8_array: any;
    let pi_b_0_u8_array: any;
    let pi_c_0_u8_array: any;

    before(async () => {
      curve = await buildBn128(true);

      proof = JSON.parse(
        fs.readFileSync(path.join(__dirname, "../emails/proof2.json"), "utf-8")
      );

      newPasskeyPublicKeyBase64 =
        "A/qW4YjS/gXyRgLiEDYNeWrGdH9B6P6WwiKBEnhz6p57";
      newPasskeyPublicKey = Buffer.from(newPasskeyPublicKeyBase64, "base64");
    });

    describe("convert proof to json", () => {
      it("should convert proof to json", async () => {
        let proofProc = unstringifyBigInts(proof);
        // console.log("proof:", proofProc);

        let pi_a = g1Uncompressed(curve, proofProc.pi_a);
        pi_a = Buffer.from(wasm.convert_proof(pi_a));
        // console.log("pi_a:", pi_a);
        pi_a_0_u8_array = Array.from(pi_a);
        // console.log("proof a:", pi_a_0_u8_array);

        const pi_b = g2Uncompressed(curve, proofProc.pi_b);
        // console.log("precompression proof b:", proofProc.pi_b);
        pi_b_0_u8_array = Array.from(pi_b);
        // console.log("proof b:", pi_b_0_u8_array);

        const pi_c = g1Uncompressed(curve, proofProc.pi_c);
        pi_c_0_u8_array = Array.from(pi_c);
        // console.log("proof c:", pi_c_0_u8_array);
      });
    });

    describe("recover", () => {
      it("should recover", async () => {
        const saAccount =
          await upgradeMockProgram.account.smartAccountV2.fetch(smartAccountV2);

        const zkVerifierAccount = anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from("zk_verifier"), Buffer.from(smartAccountHelper.getId())],
          testBase.zkProgram.programId
        )[0];
        const dkimEntryPda = getDkimEntryAccount(
          Buffer.from(testBase.domainHash),
          Buffer.from(testBase.keyHash)
        );

        const saConfigPda = getConfigAccount(upgradeMockProgram.programId);
        testBase.provider.client.withSigverify(false);
        const sim = await testBase.zkProgram.methods
          .recover(
            {
              emailDomain: "gmail.com",
              dkimPubkeyHash: Array.from(testBase.keyHash),
              emailNullifer: Array.from(
                Buffer.from(emailNulliferHex.substring(2), "hex")
              ),
              emailHash: Array.from(
                Buffer.from(emailHashHex.substring(2), "hex")
              ),
              pubkey: Array.from(newPasskeyPublicKey),
              timestamp: new anchor.BN(1753330284),
              timestampStr: "2025-07-24 12:11:00",
            },
            {
              proofA: pi_a_0_u8_array,
              proofB: pi_b_0_u8_array,
              proofC: pi_c_0_u8_array,
            }
          )
          .accounts({
            recoverySigner: smartAccountHelper.recoverySigners[0].publicKey,
            feeRecipient: smartAccountHelper.recoverySigners[0].publicKey,
            // @ts-ignore
            smartAccount: smartAccountV2,
            smartAccountConfig: saConfigPda,
            smartAccountProgram: upgradeMockProgram.programId,
            smartAccountVault: vault,
            zkVerifierAccount,
            entryPda: dkimEntryPda,
            sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            vaultProgram: testBase.vaultProgram.programId,
            vaultState: vaultState,
          })
          .signers([smartAccountHelper.recoverySigners[0]])
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 500_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 1000,
            }),
          ])
          .simulate();
        // console.log(sim);

        testBase.provider.client.withSigverify(true);
        const tx = await testBase.zkProgram.methods
          .recover(
            {
              emailDomain: "gmail.com",
              dkimPubkeyHash: Array.from(testBase.keyHash),
              emailNullifer: Array.from(
                Buffer.from(emailNulliferHex.substring(2), "hex")
              ),
              emailHash: Array.from(
                Buffer.from(emailHashHex.substring(2), "hex")
              ),
              pubkey: Array.from(newPasskeyPublicKey),
              timestamp: new anchor.BN(1753330284),
              timestampStr: "2025-07-24 12:11:00",
            },
            {
              proofA: pi_a_0_u8_array,
              proofB: pi_b_0_u8_array,
              proofC: pi_c_0_u8_array,
            }
          )
          .accounts({
            recoverySigner: smartAccountHelper.recoverySigners[0].publicKey,
            feeRecipient: smartAccountHelper.recoverySigners[0].publicKey,
            // @ts-ignore
            smartAccount: smartAccountV2,
            smartAccountConfig: saConfigPda,
            smartAccountProgram: upgradeMockProgram.programId,
            smartAccountVault: vault,
            zkVerifierAccount,
            entryPda: dkimEntryPda,
            sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            vaultProgram: testBase.vaultProgram.programId,
            vaultState: vaultState,
          })
          .signers([smartAccountHelper.recoverySigners[0]])
          .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
              units: 500_000,
            }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 1000,
            }),
          ])
          .rpc();

        const updatedAccount =
          await upgradeMockProgram.account.smartAccountV2.fetch(smartAccountV2);
        expect(
          updatedAccount.authorizationModel.payMultisig[0].userSigners.length
        ).to.equal(1);
        expect(
          updatedAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
        ).to.deep.equal(Array.from(newPasskeyPublicKey));
        expect(
          updatedAccount.authorizationModel.payMultisig[0].userSigners[0].validFrom.toString()
        ).to.equal(new anchor.BN(1753330284).toString());
        // check recovery fees, recovery signer should have 10 SOL
        const recoverySignerBalance2 = testBase.provider.client.getBalance(
          smartAccountHelper.recoverySigners[0].publicKey
        );
        expect(Number(recoverySignerBalance2)).to.equal(5500);
      });
    });
  });

  describe("Migration validation", () => {
    let alice: SmartAccountHelper;
    let migrationInstruction: anchor.web3.TransactionInstruction;
    let serializedIntent: number[];
    let message: Buffer<ArrayBufferLike>;
    let signature: Buffer<ArrayBufferLike>;
    let authData: Buffer<ArrayBufferLike>;

    let aliceV2: anchor.web3.PublicKey;

    before(async () => {
      alice = new SmartAccountHelper(
        generateIdFromString("migration_alice"),
        mandatorySigner,
        testBase.saProgram
      );

      // Add some initial balance to vault so it exists
      testBase.client.airdrop(
        alice.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      [aliceV2] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from(SMART_ACCOUNT_SEED), Buffer.from(alice.getId())],
        upgradeMockProgram.programId
      );
      await testBase.createSmartAccount(alice);

      // Create migration instruction for the upgrade-mock program
      migrationInstruction = await upgradeMockProgram.methods
        .migrateSmartAccountV1()
        .accountsPartial({
          payer: testBase.txPayer.publicKey,
          smartAccountV1: alice.sa,
          smartAccountV2: aliceV2,
          smartAccountVault: alice.vault,
          vaultState: alice.vaultState,
        })
        .instruction();

      serializedIntent = await alice.prepareMigrationIntent(
        migrationInstruction,
        0,
        undefined
      );
      [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );
    });

    it("should validate vault state account", async () => {
      try {
        await testBase.saProgram.methods
          .closeAndMigrate(
            migrationInstruction.data,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            payer: testBase.txPayer.publicKey,
            solanaSigner: alice.mandatorySigner.publicKey,
            smartAccount: alice.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: alice.vault,
            vaultState: smartAccountHelper.vaultState,
            newDelegatedProgram: upgradeMockProgram.programId,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .remainingAccounts(
            migrationInstruction.keys.map((account) => ({
              ...account,
              isSigner: account.pubkey.equals(alice.sa)
                ? false
                : account.isSigner,
            }))
          )
          .preInstructions([
            createSecp256r1Instruction(
              message,
              alice.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer, mandatorySigner])
          .rpc();
        assert.fail(
          "should have failed due to A seeds constraint was violated"
        );
      } catch (error) {
        expect(error.error.errorMessage).to.equal(
          "A seeds constraint was violated"
        );
      }
    });

    it("should validate vault config account", async () => {
      try {
        await testBase.saProgram.methods
          .closeAndMigrate(
            migrationInstruction.data,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            payer: testBase.txPayer.publicKey,
            solanaSigner: alice.mandatorySigner.publicKey,
            smartAccount: alice.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: alice.vaultState,
            smartAccountVault: alice.vault,
            vaultState: alice.vaultState,
            newDelegatedProgram: upgradeMockProgram.programId,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .remainingAccounts(
            migrationInstruction.keys.map((account) => ({
              ...account,
              isSigner: account.pubkey.equals(alice.sa)
                ? false
                : account.isSigner,
            }))
          )
          .preInstructions([
            createSecp256r1Instruction(
              message,
              alice.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer, mandatorySigner])
          .rpc();
        assert.fail("should have failed due to invalid vault state account");
      } catch (error) {
        expect(error.error.errorMessage).to.equal(
          "Account discriminator did not match what was expected"
        );
      }
    });
    it("should validate vault account", async () => {
      try {
        await testBase.saProgram.methods
          .closeAndMigrate(
            migrationInstruction.data,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            payer: testBase.txPayer.publicKey,
            solanaSigner: alice.mandatorySigner.publicKey,
            smartAccount: alice.sa,
            vaultProgram: testBase.vaultProgram.programId,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: smartAccountHelper.vault,
            vaultState: alice.vaultState,
            newDelegatedProgram: upgradeMockProgram.programId,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .remainingAccounts(
            migrationInstruction.keys.map((account) => ({
              ...account,
              isSigner: account.pubkey.equals(alice.sa)
                ? false
                : account.isSigner,
            }))
          )
          .preInstructions([
            createSecp256r1Instruction(
              message,
              alice.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer, mandatorySigner])
          .rpc();
        assert.fail(
          "should have failed due to A seeds constraint was violated"
        );
      } catch (error) {
        expect(error.error.errorMessage).to.equal(
          "A seeds constraint was violated"
        );
      }
    });
  });
});
