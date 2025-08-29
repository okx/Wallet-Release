import { generateIdFromString } from "../utils/helpers";
import { SmartAccountHelper } from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { expect } from "chai";
import {
  PublicKey,
  Keypair,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  createTransferInstruction,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { MockATA } from "../setup/config";
import * as anchor from "@coral-xyz/anchor";
import { TransactionMetadata } from "litesvm";

// Test token mint for TOKEN_2022 testing
let TEST_TOKEN_MINT: PublicKey;

describe("simulation", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;
  let bob: SmartAccountHelper;
  let aliceTokenAccount: any;
  let bobTokenAccount: any;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();

    // Create test token mint for TOKEN_2022 testing
    TEST_TOKEN_MINT = testBase.testSPL2022TokenMint;

    alice = new SmartAccountHelper(
      generateIdFromString("sim_email_1"),
      Keypair.generate(),
      testBase.saProgram
    );
    bob = new SmartAccountHelper(
      generateIdFromString("sim_email_2"),
      Keypair.generate(),
      testBase.saProgram
    );

    // Use mock Token 2022 accounts for vault testing
    aliceTokenAccount = MockATA(
      alice.vault,
      TEST_TOKEN_MINT,
      BigInt(LAMPORTS_PER_SOL * 1000),
      true, // is2022
      true // allowOwnerOffCurve for PDA
    );
    bobTokenAccount = MockATA(
      bob.vault,
      TEST_TOKEN_MINT,
      BigInt(LAMPORTS_PER_SOL * 1000),
      true,
      true
    );

    // Set accounts with initial balances
    testBase.provider.client.setAccount(
      aliceTokenAccount.address,
      aliceTokenAccount.info
    );
    testBase.provider.client.setAccount(
      bobTokenAccount.address,
      bobTokenAccount.info
    );
    testBase.provider.client.airdrop(
      alice.vault,
      BigInt(LAMPORTS_PER_SOL * 1000)
    );
    testBase.provider.client.airdrop(
      bob.vault,
      BigInt(LAMPORTS_PER_SOL * 1000)
    );

    // Create smart accounts
    await testBase.createSmartAccount(alice);
    await testBase.createSmartAccount(bob);
  });

  describe("RPC simulation with gas optimization", () => {
    it("should simulate SOL transfer via RPC and execute with optimized gas", async () => {
      const recipient = PublicKey.unique();
      const transferAmount = 0.1 * LAMPORTS_PER_SOL;

      // Create transfer instruction
      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: recipient,
        lamports: transferAmount,
      });

      // Get initial balances
      const initialRecipientBalance =
        testBase.provider.client.getBalance(recipient);
      const initialVaultBalance = testBase.provider.client.getBalance(
        alice.vault
      );

      // bypass smart account signing
      testBase.provider.client.withSigverify(false);
      // Use the new simulateAndExecute method (includes approval in versioned transaction)
      const result = await alice.simulateAndGetExecuteBatchTx(
        [transferInstruction],
        {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
          errorParser: (error) => testBase.parseError(error),
        }
      );
      // Execute the optimized transaction
      const executeTx = await testBase.provider.sendAndConfirm(
        result.executionResult.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify the transfer happened
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
      );

      // Verify we got realistic gas estimates
      if (result.simulationResult.gasUsed !== null) {
        expect(result.simulationResult.gasUsed).to.be.greaterThan(0);
        expect(result.simulationResult.gasUsed).to.be.lessThan(50000); // Reasonable upper bound
      } else {
        console.log("⚠️ No gas estimate available, but execution still worked");
      }
    });

    it("should simulate and execute multiple SOL transfers with gas optimization", async () => {
      const recipients = [
        PublicKey.unique(),
        PublicKey.unique(),
        PublicKey.unique(),
      ];
      const transferAmount = 0.02 * LAMPORTS_PER_SOL;

      // Create multiple transfer instructions
      const transferInstructions = recipients.map((recipient) =>
        SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        })
      );

      testBase.provider.client.withSigverify(false);
      // Simulate and execute (includes approval in versioned transaction)
      const result = await alice.simulateAndGetExecuteBatchTx(
        transferInstructions,
        {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
          errorParser: (error) => testBase.parseError(error),
        }
      );
      // Execute

      await testBase.provider.sendAndConfirm(
        result.executionResult.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify all transfers happened
      for (const recipient of recipients) {
        const balance = testBase.provider.client.getBalance(recipient);
        expect(Number(balance)).to.equal(transferAmount);
      }

      // Verify gas estimates scale with complexity
      if (result.simulationResult.gasUsed !== null) {
        expect(result.simulationResult.gasUsed).to.be.greaterThan(0);
      }
    });
  });

  describe("token transfer simulation with gas optimization", () => {
    it("should simulate and execute token transfers with optimized gas", async () => {
      const recipient = Keypair.generate();
      const transferAmount = 1_000_000; // 1 token

      // Get vault's token account
      const vaultTokenAccount = testBase.getTokenAccountAddress(
        alice.vault,
        true
      );

      // Create token transfer instructions
      const { instructions } = testBase.createAccountAndTransferInstructions(
        alice.vault, // payer
        vaultTokenAccount, // source
        alice.vault, // authority
        [recipient.publicKey], // recipients
        transferAmount
      );
      testBase.provider.client.withSigverify(false);
      // Simulate and execute (includes approval in versioned transaction)
      const result = await alice.simulateAndGetExecuteBatchTx(instructions, {
        vaultProgram: testBase.vaultProgram,
        provider: testBase.provider as any,
        payer: testBase.txPayer,
        bypassSmartAccountValidation: true,
        useAddressLookupTable: false,
        errorParser: (error) => testBase.parseError(error),
      });

      // Execute

      await testBase.provider.sendAndConfirm(
        result.executionResult.versionedTransaction
      );
      testBase.provider.client.withSigverify(true);

      // Verify token transfer happened
      const recipientTokenAccount = testBase.getTokenAccountAddress(
        recipient.publicKey,
        false
      );
      const finalBalance = await testBase.getTokenBalance(
        recipientTokenAccount
      );
      expect(finalBalance).to.equal(BigInt(transferAmount));

      // Token operations should use more gas than simple SOL transfers
      if (result.simulationResult.gasUsed !== null) {
        expect(result.simulationResult.gasUsed).to.be.greaterThan(5000);
      }
    });
  });

  describe("simulation error detection", () => {
    it("should detect insufficient funds during simulation", async () => {
      const recipient = PublicKey.unique();
      const vaultBalance = testBase.provider.client.getBalance(alice.vault);
      const excessiveAmount = Number(vaultBalance) + LAMPORTS_PER_SOL; // More than available

      const transferInstruction = SystemProgram.transfer({
        fromPubkey: alice.vault,
        toPubkey: recipient,
        lamports: excessiveAmount,
      });

      // Should detect insufficient funds during simulation
      testBase.provider.client.withSigverify(false);
      try {
        await alice.simulateAndGetExecuteBatchTx([transferInstruction], {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
          errorParser: (error) => testBase.parseError(error),
        });
        expect.fail("Should have failed during simulation");
      } catch (error) {
        testBase.provider.client.withSigverify(true);

        // Verify it's the expected simulation failure with insufficient funds error
        expect(error.message).to.include("Insufficient Funds: Transfer:");
      }
    });

    describe("compute units comparison", () => {
      it("should compare simulated vs executed compute units for SOL transfer", async () => {
        const recipient = PublicKey.unique();
        const transferAmount = 0.1 * LAMPORTS_PER_SOL;

        // Create transfer instruction
        const transferInstruction = SystemProgram.transfer({
          fromPubkey: alice.vault,
          toPubkey: recipient,
          lamports: transferAmount,
        });

        testBase.provider.client.withSigverify(false);

        // Step 1: Get simulation result
        const result = await alice.simulateAndGetExecuteBatchTx(
          [transferInstruction],
          {
            vaultProgram: testBase.vaultProgram,
            provider: testBase.provider as any,
            payer: testBase.txPayer,
            bypassSmartAccountValidation: true,
            useAddressLookupTable: false,
            errorParser: (error) => testBase.parseError(error),
          }
        );

        // Step 2: Execute and capture actual compute units
        const executionTx = result.executionResult.versionedTransaction;

        // Simulate the execution transaction to get actual compute units
        const executionSimResult =
          await testBase.provider.client.sendTransaction(executionTx);
        const executedResult = executionSimResult as TransactionMetadata;

        testBase.provider.client.withSigverify(true);

        // Step 3: Compare and log results
        const simulatedUnits = result.simulationResult.gasUsed;
        const executedUnits = executedResult.computeUnitsConsumed();

        console.log("\n📊 Sol transfer Benchmark");
        console.log(`   Simulated: ${simulatedUnits} units`);
        console.log(`   Executed:  ${executedUnits} units`);

        if (simulatedUnits && executedUnits) {
          const difference = Math.abs(simulatedUnits - Number(executedUnits));
          const percentDiff = ((difference / simulatedUnits) * 100).toFixed(2);
          console.log(`   Difference: ${difference} units (${percentDiff}%)`);

          // Verify they're reasonably close (within 20% typically due to compute budget instruction overhead)
          expect(difference).to.be.lessThan(simulatedUnits * 0.05); // Allow 5% variance
        }
      });

      it("should compare simulated vs executed compute units for token transfer", async () => {
        const recipient = Keypair.generate();
        const transferAmount = 500_000; // 0.5 tokens

        // Get vault's token account
        const vaultTokenAccount = testBase.getTokenAccountAddress(
          alice.vault,
          true
        );

        // Create token transfer instructions
        const { instructions } = testBase.createAccountAndTransferInstructions(
          alice.vault, // payer
          vaultTokenAccount, // source
          alice.vault, // authority
          [recipient.publicKey], // recipients
          transferAmount
        );

        testBase.provider.client.withSigverify(false);

        // Step 1: Get simulation result
        const result = await alice.simulateAndGetExecuteBatchTx(instructions, {
          vaultProgram: testBase.vaultProgram,
          provider: testBase.provider as any,
          payer: testBase.txPayer,
          bypassSmartAccountValidation: true,
          useAddressLookupTable: false,
          errorParser: (error) => testBase.parseError(error),
        });

        // Step 2: Simulate execution transaction to get actual compute units
        const executionTx = result.executionResult.versionedTransaction;

        // Simulate the execution transaction to get actual compute units
        const executionSimResult =
          await testBase.provider.client.sendTransaction(executionTx);
        const executedResult = executionSimResult as TransactionMetadata;

        testBase.provider.client.withSigverify(true);

        // Step 3: Compare and log results
        const simulatedUnits = result.simulationResult.gasUsed;
        const executedUnits = executedResult.computeUnitsConsumed();

        console.log("\n📊 Token Transfer Benchmark");
        console.log(`   Simulated: ${simulatedUnits} units`);
        console.log(`   Executed:  ${executedUnits} units`);

        if (simulatedUnits && executedUnits) {
          const difference = Math.abs(simulatedUnits - Number(executedUnits));
          const percentDiff = ((difference / simulatedUnits) * 100).toFixed(2);
          console.log(`   Difference: ${difference} units (${percentDiff}%)`);

          // Verify they're reasonably close
          expect(difference).to.be.lessThan(simulatedUnits * 0.05); // Allow 5% variance
        }
      });
    });
  });
});
