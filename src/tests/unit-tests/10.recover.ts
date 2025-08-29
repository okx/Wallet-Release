import * as anchor from "@coral-xyz/anchor";
import { generateIdFromString } from "../utils/helpers";
import { SmartAccountHelper } from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { expect } from "chai";
import { TestR1KeyHelper } from "../../helpers/r1-test-helper";
import { LAMPORTS_PER_SIGNER } from "../utils/consts";

describe("recover", () => {
  let testBase: TestBase;
  let alice: SmartAccountHelper;
  let bob: SmartAccountHelper; // Add bob for testing without recovery signers

  before(async () => {
    testBase = new TestBase();

    await testBase.setup();

    alice = new SmartAccountHelper(
      generateIdFromString("user 1"),
      testBase.mandatorySigner,
      testBase.saProgram
    );

    // Create bob without recovery signers
    bob = new SmartAccountHelper(
      generateIdFromString("user 2"),
      testBase.mandatorySigner,
      testBase.saProgram,
      anchor.web3.Keypair.generate() // This will be overridden
    );

    testBase.client.airdrop(
      alice.vault,
      BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
    );

    testBase.client.airdrop(
      bob.vault,
      BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
    );

    await testBase.createSmartAccount(alice);

    // Create bob's smart account but remove recovery signers
    await testBase.createSmartAccount(bob);
    // Note: bob will have recovery signers from the default constructor,
    // but we'll test with a completely different signer
  });

  describe("recover", () => {
    it("should recover", async () => {
      const ecPem = require("ec-pem");
      const rawKey = ecPem(null, "prime256v1");
      rawKey.generateKeys();
      const pemString = rawKey.encodePrivateKey();
      const newPasskeyKeypair = new TestR1KeyHelper(pemString);

      const currentTimestamp = testBase.client.getClock().unixTimestamp;

      const oldSaAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const oldUserSignerCount =
        oldSaAccount.authorizationModel.payMultisig[0].userSigners.length;

      const rentPayer = new anchor.web3.Keypair();
      testBase.client.airdrop(
        rentPayer.publicKey,
        BigInt(100 * anchor.web3.LAMPORTS_PER_SOL)
      );

      const oldSmartAccountSize = BigInt(296);
      const newSmartAccountSize = oldSmartAccountSize + BigInt(33 + 8 + 8);
      const vaultStateSize = BigInt(107);
      const oldRent =
        testBase.client.getRent().minimumBalance(oldSmartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const newRent =
        testBase.client.getRent().minimumBalance(newSmartAccountSize) +
        testBase.client.getRent().minimumBalance(vaultStateSize);
      const additionalRent = newRent - oldRent;

      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 3); // 1 Fee payer + 1 Recovery signer + 1 Rent Payer

      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const aliceSaBalBefore = testBase.client.getBalance(alice.sa);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const recoverySignerBalBefore = testBase.client.getBalance(
        alice.recoverySigners[0].publicKey
      );
      const rentPayerBalBefore = testBase.client.getBalance(
        rentPayer.publicKey
      );

      await testBase.saProgram.methods
        .recover(newPasskeyKeypair.getPublicKeyArray())
        .accountsPartial({
          smartAccount: alice.sa,
          recoverySigner: alice.recoverySigners[0].publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
          rentPayer: rentPayer.publicKey,
        })
        .signers([alice.recoverySigners[0], rentPayer])
        .rpc();

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const aliceSaBalAfter = testBase.client.getBalance(alice.sa);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const recoverySignerBalAfter = testBase.client.getBalance(
        alice.recoverySigners[0].publicKey
      );
      const rentPayerBalAfter = testBase.client.getBalance(rentPayer.publicKey);

      expect(aliceBalAfter).to.equal(aliceBalBefore);
      expect(aliceSaBalAfter).to.equal(aliceSaBalBefore + additionalRent);
      expect(txPayerBalAfter).to.equal(txPayerBalBefore - executionFees);
      expect(recoverySignerBalAfter).to.equal(recoverySignerBalBefore);
      expect(rentPayerBalAfter).to.equal(rentPayerBalBefore - additionalRent);

      const newSaAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const newUserSignerCount =
        newSaAccount.authorizationModel.payMultisig[0].userSigners.length;
      const newPasskey =
        newSaAccount.authorizationModel.payMultisig[0].userSigners[
          newUserSignerCount - 1
        ];

      expect(newUserSignerCount).to.equal(oldUserSignerCount + 1);
      expect(newPasskey.pubkey).to.deep.equal(
        newPasskeyKeypair.getPublicKeyArray()
      );
      expect(BigInt(newPasskey.validFrom.toString())).to.deep.equal(
        currentTimestamp
      );
      expect(BigInt(newPasskey.validUntil.toString())).to.deep.equal(
        BigInt("18446744073709551615")
      );
    });

    it("should fail when recovery signer is not in the smart account", async () => {
      const ecPem = require("ec-pem");
      const rawKey = ecPem(null, "prime256v1");
      rawKey.generateKeys();
      const pemString = rawKey.encodePrivateKey();
      const newPasskeyKeypair = new TestR1KeyHelper(pemString);

      // Create a completely different recovery signer that's not in bob's smart account
      const invalidRecoverySigner = anchor.web3.Keypair.generate();

      try {
        await testBase.saProgram.methods
          .recover(newPasskeyKeypair.getPublicKeyArray())
          .accountsPartial({
            smartAccount: bob.sa,
            recoverySigner: invalidRecoverySigner.publicKey, // Use invalid signer
            rentPayer: testBase.txPayer.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([invalidRecoverySigner])
          .rpc();

        // If we reach here, the test should fail
        expect.fail(
          "Expected transaction to fail with InvalidRecoverySigner error"
        );
      } catch (error: any) {
        // Check that the error is the expected InvalidRecoverySigner error
        expect(error.error.errorCode.code).to.equal("InvalidRecoverySigner");
        expect(error.error.errorMessage).to.equal("Invalid recovery signer");
      }
    });

    it("should recover with existing passkey without paying rent", async () => {
      // Get the existing passkey that was created with alice's account
      const existingPasskeyKeypair = alice.passkeyKeypair;

      // Get the current account state to verify the existing passkey
      const saAccountBefore =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      const userSignerCountBefore =
        saAccountBefore.authorizationModel.payMultisig[0].userSigners.length;

      // Find the existing passkey and verify its initial validity
      const existingPasskey =
        saAccountBefore.authorizationModel.payMultisig[0].userSigners.find(
          (signer: any) =>
            signer.pubkey.toString() ===
            existingPasskeyKeypair.getPublicKeyArray().toString()
        );
      expect(existingPasskey).to.not.be.undefined;

      // Store the original validity for comparison
      const originalValidFrom = BigInt(existingPasskey.validFrom.toString());
      const originalValidUntil = BigInt(existingPasskey.validUntil.toString());

      // Now recover with the same passkey - this should update validity without resizing
      const currentTimestamp = testBase.client.getClock().unixTimestamp;

      const aliceBalBefore = testBase.client.getBalance(alice.vault);
      const aliceSaBalBefore = testBase.client.getBalance(alice.sa);
      const txPayerBalBefore = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const recoverySignerBalBefore = testBase.client.getBalance(
        alice.recoverySigners[0].publicKey
      );

      // No rent payer needed since we're not resizing
      await testBase.saProgram.methods
        .recover(existingPasskeyKeypair.getPublicKeyArray())
        .accountsPartial({
          smartAccount: alice.sa,
          recoverySigner: alice.recoverySigners[0].publicKey,
          rentPayer: testBase.txPayer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([alice.recoverySigners[0]])
        .rpc();

      const aliceBalAfter = testBase.client.getBalance(alice.vault);
      const aliceSaBalAfter = testBase.client.getBalance(alice.sa);
      const txPayerBalAfter = testBase.client.getBalance(
        testBase.txPayer.publicKey
      );
      const recoverySignerBalAfter = testBase.client.getBalance(
        alice.recoverySigners[0].publicKey
      );

      // Balances should remain the same (no rent paid)
      expect(aliceBalAfter).to.equal(aliceBalBefore);
      expect(aliceSaBalAfter).to.equal(aliceSaBalBefore);

      // Only execution fees should be deducted
      const executionFees = BigInt(LAMPORTS_PER_SIGNER * 2); // 1 Fee payer + 1 Recovery signer
      expect(txPayerBalAfter).to.equal(txPayerBalBefore - executionFees);
      expect(recoverySignerBalAfter).to.equal(recoverySignerBalBefore);

      // Get the updated account state
      const newSaAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const newUserSignerCount =
        newSaAccount.authorizationModel.payMultisig[0].userSigners.length;

      // Signer count should remain the same
      expect(newUserSignerCount).to.equal(userSignerCountBefore);

      // Find the updated passkey
      const updatedPasskey =
        newSaAccount.authorizationModel.payMultisig[0].userSigners.find(
          (signer: any) =>
            signer.pubkey.toString() ===
            existingPasskeyKeypair.getPublicKeyArray().toString()
        );
      expect(updatedPasskey).to.not.be.undefined;

      // Validity should be updated to current timestamp
      expect(BigInt(updatedPasskey.validFrom.toString())).to.equal(
        currentTimestamp
      );
      expect(BigInt(updatedPasskey.validUntil.toString())).to.equal(
        BigInt("18446744073709551615")
      );

      // Verify that the validity was actually updated (not just the same)
      expect(BigInt(updatedPasskey.validFrom.toString())).to.not.equal(
        originalValidFrom
      );
    });
  });
});
