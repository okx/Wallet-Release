import { generateIdFromString } from "../utils/helpers";
import * as anchor from "@coral-xyz/anchor";
import {
  DeconstructedInstruction,
  SmartAccountHelper,
} from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import {
  Keypair,
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
import { IntentTree } from "../utils/intent-tree";
import { ethers } from "ethers";
import { createTransferInstruction } from "@solana/spl-token";
import { createMemoInstruction } from "@mrgnlabs/mrgn-common";

describe("e2e-sa-execution", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;
  let bob: SmartAccountHelper;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();
    alice = new SmartAccountHelper(
      generateIdFromString("user 1"),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    bob = new SmartAccountHelper(
      generateIdFromString("user 200"),
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
      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 3); // 2 EOA signer + 1 R1 Signature Verify
      const totalFees = rent + executionFees;

      await testBase.createSmartAccount(alice);

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      expect(aliceBalAfter).to.equal(aliceBalBefore - totalFees);
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
    });

    it("should validate execution and update state", async () => {
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

    it("should reject execution with malformed client data json - invalid response", async () => {
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

      const [message, signature, authData, clientJson] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // Remove type field
      const malformedClientJson = JSON.parse(clientJson);
      delete malformedClientJson.type;
      const malformedClientJsonString = JSON.stringify(malformedClientJson);

      try {
        await testBase.saProgram.methods
          .validateExecution(
            {
              clientDataJson: WebAuthnStringHelpers.Direct(
                malformedClientJsonString
              ),
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
        assert.fail("Should have failed with invalid response type");
      } catch (error: any) {
        expect(error.error.errorMessage).to.contain("Invalid response type");
      }
    });

    it("should reject execution with malformed client data json - invalid challenge", async () => {
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

      const [message, signature, authData, clientJson] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );

      // remove challenge field
      const malformedClientJson = JSON.parse(clientJson);
      delete malformedClientJson.challenge;
      const malformedClientJsonString = JSON.stringify(malformedClientJson);

      try {
        await testBase.saProgram.methods
          .validateExecution(
            {
              clientDataJson: WebAuthnStringHelpers.Direct(
                malformedClientJsonString
              ),
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
        assert.fail("Should have failed with invalid challenge");
      } catch (error: any) {
        expect(error.error.errorMessage).to.contain("Invalid challenge");
      }
    });

    it("should validate execution with a sol transfer prior", async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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
        .preInstructions([
          SystemProgram.transfer({
            fromPubkey: testBase.txPayer.publicKey,
            toPubkey: alice.vault,
            lamports: transferAmount,
          }),
        ])
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
        .signers([testBase.txPayer, testBase.mandatorySigner])
        .rpc();
    });

    it("should reject execution with non-system program instruction", async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      // Create a transaction with a non-system program instruction
      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

      try {
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
          .preInstructions([
            createMemoInstruction("hi", [testBase.txPayer.publicKey]),
          ])
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
          .signers([testBase.txPayer, testBase.mandatorySigner])
          .rpc();

        expect.fail("Should have failed with non-system program instruction");
      } catch (error: any) {
        expect(error.error.errorMessage).to.equal("Invalid sol transfer");
      }
    });

    it("should reject execution with non-transfer discriminator", async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

      let accountKey = Keypair.generate();

      try {
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
          .preInstructions([
            SystemProgram.createAccount({
              fromPubkey: testBase.txPayer.publicKey,
              newAccountPubkey: accountKey.publicKey,
              lamports: Number(transferAmount),
              space: 0,
              programId: SystemProgram.programId,
            }),
          ])
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
          .signers([testBase.txPayer, testBase.mandatorySigner, accountKey])
          .rpc();

        expect.fail("Should have failed with non-transfer discriminator");
      } catch (error: any) {
        expect(error.error.errorMessage).to.equal("Invalid sol transfer");
      }
    });

    it("should reject execution with transfer not to vault", async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      // Create a transaction with a system transfer that doesn't go to the vault
      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Mandatory Signer
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

      try {
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
          .preInstructions([
            SystemProgram.transfer({
              fromPubkey: testBase.txPayer.publicKey,
              toPubkey: alice.vaultState, // not the vault
              lamports: transferAmount,
            }),
          ])
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
          .signers([testBase.txPayer, testBase.mandatorySigner])
          .rpc();

        expect.fail("Should have failed with non-transfer discriminator");
      } catch (error: any) {
        expect(error.error.errorMessage).to.equal("Invalid sol transfer");
      }
    });

    it("should validate execution with intent tree proofs", async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);

      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );

      const numSignatures =
        1 + // Tx Payer
        1; // R1 Signature
      const executionFee = BigInt(numSignatures * LAMPORTS_PER_SIGNER);

      const intentRes1 = await alice.prepareUserIntent(cpiTX, {
        tokenAmount: Number(executionFee),
      });

      // using future nonce
      const intentRes2 = await alice.prepareUserIntent(
        cpiTX,
        {
          tokenAmount: Number(executionFee),
        },
        undefined,
        (await alice.fetchNonce()).add(new anchor.BN(1))
      );

      const intentHash1 = ethers.keccak256(
        Buffer.from(intentRes1.serializedIntent)
      );
      const intentHash2 = ethers.keccak256(
        Buffer.from(intentRes2.serializedIntent)
      );
      const intentTree = new IntentTree([intentHash1, intentHash2]);

      const [message, signature, authData] = alice.signIntent(
        Buffer.from(ethers.toBeArray(intentTree.getRoot())),
        false
      );

      let proof1 = intentTree.getProof(intentHash1);

      await testBase.saProgram.methods
        .validateExecution(
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          new anchor.BN(executionFee),
          proof1
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
              deconstructedInstructions: intentRes1.deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(intentRes1.remainingAccounts)
            .instruction(),
        ])
        .signers([testBase.mandatorySigner])
        .rpc();

      let proof2 = intentTree.getProof(intentHash2);

      await testBase.saProgram.methods
        .validateExecution(
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          new anchor.BN(executionFee),
          proof2
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
              deconstructedInstructions: intentRes1.deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(intentRes1.remainingAccounts)
            .instruction(),
        ])
        .signers([testBase.mandatorySigner])
        .rpc();
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
        new anchor.BN(pastTime), // validFrom
        new anchor.BN(futureTime), // validUntil
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
      expect(userSigner.validFrom.toNumber()).to.be.at.least(
        bob.validFrom.toNumber()
      );
      expect(userSigner.validUntil.toNumber()).to.equal(
        bob.validUntil.toNumber()
      );
    });
  });

  describe("negative flow tests", () => {
    let authData: Buffer<ArrayBufferLike>;
    let message: Buffer<ArrayBufferLike>;
    let signature: Buffer<ArrayBufferLike>;
    let serializedIntent: number[];
    let deconstructedInstructions: DeconstructedInstruction[];
    let remainingAccounts: anchor.web3.AccountMeta[];
    let numSigners: number;

    before(async () => {
      const transferAmount = BigInt(1 * LAMPORTS_PER_SOL);
      const cpiTX = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      );
      ({
        serializedIntent,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
      } = await alice.prepareUserIntent(cpiTX, { tokenAmount: 0 }));

      [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedIntent)
      );

      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );
      await testBase.createSmartAccount(bob);
    });

    describe("validate execution", () => {
      it("should validate vault program id", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: testBase.mandatorySigner.publicKey,
              smartAccount: alice.sa,
              vaultProgram: testBase.saProgram.programId,
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
              vaultTokenAccount: null,
              tokenMint: null,
              destinationTokenAccount: null,
              tokenProgram: null,
              webauthnTable: testBase.webauthnTable,
            })
            .signers([testBase.mandatorySigner])
            .rpc();
        } catch (error) {
          expect(error.error.errorMessage).to.equal("Invalid vault program");
        }
      });

      it("should validate user vault state derivation", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: testBase.mandatorySigner.publicKey,
              smartAccount: alice.sa,
              vaultState: bob.vaultState, //incorrect vault state
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
          assert.fail("should revert with unauthorized smart account");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Invalid vault instruction"
          );
        }
      });

      it("should validate user vault derivation", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: testBase.mandatorySigner.publicKey,
              smartAccount: alice.sa,
              vaultState: alice.vaultState,
              smartAccountVault: bob.vault, //incorrect vault
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
          assert.fail("should revert with seeds constraint violation");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Invalid vault instruction"
          );
        }
      });

      it("should validate r1 signature instruction inclusion", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
          assert.fail("should revert with Secp256r1 instruction not found");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Secp256r1 instruction not found"
          );
        }
      });

      it("should validate vault instruction inclusion", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
            ])
            .signers([testBase.mandatorySigner])
            .rpc();
          assert.fail("should revert with invalid transaction structure");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Invalid transaction structure"
          );
        }
      });

      it("should validate mandatory signer", async () => {
        // Generate a different mandatory signer than what's expected
        const wrongMandatorySigner = anchor.web3.Keypair.generate();

        // Airdrop SOL to the wrong mandatory signer for transaction fees
        testBase.provider.client.airdrop(
          wrongMandatorySigner.publicKey,
          BigInt(LAMPORTS_PER_SOL)
        );

        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: wrongMandatorySigner.publicKey, // Wrong mandatory signer
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
            .signers([wrongMandatorySigner]) // Sign with wrong mandatory signer
            .rpc();
          assert.fail("should revert with Invalid mandatory signer");
        } catch (error) {
          expect(error.error.errorMessage).to.equal("Invalid mandatory signer");
        }
      });

      it("should validate missing mandatory signer", async () => {
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: null, // Explicitly set to null
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
            .signers([testBase.txPayer]) // No mandatory signer in signers
            .rpc();
          assert.fail("should revert with Mandatory signer not found");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Mandatory signer not found"
          );
        }
      });

      it("should validate passkey pubkey during validation", async () => {
        let alice_serializedIntent = serializedIntent;
        const [alice_message, bob_signature, bob_authData] = bob.signIntent(
          Uint8Array.from(alice_serializedIntent)
        );
        testBase.client.expireBlockhash();
        try {
          let executeTx = await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
              null
            )
            .accountsPartial({
              solanaSigner: testBase.mandatorySigner.publicKey,
              smartAccount: alice.sa, //to sign over the same nonce
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
                alice_message,
                bob.getPasskeyPubkey(),
                bob_signature
              ),
              await testBase.vaultProgram.methods
                .executeBatch({
                  deconstructedInstructions,
                })
                .accounts({
                  vaultState: alice.vaultState, // to maintain same message
                  smartAccountVault: alice.vault, // to maintain same message
                })
                .remainingAccounts(remainingAccounts)
                .instruction(),
            ])
            .signers([testBase.mandatorySigner])
            // .transaction();
            .rpc();

          // executeTx.recentBlockhash =
          //   await testBase.provider.client.latestBlockhash();
          // executeTx.sign(testBase.txPayer, alice.mandatorySigner);

          // let res = await testBase.provider.client.sendTransaction(executeTx);
          // res = res as TransactionMetadata;
          // console.log("executeTx logs:", res.logs());
          assert.fail("should revert with Passkey not found");
        } catch (error) {
          // console.log("error", error);
          expect(error.error.errorMessage).to.equal("Passkey not found");
        }
      });

      it("should validate passkey validfrom during validation", async () => {
        const clock = testBase.client.getClock();
        //reduce time to before validFrom
        clock.unixTimestamp = BigInt(
          alice.validFrom.sub(new anchor.BN(1)).toString()
        );

        testBase.client.setClock(clock);
        testBase.client.expireBlockhash();
        try {
          const executeTx = await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
            // .transaction();
            .rpc();

          // executeTx.recentBlockhash =
          //   await testBase.provider.client.latestBlockhash();
          // executeTx.sign(testBase.txPayer, alice.mandatorySigner);

          // let res = await testBase.provider.client.sendTransaction(executeTx);
          // console.log("executeTx logs:", res.toString());
          assert.fail("should revert with invalid session");
        } catch (error) {
          expect(error.error.errorMessage).to.equal("Invalid signer session");
        }
      });
      it("should validate passkey validUntil during validation", async () => {
        const clock = testBase.client.getClock();
        //increase time to after validUntil
        clock.unixTimestamp = BigInt(
          alice.validUntil.add(new anchor.BN(1)).toString()
        );

        testBase.client.setClock(clock);
        testBase.client.expireBlockhash();
        try {
          const executeTx = await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
            // .transaction();
            .rpc();

          // executeTx.recentBlockhash =
          //   await testBase.provider.client.latestBlockhash();
          // executeTx.sign(testBase.txPayer, alice.mandatorySigner);

          // let res = await testBase.provider.client.sendTransaction(executeTx);
          // console.log("executeTx logs:", res.toString());
          assert.fail("should revert with invalid session");
        } catch (error) {
          expect(error.error.errorMessage).to.equal("Invalid signer session");
        }
      });
    });
    describe("execute batch", () => {
      it("should validate missing accounts", async () => {
        await testBase.client.expireBlockhash();
        let remainingAccountsMock = [...remainingAccounts]; //remove 1 account
        remainingAccountsMock.pop();
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
                .remainingAccounts(remainingAccountsMock)
                .instruction(),
            ])
            .signers([testBase.mandatorySigner])
            .rpc();
          assert.fail("should revert with Missing required accounts");
        } catch (error) {
          expect(error.error.errorMessage).to.equal(
            "Missing required accounts"
          );
        }
      });
      it("should validate excess accounts", async () => {
        await testBase.client.expireBlockhash();
        let remainingAccountsMock = [...remainingAccounts]; //add 1 mock account
        remainingAccountsMock.push({
          pubkey: alice.vault,
          isSigner: false,
          isWritable: false,
        });
        try {
          await testBase.saProgram.methods
            .validateExecution(
              {
                clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
                authData: WebAuthnAuthDataHelpers.Index(0),
              } as any,
              new anchor.BN(0),
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
                .remainingAccounts(remainingAccountsMock)
                .instruction(),
            ])
            .signers([testBase.mandatorySigner])
            .rpc();
          assert.fail("should revert with Excess accounts");
        } catch (error) {
          expect(error.error.errorMessage).to.equal("Excess accounts");
        }
      });
    });
  });
});
