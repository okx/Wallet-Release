import * as anchor from "@coral-xyz/anchor";
import { generateIdFromString } from "../utils/helpers";
import { SmartAccountHelper } from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import {
  LAMPORTS_PER_SIGNER,
  SMART_ACCOUNT_VAULT_SEED,
  VAULT_STATE_SEED,
} from "../utils/consts";
import { createSecp256r1Instruction } from "../utils/r1-utils";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../utils/webauthn";
import { FailedTransactionMetadata, TransactionMetadata } from "litesvm";
import { MockATA } from "../setup/config";
import {
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";
import { ethers } from "ethers";
import { IntentTree } from "../utils/intent-tree";

describe("smart-account-solana", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();
    alice = new SmartAccountHelper(
      generateIdFromString("user 1"),
      testBase.mandatorySigner,
      testBase.saProgram
    );
  });

  describe("config state", () => {
    it("config state should be successfully written", async () => {
      await testBase.assertConfigState();
      await testBase.assertVaultConfigState();
    });
  });

  describe("smart account", () => {
    it("should create smart account as creator", async () => {
      testBase.client.airdrop(
        alice.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      const smartAccountSize = BigInt(296);
      const vaultStateSize = BigInt(107);

      const rent =
        testBase.client.getRent().minimumBalance(smartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 3); // 2 EOA signer
      const totalFees = rent + executionFees;

      await testBase.createSmartAccount(alice);

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      // Use flexible balance assertions to account for small gas cost variations
      const actualDeduction = aliceBalBefore - aliceBalAfter;
      const tolerance = BigInt(50000); // 0.05 SOL tolerance for gas variations

      expect(Number(actualDeduction)).to.be.at.least(
        Number(totalFees - tolerance)
      );
      expect(Number(actualDeduction)).to.be.at.most(
        Number(totalFees + tolerance)
      );
      expect(txPayerBalBefore).to.equal(txPayerBalAfter);
    });

    it("should create smart account with the right fields", async () => {
      let saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      expect(saAccount.id).to.deep.equal(alice.getId());
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(alice.getPasskeyPubkey()));
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].validFrom.toNumber()
      ).to.equal(alice.validFrom.toNumber());
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].validUntil.toNumber()
      ).to.equal(alice.validUntil.toNumber());
      expect(
        saAccount.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      ).to.equal(alice.getMandatorySignerPubkey().toBase58());
      expect(saAccount.authorizationModel.payMultisig[0].threshold).to.equal(2);
      expect(saAccount.nonce.toNumber()).to.equal(0);
      expect(saAccount.recoverySigners.length).to.equal(1);
      expect(saAccount.recoverySigners[0].toString()).to.equal(
        alice.recoverySigners[0].publicKey.toString()
      );
    });

    it("should create vault state with the right fields", async () => {
      // Fetch the vault state account
      let vaultStateAccount =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);

      // Verify vault state fields
      expect(vaultStateAccount.id).to.deep.equal(alice.getId());
      expect(vaultStateAccount.smartAccount.toBase58()).to.equal(
        alice.sa.toBase58()
      );
      expect(vaultStateAccount.isValidated).to.equal(false);

      // Verify the vault bump matches the derived bump
      const [, expectedVaultBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(SMART_ACCOUNT_VAULT_SEED), Buffer.from(alice.getId())],
          testBase.vaultProgram.programId
        );
      expect(vaultStateAccount.vaultBump).to.equal(expectedVaultBump);

      // Verify the state bump matches the derived bump
      const [, expectedStateBump] =
        anchor.web3.PublicKey.findProgramAddressSync(
          [Buffer.from(VAULT_STATE_SEED), Buffer.from(alice.getId())],
          testBase.vaultProgram.programId
        );
      expect(vaultStateAccount.stateBump).to.equal(expectedStateBump);
    });

    it("should validate passkey time constraints", async () => {
      const now = Math.floor(Date.now() / 1000) - 1;
      const futureTime = now + 100;
      const pastTime = now - 100;

      // Create account with custom validity period
      const bob = new SmartAccountHelper(
        generateIdFromString("user 2"),
        testBase.mandatorySigner,
        testBase.saProgram,
        undefined,
        new anchor.BN(pastTime),
        new anchor.BN(futureTime),
        undefined // passkeyKeypair - let it generate a new one
      );

      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      await testBase.createSmartAccount(bob);
      let saAccount = await testBase.saProgram.account.smartAccount.fetch(
        bob.sa
      );

      const userSigner =
        saAccount.authorizationModel.payMultisig[0].userSigners[0];
      expect(userSigner.validFrom.toNumber()).to.equal(
        bob.validFrom.toNumber()
      );
      expect(userSigner.validUntil.toNumber()).to.equal(
        bob.validUntil.toNumber()
      );
    });

    it("should create smart account with SPL token pay", async () => {
      // Create a test SPL token mint if not already created
      if (!testBase.testSPL2022TokenMint) {
        await testBase.createTestSPL2022TokenMint();
      }

      const charlie = new SmartAccountHelper(
        generateIdFromString("user 3"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

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

      // Mock token accounts with initial balances (similar to optimistic execution test)
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

      // Get initial token balances (similar to optimistic execution test)
      const initialCharlieSPLBalance =
        await testBase.getTokenBalance(charlieTokenAccount);
      const initialTxPayerSPLBalance =
        await testBase.getTokenBalance(txPayerTokenAccount);

      const smartAccountSize = BigInt(296);
      const vaultStateSize = BigInt(107);

      const rent =
        testBase.client.getRent().minimumBalance(smartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 3); // 2 EOA signer + 1 R1 Signature Verify
      const totalFees = rent + executionFees;
      const tokenAmount = BigInt(1000000);

      // Create smart account with SPL token pay support
      await testBase.createSmartAccountWithSPL(
        charlie,
        testBase.testSPL2022TokenMint,
        tokenAmount,
        true // is2022 = true
      );

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

      // Verify smart account was created with correct fields
      let saAccount = await testBase.saProgram.account.smartAccount.fetch(
        charlie.sa
      );
      expect(saAccount.id).to.deep.equal(charlie.getId());
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(charlie.getPasskeyPubkey()));
      expect(saAccount.authorizationModel.payMultisig[0].threshold).to.equal(2);
      expect(saAccount.nonce.toNumber()).to.equal(0);
      expect(saAccount.recoverySigners.length).to.equal(1);
      expect(saAccount.recoverySigners[0].toString()).to.equal(
        charlie.recoverySigners[0].publicKey.toString()
      );

      // Verify vault state was created
      let vaultStateAccount =
        await testBase.vaultProgram.account.vaultState.fetch(
          charlie.vaultState
        );
      expect(vaultStateAccount.id).to.deep.equal(charlie.getId());
      expect(vaultStateAccount.smartAccount.toBase58()).to.equal(
        charlie.sa.toBase58()
      );
      expect(vaultStateAccount.isValidated).to.equal(false);
    });
  });

  describe("smart account creation validation", () => {
    let bob: SmartAccountHelper;
    let charlie: SmartAccountHelper;
    let createPayAccountArgs: any;
    let message: Buffer<ArrayBufferLike>;
    let signature: Buffer<ArrayBufferLike>;
    let authData: Buffer<ArrayBufferLike>;

    // create account args and serialized intent
    before(async () => {
      bob = new SmartAccountHelper(
        generateIdFromString("user bob"),
        testBase.mandatorySigner,
        testBase.saProgram
      );
      createPayAccountArgs = {
        id: bob.getId(),
        userPasskey: bob.getPasskey(),
        solanaSigner: bob.getMandatorySignerPubkey(),
      };
      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const createAccountArgsBuffer = testBase.saProgram.coder.types.encode(
        "createPayAccountArgs",
        createPayAccountArgs
      );

      const totalFees = BigInt(0);
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(totalFees);
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant (no token mint)
      const saBuffer = bob.sa.toBuffer();
      const vaultBuffer = bob.vault.toBuffer();
      const vaultStateBuffer = bob.vaultState.toBuffer();
      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        createAccountArgsBuffer,
        saBuffer,
        vaultBuffer,
        vaultStateBuffer,
      ]);

      [message, signature, authData] = bob.signIntent(
        Uint8Array.from(serializedIntent)
      );
    });
    it("should validate vault config", async () => {
      try {
        const executeTx = await testBase.saProgram.methods
          .createPayAccount(
            createPayAccountArgs,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            creator: testBase.creator.publicKey,
            vaultProgram: testBase.vaultProgram.programId,
            config: testBase.config,
            vaultConfig: alice.vaultState,
            smartAccountVault: bob.vault,
            vaultState: bob.vaultState,
            smartAccount: bob.sa,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              message,
              bob.getPasskeyPubkey(),
              signature
            ),
          ])
          .signers([testBase.txPayer, testBase.creator])
          // .transaction();
          .rpc();
        // executeTx.recentBlockhash =
        //   await testBase.provider.client.latestBlockhash();
        // executeTx.sign(testBase.txPayer, testBase.creator);

        // let res = await testBase.provider.client.sendTransaction(executeTx);
        // console.log("res", res);
        // res = res as FailedTransactionMetadata;
        // console.log("executeTx logs:", res.meta().logs());
        assert.fail(
          "should have failed due to Account discriminator did not match what was expected"
        );
      } catch (error) {
        expect(error.error.errorMessage).to.equal(
          "Account discriminator did not match what was expected"
        );
      }
    });

    it("should validate vault account", async () => {
      const createAccountArgsBuffer = testBase.saProgram.coder.types.encode(
        "createPayAccountArgs",
        createPayAccountArgs
      );
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(0));
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant (no token mint)
      const saBuffer = bob.sa.toBuffer();
      const vaultBuffer = alice.vault.toBuffer(); //incorrect vault
      const vaultStateBuffer = bob.vaultState.toBuffer();
      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        createAccountArgsBuffer,
        saBuffer,
        vaultBuffer,
        vaultStateBuffer,
      ]);

      const [messageMock, signatureMock, authDataMock] = bob.signIntent(
        Uint8Array.from(serializedIntent)
      );
      testBase.client.expireBlockhash();
      try {
        const tx = await testBase.saProgram.methods
          .createPayAccount(
            createPayAccountArgs,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            creator: testBase.creator.publicKey,
            vaultProgram: testBase.vaultProgram.programId,
            config: testBase.config,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: alice.vault,
            vaultState: bob.vaultState,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              messageMock,
              bob.getPasskeyPubkey(),
              signatureMock
            ),
          ])
          .signers([testBase.txPayer, testBase.creator])
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

    it("should validate vault state account", async () => {
      const createAccountArgsBuffer = testBase.saProgram.coder.types.encode(
        "createPayAccountArgs",
        createPayAccountArgs
      );
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(0));
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant (no token mint)
      const saBuffer = bob.sa.toBuffer();
      const vaultBuffer = bob.vault.toBuffer();
      const vaultStateBuffer = alice.vaultState.toBuffer(); //incorrect vault state
      const serializedIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        createAccountArgsBuffer,
        saBuffer,
        vaultBuffer,
        vaultStateBuffer,
      ]);

      const [messageMock, signatureMock, authDataMock] = bob.signIntent(
        Uint8Array.from(serializedIntent)
      );
      testBase.client.expireBlockhash();
      try {
        const tx = await testBase.saProgram.methods
          .createPayAccount(
            createPayAccountArgs,
            new anchor.BN(0),
            {
              clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
              authData: WebAuthnAuthDataHelpers.Index(0),
            } as any,
            null
          )
          .accountsPartial({
            txPayer: testBase.txPayer.publicKey,
            creator: testBase.creator.publicKey,
            vaultProgram: testBase.vaultProgram.programId,
            config: testBase.config,
            vaultConfig: testBase.vaultConfig,
            smartAccountVault: bob.vault,
            vaultState: alice.vaultState,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
            vaultTokenAccount: null,
            webauthnTable: testBase.webauthnTable,
          })
          .preInstructions([
            createSecp256r1Instruction(
              messageMock,
              bob.getPasskeyPubkey(),
              signatureMock
            ),
          ])
          .signers([testBase.txPayer, testBase.creator])
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

    it("should create pay account + transfer with intent tree proofs", async () => {
      let daniel = new SmartAccountHelper(
        generateIdFromString("user daniel"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

      testBase.client.airdrop(
        daniel.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const createPayAccountArgs = {
        id: daniel.getId(),
        userPasskey: daniel.getPasskey(),
        mandatorySigner: daniel.getMandatorySignerPubkey(),
        initialRecoverySigner: daniel.recoverySigners[0].publicKey,
      };

      //intent 1 - creation
      const createAccountArgsBuffer = daniel.saProgram.coder.types.encode(
        "createPayAccountArgs",
        createPayAccountArgs
      );
      const tokenAmountBuffer = Buffer.alloc(8);
      tokenAmountBuffer.writeBigUInt64LE(BigInt(0));
      const tokenMintBuffer = Buffer.alloc(1);
      tokenMintBuffer.writeUInt8(0); // None variant (no token mint)
      const saBuffer = daniel.sa.toBuffer();
      const vaultBuffer = daniel.vault.toBuffer();
      const vaultStateBuffer = daniel.vaultState.toBuffer();
      const createIntent = Buffer.concat([
        tokenAmountBuffer,
        tokenMintBuffer,
        createAccountArgsBuffer,
        saBuffer,
        vaultBuffer,
        vaultStateBuffer,
      ]);

      //intent 2 - execute transfer
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);
      const executionFee = BigInt(LAMPORTS_PER_SIGNER * 3); // 2 EOA signer + 1 R1 Signature Verify
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
        new anchor.BN(0) //first tx
      );

      const createIntentHash = ethers.keccak256(Buffer.from(createIntent));
      const transferIntentHash = ethers.keccak256(Buffer.from(transferIntent));

      const intentTree = new IntentTree([createIntentHash, transferIntentHash]);

      const [message, signature, authData] = daniel.signIntent(
        Buffer.from(ethers.toBeArray(intentTree.getRoot())),
        false
      );

      let proof1 = intentTree.getProof(createIntentHash);
      const createTx = await daniel.saProgram.methods
        .createPayAccount(
          createPayAccountArgs,
          new anchor.BN(0),
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          proof1
        )
        .accountsPartial({
          txPayer: testBase.txPayer.publicKey,
          creator: testBase.creator.publicKey,
          vaultProgram: testBase.vaultProgram.programId,
          config: testBase.config,
          vaultConfig: testBase.vaultConfig,
          vaultState: daniel.vaultState,
          smartAccountVault: daniel.vault,
          webauthnTable: testBase.webauthnTable,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
        })
        .preInstructions([
          createSecp256r1Instruction(
            message,
            daniel.getPasskeyPubkey(),
            signature
          ),
        ])
        .signers([testBase.txPayer, testBase.creator])
        .rpc();

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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.txPayer, testBase.mandatorySigner])
        .rpc();
    });
  });
});
