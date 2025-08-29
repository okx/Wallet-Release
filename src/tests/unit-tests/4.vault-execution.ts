import { generateIdFromString } from "../utils/helpers";
import {
  DeconstructedInstruction,
  SmartAccountHelper,
} from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
  Transaction,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { MockATA } from "../setup/config";
import * as anchor from "@coral-xyz/anchor";
import { FailedTransactionMetadata, TransactionMetadata } from "litesvm";

// Test token mint for TOKEN_2022 testing
let TEST_TOKEN_MINT: PublicKey;
// Test token mint for regular SPL Token testing
let TEST_SPL_TOKEN_MINT: PublicKey;

describe("vault-execution", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;
  let bob: SmartAccountHelper;
  let aliceTokenAccount: any;
  let bobTokenAccount: any;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();

    TEST_TOKEN_MINT = testBase.testSPL2022TokenMint;

    TEST_SPL_TOKEN_MINT = testBase.testSPLTokenMint;

    alice = new SmartAccountHelper(
      generateIdFromString("vault_email_1"),
      Keypair.generate(),
      testBase.saProgram
    );
    bob = new SmartAccountHelper(
      generateIdFromString("vault_email_2"),
      Keypair.generate(),
      testBase.saProgram
    );

    // Use mock Token 2022 accounts for vault testing (since regular SPL Token has issues in LiteSVM)
    aliceTokenAccount = MockATA(
      alice.vault,
      TEST_TOKEN_MINT, // Use the test token mint created by TestBase
      BigInt(LAMPORTS_PER_SOL * 1000),
      true, // is2022 = true
      true // allowOwnerOffCurve = true for PDA
    );
    bobTokenAccount = MockATA(
      bob.vault,
      TEST_TOKEN_MINT, // Use the test token mint created by TestBase
      BigInt(LAMPORTS_PER_SOL * 1000),
      true, // is2022 = true
      true // allowOwnerOffCurve = true for PDA
    );

    // Create regular SPL Token accounts for testing
    const aliceSPLTokenAccount = MockATA(
      alice.vault,
      TEST_SPL_TOKEN_MINT,
      BigInt(LAMPORTS_PER_SOL * 1000),
      false, // is2022 = false for regular SPL Token
      true // allowOwnerOffCurve = true for PDA
    );
    const bobSPLTokenAccount = MockATA(
      bob.vault,
      TEST_SPL_TOKEN_MINT,
      BigInt(LAMPORTS_PER_SOL * 1000),
      false, // is2022 = false for regular SPL Token
      true // allowOwnerOffCurve = true for PDA
    );

    //set accounts with initial balances
    testBase.provider.client.setAccount(
      aliceTokenAccount.address,
      aliceTokenAccount.info
    );
    testBase.provider.client.setAccount(
      bobTokenAccount.address,
      bobTokenAccount.info
    );
    testBase.provider.client.setAccount(
      aliceSPLTokenAccount.address,
      aliceSPLTokenAccount.info
    );
    testBase.provider.client.setAccount(
      bobSPLTokenAccount.address,
      bobSPLTokenAccount.info
    );
    testBase.provider.client.airdrop(
      alice.vault,
      BigInt(LAMPORTS_PER_SOL * 1000)
    );
    testBase.provider.client.airdrop(
      bob.vault,
      BigInt(LAMPORTS_PER_SOL * 1000)
    );
  });

  describe("vault setup", () => {
    it("should create smart accounts for vault testing", async () => {
      await testBase.createSmartAccount(alice);
      await testBase.createSmartAccount(bob);

      // Verify both accounts exist
      const aliceAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const bobAccount = await testBase.saProgram.account.smartAccount.fetch(
        bob.sa
      );

      expect(aliceAccount.id).to.deep.equal(alice.getId());
      expect(bobAccount.id).to.deep.equal(bob.getId());
    });

    it("should verify vault states are created", async () => {
      // Check Alice's vault state
      const aliceVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);
      expect(aliceVaultState.smartAccount.toBase58()).to.equal(
        alice.sa.toBase58()
      );
      expect(aliceVaultState.isValidated).to.equal(false);

      // Check Bob's vault state
      const bobVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(bob.vaultState);
      expect(bobVaultState.smartAccount.toBase58()).to.equal(bob.sa.toBase58());
      expect(bobVaultState.isValidated).to.equal(false);
    });
  });

  describe("single instruction execution", () => {
    it("should execute a single SOL transfer through vault", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.1 * LAMPORTS_PER_SOL;

      // Get initial balances
      const initialRecipientBalance =
        testBase.provider.client.getBalance(recipient);
      const initialVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: recipient,
        lamports: transferAmount,
      });

      // Execute through vault
      const result = await alice.executeBatch([transferInstruction], {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      // Submit the transaction
      const signature = await testBase.provider.sendAndConfirm(
        result.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify balances changed
      const finalRecipientBalance =
        testBase.provider.client.getBalance(recipient);
      const finalVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      expect(Number(finalRecipientBalance)).to.equal(
        Number(initialRecipientBalance) + transferAmount
      );
      expect(Number(finalVaultBalance)).to.be.lessThan(
        Number(initialVaultBalance)
      ); // Should be less due to transfer + fees
    });

    it("should fail recursive execution of a single SOL transfer through vault", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.1 * LAMPORTS_PER_SOL;

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: recipient,
        lamports: transferAmount,
      });

      //create recursive execute batch instruction
      const executeBatchIx = await testBase.vaultProgram.methods
        .executeBatch({
          deconstructedInstructions: [
            { ixData: Buffer.from(transferInstruction.data), accountCount: 3 },
          ],
        })
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .remainingAccounts([
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: alice.vault,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: recipient,
            isSigner: false,
            isWritable: true,
          },
        ])
        .instruction();

      // Execute through vault
      const result = await alice.executeBatch([executeBatchIx], {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      try {
        // Submit the transaction
        let txres = await testBase.provider.sendAndConfirm(
          result.versionedTransaction
        );
        assert.fail("should have failed with unauthorized execution error");
      } catch (error) {
        // Use the error parsing utility
        const parsed = testBase.parseError(error);
        expect(parsed.anchor.isAnchorError).to.be.true;
        expect(parsed.anchor.errorName).to.equal("UnauthorizedExecution");
      }
      testBase.provider.client.withSigverify(true);
    });
  });

  describe("batch execution", () => {
    it("should execute multiple SOL transfers in a single batch", async () => {
      const recipients = [
        PublicKey.unique(),
        PublicKey.unique(),
        PublicKey.unique(),
      ];
      const transferAmount = 0.05 * LAMPORTS_PER_SOL;

      // Get initial balances
      const initialBalances = recipients.map((recipient) =>
        testBase.provider.client.getBalance(recipient)
      );
      const initialVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      // Create multiple transfer instructions
      const transferInstructions = recipients.map((recipient) =>
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );

      // Execute batch through vault
      const result = await alice.executeBatch(transferInstructions, {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      // Submit the transaction
      const signature = await testBase.provider.sendAndConfirm(
        result.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify all balances changed correctly
      const finalBalances = recipients.map((recipient) =>
        testBase.provider.client.getBalance(recipient)
      );
      const finalVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      for (let i = 0; i < recipients.length; i++) {
        expect(Number(finalBalances[i])).to.equal(
          Number(initialBalances[i]) + transferAmount
        );
      }
      expect(Number(finalVaultBalance)).to.be.lessThan(
        Number(initialVaultBalance)
      );
    });

    it("should handle token transfers with ATA creation", async () => {
      const recipients = [Keypair.generate(), Keypair.generate()];
      const transferAmount = 1_000_000; // 1 token (6 decimals)

      // Get vault's token account address using TestBase utility
      const vaultTokenAccount = testBase.getTokenAccountAddress(
        alice.vault,
        true // allowOwnerOffCurve for PDA
      );

      // Check initial vault balance
      const initialVaultBalance =
        await testBase.getTokenBalance(vaultTokenAccount);

      // Create token transfer instructions using TestBase utility
      const { instructions, recipientTokenAccounts } =
        testBase.createAccountAndTransferInstructions(
          alice.vault, // payer (vault will pay)
          vaultTokenAccount, // source
          alice.vault, // authority
          recipients.map((r) => r.publicKey), // recipients
          transferAmount
        );

      // Execute batch through vault
      const result = await alice.executeBatch(instructions, {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      try {
        await testBase.provider.sendAndConfirm(result.versionedTransaction);
      } catch (error) {
        console.log("❌ Token transfer failed:", error.message);
        throw error;
      }
      testBase.provider.client.withSigverify(true);

      // Check final vault balance and verify decrease
      const finalVaultBalance =
        await testBase.getTokenBalance(vaultTokenAccount);
      const expectedDecrease = BigInt(transferAmount * recipients.length);

      const actualDecrease = initialVaultBalance - finalVaultBalance;
      if (actualDecrease !== expectedDecrease) {
        console.log(
          `❌ Vault balance decrease mismatch: expected ${expectedDecrease}, got ${actualDecrease}`
        );
      }

      // Verify recipient accounts were created
      for (let i = 0; i < recipients.length; i++) {
        const accountInfo = await testBase.provider.connection.getAccountInfo(
          recipientTokenAccounts[i]
        );
        expect(accountInfo).to.not.be.null;
      }

      // Verify all recipient balances
      const expectedAmounts = recipients.map(() => transferAmount);
      const recipientLabels = recipients.map((_, i) => `Recipient ${i + 1}`);

      const balancesCorrect = await testBase.verifyTokenBalances(
        recipientTokenAccounts,
        expectedAmounts,
        recipientLabels
      );

      expect(balancesCorrect).to.be.true;
    });

    xit("should handle large batch with address lookup table compression", async () => {
      const recipients = Array.from({ length: 10 }, () => PublicKey.unique());
      const transferAmount = 0.01 * LAMPORTS_PER_SOL;

      // Create many transfer instructions
      const transferInstructions = recipients.map((recipient) =>
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );

      // Execute batch (should use ALT compression)
      const result = await alice.executeBatch(transferInstructions, {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: true,
      });

      expect(result.versionedTransaction).to.not.be.null;
      expect(result.transactionSize).to.be.greaterThan(0);

      testBase.provider.client.withSigverify(false);
      // Submit the transaction
      const signature = await testBase.provider.sendAndConfirm(
        result.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify at least some transfers succeeded
      const finalBalances = recipients
        .slice(0, 3)
        .map((recipient) => testBase.provider.client.getBalance(recipient));

      for (const balance of finalBalances) {
        expect(Number(balance)).to.equal(transferAmount);
      }
    });
  });

  describe("batch execution validation", () => {
    it("should validate vault state before execution", async () => {
      // Try to execute with an empty instruction array
      try {
        await alice.executeBatch([], {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
        });
        expect.fail("Should have thrown an error for empty instructions");
      } catch (error) {
        // This should fail during instruction creation or execution
        expect(error).to.exist;
      }
    });

    it("should handle executing transfers between 2 smart accounts", async () => {
      const recipient = alice.vault;
      const transferAmount = 2_000_000; // 2 tokens (6 decimals)

      // Get token account addresses using TestBase utility
      const bobTokenAccount = testBase.getTokenAccountAddress(
        bob.vault,
        true // allowOwnerOffCurve for PDA
      );
      const recipientTokenAccount = testBase.getTokenAccountAddress(
        alice.vault,
        true
      );

      // Check initial balances
      const initialBobBalance = await testBase.getTokenBalance(bobTokenAccount);
      const initialAliceBalance = await testBase.getTokenBalance(
        recipientTokenAccount
      );

      const instructions = [
        // Transfer tokens using TOKEN_2022_PROGRAM_ID
        createTransferInstruction(
          bobTokenAccount, // source
          recipientTokenAccount, // destination
          bob.vault, // authority
          transferAmount,
          [],
          TOKEN_2022_PROGRAM_ID
        ),
      ];

      // Execute through Bob's vault
      const result = await bob.executeBatch(instructions, {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      // Submit the transaction
      const signature = await testBase.provider.sendAndConfirm(
        result.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify balances using TestBase utility
      const tokenAccounts = [bobTokenAccount, recipientTokenAccount];
      const expectedAmounts = [
        initialBobBalance !== null
          ? initialBobBalance - BigInt(transferAmount)
          : BigInt(0),
        initialAliceBalance !== null
          ? initialAliceBalance + BigInt(transferAmount)
          : BigInt(transferAmount),
      ];
      const accountLabels = ["Bob's Account", "Alice's Account"];

      const balancesCorrect = await testBase.verifyTokenBalances(
        tokenAccounts,
        expectedAmounts,
        accountLabels
      );

      expect(balancesCorrect).to.be.true;

      // Verify recipient account was created
      const accountInfo = await testBase.provider.connection.getAccountInfo(
        recipientTokenAccount
      );
      expect(accountInfo).to.not.be.null;
    });
    it("should revert execution when accounts are insufficient", async () => {
      let serializedIntent: number[];
      let deconstructedInstructions: DeconstructedInstruction[];
      let remainingAccounts: anchor.web3.AccountMeta[];
      let numSigners: number;
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

      remainingAccounts.pop(); //remove 1 account

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.vaultProgram.methods
          .executeBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
          })
          .remainingAccounts(remainingAccounts)
          .preInstructions([
            await testBase.vaultProgram.methods
              .approveExecution()
              .accountsPartial({
                vaultState: alice.vaultState,
                smartAccount: alice.sa,
              })
              .instruction(),
          ])
          .rpc();
        assert.fail("should have failed with missing required accounts");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal("Missing required accounts");
      }
    });

    it("should revert execution when first account in instruction is not a program", async () => {
      let serializedIntent: number[];
      let deconstructedInstructions: DeconstructedInstruction[];
      let remainingAccounts: anchor.web3.AccountMeta[];
      let numSigners: number;
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

      // Change the first account (system program) to alice's vault
      remainingAccounts[0] = {
        pubkey: alice.vault,
        isSigner: false,
        isWritable: false,
      };

      testBase.provider.client.expireBlockhash();
      try {
        testBase.provider.client.withSigverify(false);
        await testBase.vaultProgram.methods
          .executeBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
          })
          .remainingAccounts(remainingAccounts)
          .preInstructions([
            await testBase.vaultProgram.methods
              .approveExecution()
              .accountsPartial({
                vaultState: alice.vaultState,
                smartAccount: alice.sa,
              })
              .instruction(),
          ])
          .rpc();
        assert.fail("should have failed with Invalid program account");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal("Invalid program account");
      }
    });
  });

  describe("vault state management", () => {
    it("should maintain vault state consistency across executions", async () => {
      // Check vault state before execution
      const initialVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);
      expect(initialVaultState.isValidated).to.equal(false);

      // Execute a simple transfer
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: PublicKey.unique(),
        lamports: 0.01 * LAMPORTS_PER_SOL,
      });

      const result = await alice.executeBatch([transferInstruction], {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
      });

      testBase.provider.client.withSigverify(false);
      const signature = await testBase.provider.sendAndConfirm(
        result.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Check vault state after execution
      const finalVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);
      expect(finalVaultState.smartAccount.toBase58()).to.equal(
        alice.sa.toBase58()
      );
      expect(finalVaultState.id).to.deep.equal(alice.getId());
    });
  });

  describe("approve_execution instruction", () => {
    it("should reject approve_execution when smart account is not the signer", async () => {
      const unauthorizedSigner = Keypair.generate();

      // Airdrop some SOL to the unauthorized signer for transaction fees
      testBase.provider.client.airdrop(
        unauthorizedSigner.publicKey,
        BigInt(LAMPORTS_PER_SOL)
      );

      try {
        await testBase.vaultProgram.methods
          .approveExecution()
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccount: alice.sa, // Wrong signer
          })
          .rpc();

        expect.fail("Should have failed with signature verification error");
      } catch (error) {
        // Use the new error parsing utility
        const parsed = testBase.parseError(error);
        // Should be a signature error since we're not providing the required signer
        expect(parsed.signature.isSignatureError).to.be.true;
        expect(parsed.signature.missingSignatures.length).to.be.greaterThan(0);
      }
    });

    it("should successfully approve_execution when smart account is the correct signer", async () => {
      // Check initial state
      const initialVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);
      expect(initialVaultState.isValidated).to.equal(false);

      testBase.provider.client.withSigverify(false);
      // Execute approve_execution with correct smart account
      await testBase.vaultProgram.methods
        .approveExecution()
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccount: alice.sa,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify state changed
      const finalVaultState =
        await testBase.vaultProgram.account.vaultState.fetch(alice.vaultState);
      expect(finalVaultState.isValidated).to.equal(true);
    });
  });

  describe("vault_transfer_sol instruction", () => {
    it("should reject vault_transfer_sol when smart account is not the signer", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.01 * LAMPORTS_PER_SOL;
      const unauthorizedSigner = Keypair.generate();

      // Airdrop some SOL to the unauthorized signer for transaction fees
      testBase.provider.client.airdrop(
        unauthorizedSigner.publicKey,
        BigInt(LAMPORTS_PER_SOL)
      );

      try {
        await testBase.vaultProgram.methods
          .vaultTransferSol(new anchor.BN(transferAmount))
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            smartAccount: alice.sa, // Wrong signer
            systemProgram: anchor.web3.SystemProgram.programId,
            recipient: recipient,
          })
          .rpc();

        expect.fail("Should have failed with signature verification error");
      } catch (error) {
        // Use the new error parsing utility
        const parsed = testBase.parseError(error);

        // Should be a signature error since we're not providing the required signer
        expect(parsed.signature.isSignatureError).to.be.true;
        expect(parsed.signature.missingSignatures.length).to.be.greaterThan(0);
      }
    });

    it("should successfully execute vault_transfer_sol when smart account is the correct signer", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.05 * LAMPORTS_PER_SOL;

      // Get initial balances
      const initialRecipientBalance =
        testBase.provider.client.getBalance(recipient);
      const initialVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      testBase.provider.client.withSigverify(false);
      // Execute vault_transfer_sol with correct smart account
      await testBase.vaultProgram.methods
        .vaultTransferSol(new anchor.BN(transferAmount))
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          smartAccount: alice.sa,
          systemProgram: anchor.web3.SystemProgram.programId,
          recipient: recipient,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify balances changed correctly
      const finalRecipientBalance =
        testBase.provider.client.getBalance(recipient);
      const finalVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      expect(Number(finalRecipientBalance)).to.equal(
        Number(initialRecipientBalance) + transferAmount
      );
      expect(Number(finalVaultBalance)).to.equal(
        Number(initialVaultBalance) - transferAmount
      );
    });

    it("should handle multiple vault_transfer_sol operations with balance validation", async () => {
      const recipients = [
        PublicKey.unique(),
        PublicKey.unique(),
        PublicKey.unique(),
      ];
      const transferAmount = 0.02 * LAMPORTS_PER_SOL;

      // Get initial vault balance
      const initialVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );
      const initialRecipientBalances = recipients.map((r) =>
        testBase.provider.client.getBalance(r)
      );

      testBase.provider.client.withSigverify(false);
      // Execute multiple transfers
      for (let i = 0; i < recipients.length; i++) {
        await testBase.vaultProgram.methods
          .vaultTransferSol(new anchor.BN(transferAmount))
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            smartAccount: alice.sa,
            systemProgram: anchor.web3.SystemProgram.programId,
            recipient: recipients[i],
          })
          .rpc();
      }
      testBase.provider.client.withSigverify(true);

      // Verify all balances
      const finalVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );
      const finalRecipientBalances = recipients.map((r) =>
        testBase.provider.client.getBalance(r)
      );

      // Check vault balance decreased by total transfer amount
      const totalTransferred = transferAmount * recipients.length;
      expect(Number(finalVaultBalance)).to.equal(
        Number(initialVaultBalance) - totalTransferred
      );

      // Check each recipient received the correct amount
      for (let i = 0; i < recipients.length; i++) {
        expect(Number(finalRecipientBalances[i])).to.equal(
          Number(initialRecipientBalances[i]) + transferAmount
        );
      }
    });

    it("should fail vault_transfer_sol with insufficient balance", async () => {
      const recipient = PublicKey.unique();
      const vaultBalance = testBase.provider.client.getBalance(alice.vault);
      const excessiveAmount = Number(vaultBalance) + LAMPORTS_PER_SOL; // More than available

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.vaultProgram.methods
          .vaultTransferSol(new anchor.BN(excessiveAmount))
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            smartAccount: alice.sa,
            systemProgram: anchor.web3.SystemProgram.programId,
            recipient: recipient,
          })
          .rpc();

        expect.fail("Should have failed with insufficient funds");
      } catch (error) {
        testBase.provider.client.withSigverify(true);

        // Use the improved error parsing utility
        const parsed = testBase.parseError(error);

        // Should be detected as insufficient funds error (native Solana error)
        expect(parsed.solana.isInsufficientFunds).to.be.true;
      }
    });
  });

  describe("vault_transfer_token instruction", () => {
    it("should reject vault_transfer_token when smart account is not the signer", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = new anchor.BN(1000);

      // Create a mock token mint and accounts
      const mockMint = PublicKey.unique();
      const mockVaultTokenAccount = PublicKey.unique();
      const mockDestinationTokenAccount = PublicKey.unique();
      const unauthorizedSigner = Keypair.generate();

      // Airdrop some SOL to the unauthorized signer for transaction fees
      testBase.provider.client.airdrop(
        unauthorizedSigner.publicKey,
        BigInt(LAMPORTS_PER_SOL)
      );

      try {
        await testBase.vaultProgram.methods
          .vaultTransferToken(transferAmount)
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            smartAccount: alice.sa, // Wrong signer
            vaultTokenAccount: mockVaultTokenAccount,
            tokenMint: mockMint,
            destinationTokenAccount: mockDestinationTokenAccount,
            tokenProgram: TOKEN_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have failed with signature verification error");
      } catch (error) {
        // Use the new error parsing utility
        const parsed = testBase.parseError(error);

        // Should be a signature error since we're not providing the required signer
        expect(parsed.signature.isSignatureError).to.be.true;
        expect(parsed.signature.missingSignatures.length).to.be.greaterThan(0);
      }
    });

    it("should successfully execute vault_transfer_token with SPL Token", async () => {
      const transferAmount = new anchor.BN(1000);

      // Use actual token accounts from the test setup for regular SPL Token
      const vaultTokenAccount = testBase.getTokenAccountAddress(
        alice.vault,
        true,
        false
      );
      const destinationTokenAccount = testBase.getTokenAccountAddress(
        bob.vault,
        true,
        false
      );

      // Get initial balances
      const initialVaultBalance = await testBase.getTokenBalance(
        vaultTokenAccount,
        false
      );
      const initialDestinationBalance = await testBase.getTokenBalance(
        destinationTokenAccount,
        false
      );

      testBase.provider.client.withSigverify(false);
      // Execute vault_transfer_token with correct smart account
      await testBase.vaultProgram.methods
        .vaultTransferToken(transferAmount)
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          smartAccount: alice.sa,
          vaultTokenAccount: vaultTokenAccount,
          tokenMint: TEST_SPL_TOKEN_MINT,
          destinationTokenAccount: destinationTokenAccount,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify balances changed correctly
      const finalVaultBalance = await testBase.getTokenBalance(
        vaultTokenAccount,
        false
      );
      const finalDestinationBalance = await testBase.getTokenBalance(
        destinationTokenAccount,
        false
      );

      expect(Number(finalVaultBalance)).to.equal(
        Number(initialVaultBalance) - transferAmount.toNumber()
      );
      expect(Number(finalDestinationBalance)).to.equal(
        Number(initialDestinationBalance) + transferAmount.toNumber()
      );
    });

    it("should successfully execute vault_transfer_token with Token-2022", async () => {
      const transferAmount = new anchor.BN(500);

      // Use actual token accounts from the test setup
      const vaultTokenAccount = testBase.getTokenAccountAddress(
        alice.vault,
        true, // allowOwnerOffCurve for PDA
        true // isToken2022 = true for Token-2022
      );
      const destinationTokenAccount = testBase.getTokenAccountAddress(
        bob.vault,
        true,
        true // isToken2022 = true for Token-2022
      );

      // Get initial balances
      const initialVaultBalance = await testBase.getTokenBalance(
        vaultTokenAccount,
        true
      );
      const initialDestinationBalance = await testBase.getTokenBalance(
        destinationTokenAccount,
        true
      );

      testBase.provider.client.withSigverify(false);
      // Execute vault_transfer_token with Token-2022 program
      await testBase.vaultProgram.methods
        .vaultTransferToken(transferAmount)
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
          smartAccount: alice.sa,
          vaultTokenAccount: vaultTokenAccount,
          tokenMint: TEST_TOKEN_MINT,
          destinationTokenAccount: destinationTokenAccount,
          tokenProgram: TOKEN_2022_PROGRAM_ID,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify balances changed correctly
      const finalVaultBalance =
        await testBase.getTokenBalance(vaultTokenAccount);
      const finalDestinationBalance = await testBase.getTokenBalance(
        destinationTokenAccount
      );

      expect(Number(finalVaultBalance)).to.equal(
        Number(initialVaultBalance) - transferAmount.toNumber()
      );
      expect(Number(finalDestinationBalance)).to.equal(
        Number(initialDestinationBalance) + transferAmount.toNumber()
      );
    });

    it("should fail vault_transfer_token with invalid token accounts", async () => {
      const transferAmount = new anchor.BN(1000);

      const destinationTokenAccount = testBase.getTokenAccountAddress(
        bob.vault,
        true,
        false
      );

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.vaultProgram.methods
          .vaultTransferToken(transferAmount)
          .accountsPartial({
            vaultState: alice.vaultState,
            smartAccountVault: alice.vault,
            smartAccount: alice.sa,
            vaultTokenAccount: destinationTokenAccount,
            tokenMint: TEST_TOKEN_MINT,
            destinationTokenAccount: destinationTokenAccount,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
          })
          .rpc();

        expect.fail("Should have failed with invalid token accounts");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal(
          "A token owner constraint was violated"
        );
      }
    });
  });

  describe("vault config management", () => {
    describe("config state validation", () => {
      it("should maintain consistent admin across config operations", async () => {
        // Verify admin remains consistent
        const config = await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );
        expect(config.admin.toBase58()).to.equal(
          testBase.admin.publicKey.toBase58()
        );
      });

      it("should maintain proper bump and account derivation", async () => {
        // Verify config account derivation is correct
        const config = await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );

        const [expectedConfigPubkey, expectedBump] =
          PublicKey.findProgramAddressSync(
            [Buffer.from("vault_config")],
            testBase.vaultProgram.programId
          );

        expect(testBase.vaultConfig.toBase58()).to.equal(
          expectedConfigPubkey.toBase58()
        );
        expect(config.bump).to.equal(expectedBump);
      });

      it("should verify all authorized programs are present", async () => {
        // Final verification that both test programs are in the config
        const config = await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );

        const programStrings = config.authorizedPrograms.map((p) =>
          p.toBase58()
        );

        // Should contain the original smart account program
        expect(programStrings).to.include(
          testBase.saProgram.programId.toBase58()
        );

        // Total should be 1, only contains the smart account program
        expect(config.authorizedPrograms.length).to.equal(1);
      });
    });
  });

  describe("recursive execution", () => {
    it("should fail recursive execute_batch calls with invalid stack height", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.1 * LAMPORTS_PER_SOL;

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: recipient,
        lamports: transferAmount,
      });

      //this should not work normally, just for testing purposes and overriding access to the vault
      const recursiveExecuteBatchIx = await testBase.vaultProgram.methods
        .executeBatch({
          deconstructedInstructions: [
            { ixData: Buffer.from(transferInstruction.data), accountCount: 3 },
          ],
        })
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccountVault: alice.vault,
        })
        .remainingAccounts([
          {
            pubkey: SystemProgram.programId,
            isSigner: false,
            isWritable: false,
          },
          {
            pubkey: alice.vault,
            isSigner: false,
            isWritable: true,
          },
          {
            pubkey: recipient,
            isSigner: false,
            isWritable: true,
          },
        ])
        .instruction();

      let mockApproval = await testBase.vaultProgram.methods
        .approveExecution()
        .accountsPartial({
          vaultState: alice.vaultState,
          smartAccount: alice.sa,
        })
        .instruction();
      // Execute through vault with recursive call (this should not work in normal conditions, just testing stack height checks)
      const result = await alice.executeBatch(
        [mockApproval, recursiveExecuteBatchIx],
        {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
        }
      );

      testBase.provider.client.withSigverify(false);
      try {
        // Submit the transaction
        await testBase.provider.sendAndConfirm(result.versionedTransaction);
        expect.fail("Should have failed with invalid stack height error");
      } catch (error) {
        // Use the error parsing utility
        const parsed = testBase.parseError(error);

        // Should be detected as an Anchor error with invalid stack height
        expect(parsed.anchor.isAnchorError).to.be.true;
        expect(parsed.anchor.errorName).to.equal("InvalidStackHeight");
      }
      testBase.provider.client.withSigverify(true);
    });
  });
});
