import * as anchor from "@coral-xyz/anchor";
import { generateIdFromString } from "../utils/helpers";
import { SmartAccountHelper } from "../utils/smartAccount/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import { LAMPORTS_PER_SOL, Transaction } from "@solana/web3.js";
import { createSecp256r1Instruction } from "../utils/r1-utils";
import {
  WebAuthnAuthDataHelpers,
  WebAuthnStringHelpers,
} from "../utils/webauthn";
const ECDSA = require("ecdsa-secp256r1");

describe("update smart account state", () => {
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

    await testBase.provider.client.airdrop(
      alice.vault,
      BigInt(10 * LAMPORTS_PER_SOL)
    );
  });

  describe("config state", () => {
    it("config state should be successfully written", async () => {
      await testBase.assertConfigState();
    });
  });

  describe("update mandatory signer", () => {
    it("should create smart account as creator", async () => {
      await testBase.createSmartAccount(alice);
    });

    it("should update mandatory signer", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      expect(
        saAccount.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      ).to.equal(alice.mandatorySigner.publicKey.toBase58());

      const newMandatorySigner = new anchor.web3.Keypair();
      await testBase.saProgram.methods
        .updateMandatorySigner(newMandatorySigner.publicKey)
        .accounts({
          config: testBase.config,
          smartAccount: alice.sa,
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].mandatorySigner.toBase58()
      ).to.equal(newMandatorySigner.publicKey.toBase58());

      //revert back to original mandatory signer
      await testBase.saProgram.methods
        .updateMandatorySigner(alice.mandatorySigner.publicKey)
        .accounts({
          config: testBase.config,
          smartAccount: alice.sa,
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();
    });
  });

  describe("update passkey signer", () => {
    const newPasskeyKeypair = ECDSA.generateKey();
    const publicKeyBase64 = newPasskeyKeypair.toCompressedPublicKey();

    it("should update passkey signer", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(alice.getPasskeyPubkey()));

      const passkey = {
        pubkey: Array.from(Buffer.from(publicKeyBase64, "base64")),
        validFrom: alice.validFrom,
        validUntil: alice.validUntil,
      };

      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .addSigner({ passkey: [passkey] })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[1].pubkey
      ).to.deep.equal(passkey.pubkey);
    });

    it("should add a new passkey signer and verify balances", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const initialSignerCount =
        saAccount.authorizationModel.payMultisig[0].userSigners.length;

      // Get balances before adding new passkey
      const saBalanceBefore = Number(
        await testBase.provider.client.getBalance(alice.sa)
      );
      const vaultBalanceBefore = Number(
        await testBase.provider.client.getBalance(alice.vault)
      );
      const txPayerBalanceBefore = Number(
        await testBase.provider.client.getBalance(testBase.txPayer.publicKey)
      );

      // Generate a completely new passkey for this test
      const newPasskeyKeypair = ECDSA.generateKey();
      const newPublicKeyBase64 = newPasskeyKeypair.toCompressedPublicKey();

      const newPasskey = {
        pubkey: Array.from(Buffer.from(newPublicKeyBase64, "base64")),
        validFrom: alice.validFrom,
        validUntil: alice.validUntil,
      };

      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .addSigner({ passkey: [newPasskey] })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Get balances after adding new passkey
      const saBalanceAfter = Number(
        await testBase.provider.client.getBalance(alice.sa)
      );
      const vaultBalanceAfter = Number(
        await testBase.provider.client.getBalance(alice.vault)
      );
      const txPayerBalanceAfter = Number(
        await testBase.provider.client.getBalance(testBase.txPayer.publicKey)
      );

      // Verify the new passkey was added
      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      const finalSignerCount =
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners.length;

      expect(finalSignerCount).to.equal(initialSignerCount + 1);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[
          finalSignerCount - 1
        ].pubkey
      ).to.deep.equal(newPasskey.pubkey);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[
          finalSignerCount - 1
        ].validFrom.toString()
      ).to.equal(newPasskey.validFrom.toString());
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[
          finalSignerCount - 1
        ].validUntil.toString()
      ).to.equal(newPasskey.validUntil.toString());

      // Verify balance changes
      // Smart account should have increased balance (rent for new signer)
      expect(saBalanceAfter).to.be.greaterThan(saBalanceBefore);

      // Transaction payer should have decreased balance (paid for transaction fees only)
      expect(txPayerBalanceAfter).to.be.lessThan(txPayerBalanceBefore);

      // Calculate rent amount and payer cost
      const rentAmount = saBalanceAfter - saBalanceBefore;
      const payerCost = txPayerBalanceBefore - txPayerBalanceAfter;
      const vaultBalanceChange = vaultBalanceAfter - vaultBalanceBefore;

      // Payer cost should be greater than 0 (transaction fees)
      expect(payerCost).to.be.greaterThan(0);
      expect(rentAmount).to.be.greaterThan(0);

      // Verify the rent allocation strategy: rent is paid from vault to smart account
      expect(vaultBalanceChange).to.equal(-rentAmount);

      // The rent for the new signer is paid by transferring funds from the vault to the smart account
      // This ensures the smart account has sufficient funds to cover the additional storage requirements
    });

    it("should update validity of passkey signer", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(alice.getPasskeyPubkey()));

      const newPasskey = {
        pubkey: Array.from(Buffer.from(publicKeyBase64, "base64")),
        validFrom: new anchor.BN(alice.validFrom).add(new anchor.BN(1000)),
        validUntil: new anchor.BN(alice.validUntil).add(new anchor.BN(1000)),
      };

      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .addSigner({ passkey: [newPasskey] })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[1].pubkey
      ).to.deep.equal(newPasskey.pubkey);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[1].validFrom.toString()
      ).to.equal(newPasskey.validFrom.toString());
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[1].validUntil.toString()
      ).to.equal(newPasskey.validUntil.toString());
    });

    it("should remove passkey signer + move rent to vault", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      expect(
        saAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(alice.getPasskeyPubkey()));
      const initialSignerCount =
        saAccount.authorizationModel.payMultisig[0].userSigners.length;

      // Get balances before removal
      const saBalanceBefore = await testBase.provider.client.getBalance(
        alice.sa
      );
      const vaultBalanceBefore = await testBase.provider.client.getBalance(
        alice.vault
      );
      testBase.provider.client.withSigverify(false);

      const customFeePayer = testBase.txPayer; // or any other keypair

      const tx = await testBase.saProgram.methods
        .removeSigner({
          passkey: [Array.from(Buffer.from(publicKeyBase64, "base64"))],
        })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .transaction();

      tx.feePayer = customFeePayer.publicKey;
      tx.recentBlockhash = await testBase.provider.client.latestBlockhash();
      tx.sign(customFeePayer);

      let res = await testBase.provider.client.sendTransaction(tx);

      testBase.provider.client.withSigverify(true);

      // Get balances after removal
      const saBalanceAfter = await testBase.provider.client.getBalance(
        alice.sa
      );
      const vaultBalanceAfter = await testBase.provider.client.getBalance(
        alice.vault
      );

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners[0].pubkey
      ).to.deep.equal(Array.from(alice.getPasskeyPubkey()));
      expect(
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners.length
      ).to.equal(initialSignerCount - 1);

      // Verify rent was properly moved to vault
      const actualRentMoved = saBalanceBefore - saBalanceAfter;
      const vaultIncrease = vaultBalanceAfter - vaultBalanceBefore;

      // Ensure vault received the excess rent
      expect(Number(vaultIncrease)).to.equal(Number(actualRentMoved));
      expect(Number(actualRentMoved)).to.be.greaterThan(0);
    });

    it("should revert removing passkey signer that does not exist", async () => {
      try {
        testBase.provider.client.withSigverify(false);
        testBase.client.expireBlockhash();
        await testBase.saProgram.methods
          .removeSigner({
            passkey: [
              Array.from(
                Buffer.from(newPasskeyKeypair.toCompressedPublicKey(), "base64")
              ),
            ],
          })
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail("should revert with Passkey not found");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal("Passkey not found");
      }
    });

    it("should remove all signers systematically and fail when removing the last signer", async () => {
      // This test first removes all signers systematically, then attempts to remove the last one
      // which should fail with "Removing last signer" error

      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const initialSignerCount =
        saAccount.authorizationModel.payMultisig[0].userSigners.length;

      // Get initial balances
      const initialSaBalance = await testBase.provider.client.getBalance(
        alice.sa
      );
      const initialVaultBalance = await testBase.provider.client.getBalance(
        alice.vault
      );

      // Remove all signers one by one (except the last one which should fail)
      for (let i = 0; i < initialSignerCount - 1; i++) {
        const currentSaAccount =
          await testBase.saProgram.account.smartAccount.fetch(alice.sa);
        const currentSignerCount =
          currentSaAccount.authorizationModel.payMultisig[0].userSigners.length;
        const signerToRemove =
          currentSaAccount.authorizationModel.payMultisig[0].userSigners[0]; // Always remove the first one

        // Get balances before removal
        const saBalanceBefore = await testBase.provider.client.getBalance(
          alice.sa
        );
        const vaultBalanceBefore = await testBase.provider.client.getBalance(
          alice.vault
        );

        testBase.provider.client.withSigverify(false);

        const customFeePayer = testBase.txPayer;
        const tx = await testBase.saProgram.methods
          .removeSigner({
            passkey: [Array.from(signerToRemove.pubkey)],
          })
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
          })
          .transaction();

        tx.feePayer = customFeePayer.publicKey;
        tx.recentBlockhash = await testBase.provider.client.latestBlockhash();
        tx.sign(customFeePayer);

        await testBase.provider.client.sendTransaction(tx);
        testBase.provider.client.withSigverify(true);

        // Verify the signer was removed
        const updatedSaAccount =
          await testBase.saProgram.account.smartAccount.fetch(alice.sa);
        const newSignerCount =
          updatedSaAccount.authorizationModel.payMultisig[0].userSigners.length;

        expect(newSignerCount).to.equal(currentSignerCount - 1);

        // Verify rent was properly moved to vault
        const saBalanceAfter = await testBase.provider.client.getBalance(
          alice.sa
        );
        const vaultBalanceAfter = await testBase.provider.client.getBalance(
          alice.vault
        );

        const rentMoved = saBalanceBefore - saBalanceAfter;
        const vaultIncrease = vaultBalanceAfter - vaultBalanceBefore;

        expect(Number(vaultIncrease)).to.equal(Number(rentMoved));
        expect(Number(rentMoved)).to.be.greaterThan(0);
      }

      // Verify we now have only 1 signer left
      const finalSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      const finalSignerCount =
        finalSaAccount.authorizationModel.payMultisig[0].userSigners.length;
      expect(finalSignerCount).to.equal(1);

      // Verify total rent was moved to vault
      const finalSaBalance = await testBase.provider.client.getBalance(
        alice.sa
      );
      const finalVaultBalance = await testBase.provider.client.getBalance(
        alice.vault
      );

      const totalRentMoved = initialSaBalance - finalSaBalance;
      const totalVaultIncrease = finalVaultBalance - initialVaultBalance;

      // The vault should have received all the rent that was freed up
      expect(Number(totalVaultIncrease)).to.equal(Number(totalRentMoved));

      // Now attempt to remove the last signer, which should fail
      try {
        testBase.provider.client.withSigverify(false);
        testBase.client.expireBlockhash();

        const lastSigner =
          finalSaAccount.authorizationModel.payMultisig[0].userSigners[0];
        await testBase.saProgram.methods
          .removeSigner({
            passkey: [Array.from(lastSigner.pubkey)],
          })
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail("should revert with Removing last signer");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal("Removing last signer");
      }
    });
  });

  describe("signer instruction validation tests", () => {
    // No setup needed - using existing alice account for validation tests

    it("should revert adding solana key signer to pay multisig account", async () => {
      const solanaKeySigner = {
        pubkey: anchor.web3.Keypair.generate().publicKey,
        validFrom: new anchor.BN(Date.now() / 1000),
        validUntil: new anchor.BN(Date.now() / 1000 + 3600),
      };

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .addSigner({ solanaKey: [solanaKeySigner] })
          .accountsPartial({
            smartAccount: alice.sa, // Alice has a PayMultisig account
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail(
          "should revert with Solana key not supported in PayMultisig"
        );
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal(
          "Solana key signers not supported in PayMultisig authorization model"
        );
      }
    });

    it("should revert removing solana key signer from pay multisig account", async () => {
      const nonExistentKey = anchor.web3.Keypair.generate();

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .removeSigner({ solanaKey: [nonExistentKey.publicKey] })
          .accountsPartial({
            smartAccount: alice.sa, // Alice has a PayMultisig account
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail("should revert with Solana key not found");
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal("Solana key not found");
      }
    });

    it("should confirm new instruction names work correctly", async () => {
      // This test verifies that the renamed instructions (addSigner, removeSigner)
      // work with the existing PayMultisig accounts and SignerType enum parameter
      const newPasskeyKeypair = ECDSA.generateKey();
      const publicKeyBase64 = newPasskeyKeypair.toCompressedPublicKey();

      const passkey = {
        pubkey: Array.from(Buffer.from(publicKeyBase64, "base64")),
        validFrom: alice.validFrom,
        validUntil: alice.validUntil,
      };

      // Test that addSigner with SignerType::Passkey works
      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .addSigner({ passkey: [passkey] })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify the passkey was added
      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      const signerCount =
        updatedSaAccount.authorizationModel.payMultisig[0].userSigners.length;
      expect(signerCount).to.be.greaterThan(1); // Should have more than the original signer

      // Test that removeSigner with SignerIdentifier::Passkey works
      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .removeSigner({
          passkey: [Array.from(Buffer.from(publicKeyBase64, "base64"))],
        })
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      // Verify the passkey was removed
      const finalSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      const finalSignerCount =
        finalSaAccount.authorizationModel.payMultisig[0].userSigners.length;
      expect(finalSignerCount).to.equal(signerCount - 1); // Should have one less signer
    });

    it("should revert adding solana key signer to pay multisig account", async () => {
      const solanaKeySigner = {
        pubkey: anchor.web3.Keypair.generate().publicKey,
        validFrom: new anchor.BN(Date.now() / 1000),
        validUntil: new anchor.BN(Date.now() / 1000 + 3600),
      };

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .addSigner({ solanaKey: [solanaKeySigner] })
          .accountsPartial({
            smartAccount: alice.sa, // Alice has a PayMultisig account
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail(
          "should revert with Solana key not supported in PayMultisig"
        );
      } catch (error) {
        testBase.provider.client.withSigverify(true);
        expect(error.error.errorMessage).to.equal(
          "Solana key signers not supported in PayMultisig authorization model"
        );
      }
    });
  });

  describe("recovery signer management", () => {
    const secondRecoverySigner = anchor.web3.Keypair.generate();

    it("should add a new recovery signer successfully", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const initialRecoverySignerCount = saAccount.recoverySigners.length;

      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .addRecoverySigner(secondRecoverySigner.publicKey)
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(updatedSaAccount.recoverySigners.length).to.equal(
        initialRecoverySignerCount + 1
      );
      expect(
        updatedSaAccount.recoverySigners
          .map((signer) => signer.toString())
          .includes(secondRecoverySigner.publicKey.toString())
      ).to.be.true;
    });

    it("should revert when adding duplicate recovery signer", async () => {
      testBase.provider.client.expireBlockhash();

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .addRecoverySigner(secondRecoverySigner.publicKey)
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
          })
          .rpc();
        assert.fail("should revert with RecoverySignerAlreadyExists");
      } catch (error) {
        expect(error.error.errorMessage).to.equal(
          "Recovery signer already exists"
        );
      } finally {
        testBase.provider.client.withSigverify(true);
      }
    });

    it("should remove a recovery signer successfully", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const initialRecoverySignerCount = saAccount.recoverySigners.length;

      // Get balances before removal
      const saBalanceBefore = testBase.provider.client.getBalance(alice.sa);
      const vaultBalanceBefore = testBase.provider.client.getBalance(
        alice.vault
      );

      testBase.provider.client.withSigverify(false);
      await testBase.saProgram.methods
        .removeRecoverySigner(secondRecoverySigner.publicKey)
        .accountsPartial({
          smartAccount: alice.sa,
          smartAccountVault: alice.vault,
        })
        .rpc();
      testBase.provider.client.withSigverify(true);

      const updatedSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);

      expect(updatedSaAccount.recoverySigners.length).to.equal(
        initialRecoverySignerCount - 1
      );
      expect(
        updatedSaAccount.recoverySigners
          .map((signer) => signer.toString())
          .includes(secondRecoverySigner.publicKey.toString())
      ).to.be.false;

      // Verify rent was properly moved to vault
      const saBalanceAfter = testBase.provider.client.getBalance(alice.sa);
      const vaultBalanceAfter = testBase.provider.client.getBalance(
        alice.vault
      );

      const actualRentMoved = saBalanceBefore - saBalanceAfter;
      const vaultIncrease = vaultBalanceAfter - vaultBalanceBefore;

      // Ensure vault received the excess rent
      expect(Number(vaultIncrease)).to.equal(Number(actualRentMoved));
      expect(Number(actualRentMoved)).to.be.greaterThan(0);
    });

    it("should revert when removing non-existent recovery signer", async () => {
      const nonExistentRecoverySigner = anchor.web3.Keypair.generate();

      try {
        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .removeRecoverySigner(nonExistentRecoverySigner.publicKey)
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
            systemProgram: anchor.web3.SystemProgram.programId,
          })

          .rpc();
        assert.fail("should revert with RecoverySignerNotFound");
      } catch (error) {
        expect(error.error.errorMessage).to.equal("Recovery signer not found");
      } finally {
        testBase.provider.client.withSigverify(true);
      }
    });

    it("should allow removing the last recovery signer", async () => {
      const saAccount = await testBase.saProgram.account.smartAccount.fetch(
        alice.sa
      );
      const initialRecoverySignerCount = saAccount.recoverySigners.length;

      // Remove all recovery signers one by one
      for (let i = 0; i < initialRecoverySignerCount; i++) {
        const currentRecoverySigner = saAccount.recoverySigners[0]; // Always remove the first one

        testBase.provider.client.withSigverify(false);
        await testBase.saProgram.methods
          .removeRecoverySigner(currentRecoverySigner)
          .accountsPartial({
            smartAccount: alice.sa,
            smartAccountVault: alice.vault,
          })
          .rpc();
        testBase.provider.client.withSigverify(true);

        // Verify the recovery signer was removed
        const updatedSaAccount =
          await testBase.saProgram.account.smartAccount.fetch(alice.sa);
        expect(updatedSaAccount.recoverySigners.length).to.equal(
          initialRecoverySignerCount - i - 1
        );
        expect(
          updatedSaAccount.recoverySigners
            .map((signer) => signer.toString())
            .includes(currentRecoverySigner.toString())
        ).to.be.false;
      }

      // Verify all recovery signers were removed
      const finalSaAccount =
        await testBase.saProgram.account.smartAccount.fetch(alice.sa);
      expect(finalSaAccount.recoverySigners.length).to.equal(0);
    });
  });
});
