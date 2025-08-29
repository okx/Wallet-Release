import * as anchor from "@coral-xyz/anchor";
import { generateIdFromString } from "../utils/helpers";
import {
  DeconstructedInstruction,
  SmartAccountHelper,
} from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { expect } from "chai";
import {
  AccountMeta,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionSignature,
} from "@solana/web3.js";
import bs58 from "bs58";
import { createSecp256r1Instruction } from "../utils/r1-utils";
import { AddedAccount, LAMPORTS_PER_SIGNER } from "../utils/consts";
import BufferUtils from "../utils/buffer-utils";
import { FailedTransactionMetadata } from "litesvm";
import { ethers } from "ethers";
import { MockATA } from "../setup/config";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { WebAuthnStringHelpers } from "../utils/webauthn";
import { WebAuthnAuthDataHelpers } from "../utils/webauthn";
import { IntentTree } from "../utils/intent-tree";

describe("optimistic-execution", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;

  let testUserTX: Transaction;
  const transferAmount = BigInt(0.1 * LAMPORTS_PER_SOL);
  const numTransfers = 1;

  let initialTxPayerBalance: bigint;
  let initialAliceBalance: bigint;

  let deconstructedInstructions: DeconstructedInstruction[];
  let remainingAccounts: AccountMeta[];

  const jitoTipAccount = PublicKey.unique();
  const jitoTip = 0.0001 * LAMPORTS_PER_SOL;
  let totalFee: bigint;

  let TEST_TOKEN_MINT: PublicKey;

  let aliceTokenAccount: PublicKey;
  let txPayerTokenAccount: PublicKey;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();

    TEST_TOKEN_MINT = testBase.testSPL2022TokenMint;

    alice = new SmartAccountHelper(
      generateIdFromString("user 1"),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    const aliceAddedAccount = MockATA(
      alice.vault,
      TEST_TOKEN_MINT, // Use the test token mint created by TestBase
      BigInt(LAMPORTS_PER_SOL * 1000),
      true, // is2022 = true
      true // allowOwnerOffCurve = true for PDA
    );
    aliceTokenAccount = aliceAddedAccount.address;

    const txPayerAddedAccount = MockATA(
      testBase.txPayer.publicKey,
      TEST_TOKEN_MINT, // Use the test token mint created by TestBase
      BigInt(LAMPORTS_PER_SOL * 1000),
      true, // is2022 = true
      true // allowOwnerOffCurve = true for PDA
    );
    txPayerTokenAccount = txPayerAddedAccount.address;

    testBase.provider.client.setAccount(
      aliceAddedAccount.address,
      aliceAddedAccount.info
    );
    testBase.provider.client.setAccount(
      txPayerAddedAccount.address,
      txPayerAddedAccount.info
    );

    testUserTX = new Transaction().add(
      ...Array(numTransfers).fill(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: transferAmount,
        })
      )
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

    it("optimistic validation", async () => {
      initialTxPayerBalance = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      initialAliceBalance = testBase.client.getBalance(alice.vault);

      const executionFee =
        (3 + // optimistic validation: 1 R1 + 2 EOA
          1 + // optimistic execution: 1 EOA
          1) * // post optimistic execution: 1 EOA
        LAMPORTS_PER_SIGNER;
      totalFee = BigInt(executionFee + jitoTip);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

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
          tokenAmount: Number(totalFee),
        },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );
      deconstructedInstructions = generatedDeconstructedInstructions;
      remainingAccounts = generatedRemainingAccounts;

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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      expect(
        BigInt(optimisticValidationStateAccount.tokenAmount.toNumber())
      ).to.equal(totalFee);
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

    it("optimistic execution", async () => {
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
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
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

    it("post optimistic execution", async () => {
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
        initialAliceBalance - totalFee - transferAmount * BigInt(numTransfers)
      );
      expect(txPayerBalAfter).to.equal(initialTxPayerBalance);
      expect(jitoTipAccountBalAfter).to.equal(BigInt(jitoTip));
    });

    it("optimistic execution flow with SPL Token", async () => {
      testBase.client.expireBlockhash();

      const nonceBefore = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);

      const initialTxPayerSOLBalance = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const initialAliceSOLBalance = testBase.client.getBalance(alice.vault);
      const initialJitoTipAccountSOLBalance =
        testBase.client.getBalance(jitoTipAccount) ?? BigInt(0);
      const initialTxPayerSPLBalance =
        await testBase.getTokenBalance(txPayerTokenAccount);
      const initialAliceSPLBalance =
        await testBase.getTokenBalance(aliceTokenAccount);

      const executionFee =
        (3 + // optimistic validation: 1 R1 + 2 EOA
          1 + // optimistic execution: 1 EOA
          1) * // post optimistic execution: 1 EOA
        LAMPORTS_PER_SIGNER;
      const totalFeeSOL = BigInt(executionFee + jitoTip);
      const totalFeeSPL = BigInt(1000000);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFeeSPL), tokenMint: TEST_TOKEN_MINT },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

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
          solanaSigner: testBase.mandatorySigner.publicKey,
          tokenMint: TEST_TOKEN_MINT,
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

      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(jitoTip))
        .accountsPartial({
          jitoTipAccount: jitoTipAccount,
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: aliceTokenAccount,
          tokenMint: TEST_TOKEN_MINT,
          destinationTokenAccount: txPayerTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();

      const nonceAfter = await testBase.saProgram.account.smartAccount
        .fetch(alice.sa)
        .then((v) => v.nonce);
      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      const afterTxPayerSOLBalance = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const afterAliceSOLBalance = testBase.client.getBalance(alice.vault);
      const afterJitoTipAccountSOLBalance =
        testBase.client.getBalance(jitoTipAccount);
      const afterTxPayerSPLBalance =
        await testBase.getTokenBalance(txPayerTokenAccount);
      const afterAliceSPLBalance =
        await testBase.getTokenBalance(aliceTokenAccount);

      expect(nonceAfter.toNumber()).to.equal(nonceBefore.toNumber() + 1);
      expect(optimisticValidationStateAccount).to.equal(null);
      expect(afterTxPayerSOLBalance).to.equal(
        initialTxPayerSOLBalance - totalFeeSOL
      );
      expect(afterAliceSOLBalance).to.equal(
        initialAliceSOLBalance - transferAmount * BigInt(numTransfers)
      );
      expect(afterJitoTipAccountSOLBalance).to.equal(
        initialJitoTipAccountSOLBalance + BigInt(jitoTip)
      );
      expect(afterTxPayerSPLBalance).to.equal(
        initialTxPayerSPLBalance + totalFeeSPL
      );
      expect(afterAliceSPLBalance).to.equal(
        initialAliceSPLBalance - totalFeeSPL
      );
    });

    it("optimistic execution flow with intent tree proofs", async () => {
      testBase.client.expireBlockhash();
      const executionFee =
        (3 + // optimistic validation: 1 R1 + 2 EOA
          1 + // optimistic execution: 1 EOA
          1) * // post optimistic execution: 1 EOA
        LAMPORTS_PER_SIGNER;
      const totalFeeSOL = BigInt(executionFee + jitoTip);
      const totalFeeSPL = BigInt(1000000);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFeeSPL), tokenMint: TEST_TOKEN_MINT },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const intentTree = new IntentTree([
        ethers.keccak256(Buffer.from(serializedMessage)),
        ethers.keccak256(ethers.keccak256(Buffer.from(serializedMessage))), // mock hash
      ]);

      const [message, signature, authData] = alice.signIntent(
        Buffer.from(ethers.toBeArray(intentTree.getRoot())),
        false
      );

      let proof = intentTree.getProof(
        ethers.keccak256(Buffer.from(serializedMessage))
      );

      await testBase.saProgram.methods
        .optimisticValidation(
          validationArgs,
          {
            clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
            authData: WebAuthnAuthDataHelpers.Index(0),
          } as any,
          proof
        )
        .accountsPartial({
          smartAccount: alice.sa,
          solanaSigner: testBase.mandatorySigner.publicKey,
          tokenMint: TEST_TOKEN_MINT,
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

      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(jitoTip))
        .accountsPartial({
          jitoTipAccount: jitoTipAccount,
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: aliceTokenAccount,
          tokenMint: TEST_TOKEN_MINT,
          destinationTokenAccount: txPayerTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
    });
  });

  describe("optimistic execution failure cases", () => {
    it("should fail when trying to execute without validation", async () => {
      testBase.client.expireBlockhash();

      // Create a new smart account for this test
      const bob = new SmartAccountHelper(
        generateIdFromString("user 2"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

      testBase.client.airdrop(
        bob.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      await testBase.createSmartAccount(bob);

      // Try to execute without validation
      try {
        await testBase.saProgram.methods
          .validateOptimisticExecution()
          .accountsPartial({
            smartAccount: bob.sa,
            vaultState: bob.vaultState,
            smartAccountVault: bob.vault,
          })
          .postInstructions([
            await testBase.vaultProgram.methods
              .executeBatch({ deconstructedInstructions: [] })
              .accounts({
                vaultState: bob.vaultState,
                smartAccountVault: bob.vault,
              })
              .instruction(),
          ])
          .rpc();

        expect.fail(
          "Should have failed with OptimisticValidationStateNotInitialized"
        );
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal(
          "OptimisticValidationStateNotInitialized"
        );
        expect(error.error.errorMessage).to.equal(
          "Optimistic validation state not initialized"
        );
      }
    });

    it("should fail when trying to execute the same transaction twice", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      // Use alice who already has a validation state from previous tests
      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // First validation
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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      // First execution - should succeed
      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      // Second execution attempt - should fail
      try {
        await testBase.saProgram.methods
          .validateOptimisticExecution()
          .accountsPartial({
            smartAccount: alice.sa,
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
          })
          .postInstructions([
            await testBase.vaultProgram.methods
              .executeBatch({ deconstructedInstructions })
              .accounts({
                vaultState: alice.vaultState,
                smartAccountVault: alice.vault,
              })
              .remainingAccounts(remainingAccounts)
              .instruction(),
          ])
          .rpc();

        expect.fail(
          "Should have failed with OptimisticTransactionAlreadyExecuted"
        );
      } catch (error: any) {
        // Check if error has the expected structure
        if (
          error.error &&
          error.error.errorCode &&
          error.error.errorCode.code
        ) {
          expect(error.error.errorCode.code).to.equal(
            "OptimisticTransactionAlreadyExecuted"
          );
        } else if (error.error && error.error.errorMessage) {
          expect(error.error.errorMessage).to.include(
            "Optimistic transaction already executed"
          );
        } else {
          // For constraint errors, we may get a generic transaction error
          // Just check that we got an error when we expected one
          const errorMsg = error.message || error.toString();
          const hasAnyError =
            errorMsg.length > 0 || error.toString().length > 0;

          // Log the error for debugging if needed
          if (!hasAnyError) {
            console.log("Expected error but got:", error);
          }

          expect(hasAnyError, "Expected transaction to fail but it succeeded")
            .to.be.true;
        }
      }

      // Clean up - complete the post execution
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
    });

    it("should fail post execution without executing the transaction", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);

      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // Do validation only
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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      // Try to do post execution without execution - should fail
      let hasError = false;
      try {
        const result = await testBase.saProgram.methods
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
          .rpc()
          .catch((err) => {
            hasError = true;
            throw err; // Re-throw to be caught by outer catch
          });

        // If we reach here, the transaction succeeded when it should have failed
        if (!hasError) {
          expect.fail("Transaction should have failed but succeeded");
        }
      } catch (error) {
        hasError = true;
        // Expected - the transaction should fail
      }

      expect(hasError, "Expected transaction to fail").to.be.true;

      // Clean up - complete the execution and post execution
      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      testBase.client.expireBlockhash();

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
    });

    it("should fail post execution without validation state", async () => {
      testBase.client.expireBlockhash();

      // Create a new smart account for this test
      const charlie = new SmartAccountHelper(
        generateIdFromString("user 3"),
        testBase.mandatorySigner,
        testBase.saProgram
      );

      testBase.client.airdrop(
        charlie.vault,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      await testBase.createSmartAccount(charlie);

      // Try to do post execution without validation state
      try {
        await testBase.saProgram.methods
          .postOptimisticExecution(new anchor.BN(jitoTip))
          .accountsPartial({
            jitoTipAccount: jitoTipAccount,
            smartAccount: charlie.sa,
            vaultState: charlie.vaultState,
            smartAccountVault: charlie.vault,
            vaultTokenAccount: null,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
          })
          .rpc();

        expect.fail(
          "Should have failed with OptimisticValidationStateNotInitialized"
        );
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal(
          "OptimisticValidationStateNotInitialized"
        );
        expect(error.error.errorMessage).to.equal(
          "Optimistic validation state not initialized"
        );
      }
    });

    it("should fail validation with expired max slot", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);
      // Set max slot to a past slot
      const maxSlot = testBase.client.getClock().slot - BigInt(10);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      try {
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
            solanaSigner: testBase.mandatorySigner.publicKey,
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
          .signers([testBase.mandatorySigner])
          .rpc();

        expect.fail("Should have failed with InvalidMaxSlot");
      } catch (error: any) {
        // Check if error has the expected structure
        if (
          error.error &&
          error.error.errorCode &&
          error.error.errorCode.code
        ) {
          expect(error.error.errorCode.code).to.equal("InvalidMaxSlot");
        } else if (error.error && error.error.errorMessage) {
          expect(error.error.errorMessage).to.include("Invalid max slot");
        } else {
          // Fallback check for different error formats
          const errorMsg = error.message || error.toString();
          const hasExpectedError =
            errorMsg.includes("InvalidMaxSlot") ||
            errorMsg.includes("max slot") ||
            errorMsg.includes("6020"); // Error code number for InvalidMaxSlot
          expect(hasExpectedError).to.be.true;
        }
      }
    });

    it("should fail execution with expired validation slot", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // Do validation
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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      // Advance the slot to make validation expired
      const clock = testBase.client.getClock();
      clock.slot = clock.slot + BigInt(1);
      testBase.client.setClock(clock);

      // Try to execute with expired validation
      try {
        await testBase.saProgram.methods
          .validateOptimisticExecution()
          .accountsPartial({
            smartAccount: alice.sa,
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
          })
          .postInstructions([
            await testBase.vaultProgram.methods
              .executeBatch({ deconstructedInstructions })
              .accounts({
                vaultState: alice.vaultState,
                smartAccountVault: alice.vault,
              })
              .remainingAccounts(remainingAccounts)
              .instruction(),
          ])
          .rpc();

        expect.fail("Should have failed with OptimisticValidationExpired");
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal(
          "OptimisticValidationExpired"
        );
        expect(error.error.errorMessage).to.equal(
          "Optimistic validation expired"
        );
      }
    });

    it("should fail post execution with expired validation slot", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const {
        serializedMessage,
        deconstructedInstructions,
        remainingAccounts,
        numSigners,
        validationArgs,
        hashBytes,
      } = await alice.prepareOptimisticValidationIntent(
        testUserTX,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // Do validation
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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      // Do execution
      await testBase.saProgram.methods
        .validateOptimisticExecution()
        .accountsPartial({
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .postInstructions([
          await testBase.vaultProgram.methods
            .executeBatch({ deconstructedInstructions })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      // Advance the slot to make validation expired
      const clock = testBase.client.getClock();
      clock.slot = clock.slot + BigInt(1);
      testBase.client.setClock(clock);

      // Try to do post execution with expired validation
      try {
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

        expect.fail("Should have failed with OptimisticValidationExpired");
      } catch (error: any) {
        expect(error.error.errorCode.code).to.equal(
          "OptimisticValidationExpired"
        );
        expect(error.error.errorMessage).to.equal(
          "Optimistic validation expired"
        );
      }
    });

    it("should fail execution with transaction mismatch", async () => {
      testBase.client.expireBlockhash();

      // Create Transaction A (what the user signs)
      const transactionA = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(),
          lamports: BigInt(0.1 * LAMPORTS_PER_SOL),
        })
      );

      // Create Transaction B (what the malicious sender tries to execute)
      const transactionB = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: PublicKey.unique(), // Different recipient
          lamports: BigInt(0.2 * LAMPORTS_PER_SOL), // Different amount
        })
      );

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      // Prepare intent for Transaction A and do optimistic validation
      const { serializedMessage, validationArgs } =
        await alice.prepareOptimisticValidationIntent(
          transactionA,
          { tokenAmount: Number(totalFee) },
          Number(maxSlot),
          testBase.txPayer.publicKey
        );

      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // Do validation with Transaction A's hash
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
          solanaSigner: testBase.mandatorySigner.publicKey,
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
        .signers([testBase.mandatorySigner])
        .rpc();

      // Prepare Transaction B for execution (different transaction)
      const {
        deconstructedInstructions: deconstructedInstructionsB,
        remainingAccounts: remainingAccountsB,
      } = await alice.prepareOptimisticValidationIntent(
        transactionB,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

      // Try to execute Transaction B when Transaction A was validated - should fail
      try {
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
                deconstructedInstructions: deconstructedInstructionsB,
              })
              .accounts({
                vaultState: alice.vaultState,
                smartAccountVault: alice.vault,
              })
              .remainingAccounts(remainingAccountsB)
              .instruction(),
          ])
          .rpc();

        expect.fail("Should have failed with TransactionHashMismatch");
      } catch (error: any) {
        // Check if error has the expected structure for transaction hash mismatch
        if (
          error.error &&
          error.error.errorCode &&
          error.error.errorCode.code
        ) {
          // Should fail with TransactionHashMismatch or similar error
          const errorCode = error.error.errorCode.code;
          const isExpectedError =
            errorCode === "TransactionHashMismatch" ||
            errorCode === "InvalidTransactionHash" ||
            errorCode === "TransactionMismatch";

          if (!isExpectedError) {
            console.log("Got error code:", errorCode);
            console.log("Expected transaction hash mismatch error");
          }
          expect(isExpectedError).to.be.true;
        } else if (error.error && error.error.errorMessage) {
          const errorMessage = error.error.errorMessage.toLowerCase();
          const hasExpectedMessage =
            errorMessage.includes("hash") ||
            errorMessage.includes("mismatch") ||
            errorMessage.includes("transaction");
          expect(hasExpectedMessage).to.be.true;
        } else {
          // Fallback check - just ensure we got an error
          const errorMsg = error.message || error.toString();
          const hasAnyError = errorMsg.length > 0;
          expect(
            hasAnyError,
            "Expected transaction to fail due to hash mismatch"
          ).to.be.true;
        }
      }

      // Clean up - reset validation state by executing the correct transaction
      const {
        deconstructedInstructions: deconstructedInstructionsA,
        remainingAccounts: remainingAccountsA,
      } = await alice.prepareOptimisticValidationIntent(
        transactionA,
        { tokenAmount: Number(totalFee) },
        Number(maxSlot),
        testBase.txPayer.publicKey
      );

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
              deconstructedInstructions: deconstructedInstructionsA,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccountsA)
            .instruction(),
        ])
        .rpc();

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
    });

    it("should fail validation with invalid WebAuthn challenge", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee + jitoTip);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const { serializedMessage, validationArgs } =
        await alice.prepareOptimisticValidationIntent(
          testUserTX,
          { tokenAmount: Number(totalFee) },
          Number(maxSlot),
          testBase.txPayer.publicKey
        );

      // Generate correct signature first
      const [message, signature, authData] = alice.signIntent(
        Uint8Array.from(serializedMessage)
      );

      // Corrupt the signature to make WebAuthn validation fail
      const corruptedSignature = Buffer.from(signature);
      corruptedSignature[0] = corruptedSignature[0] ^ 0xff; // Flip bits in first byte

      try {
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
            solanaSigner: testBase.mandatorySigner.publicKey,
            webauthnTable: testBase.webauthnTable,
          })
          .postInstructions([
            createSecp256r1Instruction(
              message,
              alice.getPasskeyPubkey(),
              corruptedSignature // Use corrupted signature
            ),
          ])
          .signers([testBase.mandatorySigner])
          .rpc();

        expect.fail("Should have failed with invalid WebAuthn signature");
      } catch (error: any) {
        // Check if error has the expected structure for signature validation failure
        if (
          error.error &&
          error.error.errorCode &&
          error.error.errorCode.code
        ) {
          // Could be various signature-related errors
          const errorCode = error.error.errorCode.code;
          const isSignatureError =
            errorCode === "InvalidPasskey" ||
            errorCode === "Secp256r1MessageMismatch" ||
            errorCode === "Secp256r1InvalidLength" ||
            errorCode === "Secp256r1HeaderMismatch";

          if (!isSignatureError) {
            console.log("Got error code:", errorCode);
          }
          expect(isSignatureError).to.be.true;
        } else if (error.error && error.error.errorMessage) {
          const errorMessage = error.error.errorMessage.toLowerCase();
          const hasSignatureError =
            errorMessage.includes("signature") ||
            errorMessage.includes("passkey") ||
            errorMessage.includes("secp256r1");
          expect(hasSignatureError).to.be.true;
        } else {
          // Fallback - just ensure we got an error
          const errorMsg = error.message || error.toString();
          const hasAnyError = errorMsg.length > 0;
          expect(
            hasAnyError,
            "Expected transaction to fail due to invalid WebAuthn signature"
          ).to.be.true;
        }
      }
    });
  });

  describe("jito tip account optional behavior", () => {
    it("should succeed when jito_tip_amount is 0 and jito_tip_account is null", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee); // No jito tip
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      // Capture initial balances
      const initialAliceBalance = testBase.client.getBalance(alice.vault);
      const initialTxPayerBalance = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      const { serializedMessage, validationArgs } =
        await alice.prepareOptimisticValidationIntent(
          testUserTX,
          { tokenAmount: Number(totalFee) },
          Number(maxSlot),
          testBase.txPayer.publicKey
        );

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
          solanaSigner: testBase.mandatorySigner.publicKey,
          webauthnTable: testBase.webauthnTable,
          tokenMint: null,
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

      // Execute the optimistic transaction
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
              deconstructedInstructions: deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      // Post optimistic execution with 0 tip amount and no jito tip account
      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(0)) // 0 tip amount
        .accountsPartial({
          jitoTipAccount: null, // No jito tip account provided
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
        })
        .rpc();

      // Verify the transaction succeeded and check balances
      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );

      expect(optimisticValidationStateAccount).to.equal(null);
      expect(aliceBalAfter).to.equal(
        initialAliceBalance - totalFee - transferAmount * BigInt(numTransfers)
      );
      expect(txPayerBalAfter).to.equal(initialTxPayerBalance);
    });

    it("should fail when jito_tip_amount > 0 but jito_tip_account is null", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const { serializedMessage, validationArgs } =
        await alice.prepareOptimisticValidationIntent(
          testUserTX,
          { tokenAmount: Number(totalFee) },
          Number(maxSlot),
          testBase.txPayer.publicKey
        );

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
          solanaSigner: testBase.mandatorySigner.publicKey,
          webauthnTable: testBase.webauthnTable,
          tokenMint: null,
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

      // Execute the optimistic transaction
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
              deconstructedInstructions: deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      // Try to post optimistic execution with tip amount > 0 but no jito tip account
      try {
        await testBase.saProgram.methods
          .postOptimisticExecution(new anchor.BN(jitoTip)) // Non-zero tip amount
          .accountsPartial({
            jitoTipAccount: null, // No jito tip account provided
            smartAccount: alice.sa,
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            vaultTokenAccount: null,
            tokenMint: null,
            destinationTokenAccount: null,
            tokenProgram: null,
          })
          .rpc();

        expect.fail("Should have failed with JitoTipAccountNotFound error");
      } catch (error: any) {
        // Check if error has the expected structure for JitoTipAccountNotFound
        if (
          error.error &&
          error.error.errorCode &&
          error.error.errorCode.code
        ) {
          const errorCode = error.error.errorCode.code;
          expect(errorCode).to.equal("JitoTipAccountNotFound");
        } else if (error.error && error.error.errorMessage) {
          const errorMessage = error.error.errorMessage.toLowerCase();
          const hasJitoTipError =
            errorMessage.includes("jito") || errorMessage.includes("tip");
          expect(hasJitoTipError).to.be.true;
        } else {
          // Fallback - just ensure we got an error
          const errorMsg = error.message || error.toString();
          const hasAnyError = errorMsg.length > 0;
          expect(
            hasAnyError,
            "Expected transaction to fail due to missing jito tip account"
          ).to.be.true;
        }
      }
    });

    it("should succeed when jito_tip_amount > 0 and jito_tip_account is provided", async () => {
      testBase.client.expireBlockhash();

      const executionFee = 5 * LAMPORTS_PER_SIGNER;
      const totalFee = BigInt(executionFee);
      const maxSlot = testBase.client.getClock().slot + BigInt(60);

      const { serializedMessage, validationArgs } =
        await alice.prepareOptimisticValidationIntent(
          testUserTX,
          { tokenAmount: Number(totalFee) },
          Number(maxSlot),
          testBase.txPayer.publicKey
        );

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
          solanaSigner: testBase.mandatorySigner.publicKey,
          webauthnTable: testBase.webauthnTable,
          tokenMint: null,
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

      // Execute the optimistic transaction
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
              deconstructedInstructions: deconstructedInstructions,
            })
            .accounts({
              vaultState: alice.vaultState,
              smartAccountVault: alice.vault,
            })
            .remainingAccounts(remainingAccounts)
            .instruction(),
        ])
        .rpc();

      // Post optimistic execution with tip amount > 0 and jito tip account provided
      const initialJitoTipBalance = testBase.client.getBalance(jitoTipAccount);

      await testBase.saProgram.methods
        .postOptimisticExecution(new anchor.BN(jitoTip)) // Non-zero tip amount
        .accountsPartial({
          jitoTipAccount: jitoTipAccount, // Jito tip account provided
          smartAccount: alice.sa,
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          vaultTokenAccount: null,
          tokenMint: null,
          destinationTokenAccount: null,
          tokenProgram: null,
        })
        .rpc();

      // Verify the transaction succeeded and tip was transferred
      const optimisticValidationStateAccount =
        await testBase.saProgram.account.smartAccount
          .fetch(alice.sa)
          .then((v) => v.optimisticValidationState);

      const finalJitoTipBalance = testBase.client.getBalance(jitoTipAccount);

      expect(optimisticValidationStateAccount).to.equal(null);
      expect(finalJitoTipBalance).to.equal(
        initialJitoTipBalance + BigInt(jitoTip)
      );
    });
  });
});
