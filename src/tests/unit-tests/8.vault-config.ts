import { Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";

describe("vault-config", () => {
  let testBase: TestBase;
  let newAdmin: Keypair;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();
    newAdmin = Keypair.generate();
  });

  describe("admin updates", () => {
    it("should update the admin", async () => {
      const config = await testBase.vaultProgram.account.vaultConfig.fetch(
        testBase.vaultConfig
      );
      expect(config.admin.toBase58()).to.equal(
        testBase.admin.publicKey.toBase58()
      );

      await testBase.vaultProgram.methods
        .updateAdmin(newAdmin.publicKey)
        .accounts({ admin: testBase.admin.publicKey })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig =
        await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );
      expect(updatedConfig.admin.toBase58()).to.equal(
        newAdmin.publicKey.toBase58()
      );
      await testBase.vaultProgram.methods
        .updateAdmin(testBase.admin.publicKey)
        .accounts({ admin: newAdmin.publicKey })
        .signers([newAdmin])
        .rpc();
    });
    it("should not update the admin to default address", async () => {
      try {
        await testBase.vaultProgram.methods
          .updateAdmin(new PublicKey("11111111111111111111111111111111"))
          .accounts({ admin: testBase.admin.publicKey })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should revert with invalid admin");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Invalid admin");
      }
    });

    it("should not update the admin as non-admin", async () => {
      try {
        await testBase.vaultProgram.methods
          .updateAdmin(newAdmin.publicKey)
          .accounts({ admin: newAdmin.publicKey })
          .signers([newAdmin])
          .rpc();
        assert.fail("should revert with invalid admin");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Unauthorized admin");
      }
    });
  });

  describe("authorized program management", () => {
    // Use fixed public keys instead of random ones for consistent testing
    const testProgramId = PublicKey.unique();
    const anotherProgramId = PublicKey.unique();

    it("should reject add_authorized_program when not signed by admin", async () => {
      const unauthorizedSigner = Keypair.generate();

      // Airdrop some SOL to the unauthorized signer for transaction fees
      testBase.provider.client.airdrop(
        unauthorizedSigner.publicKey,
        BigInt(LAMPORTS_PER_SOL)
      );

      try {
        await testBase.vaultProgram.methods
          .addAuthorizedProgram(testProgramId)
          .accountsPartial({
            config: testBase.vaultConfig,
            admin: unauthorizedSigner.publicKey, // Wrong admin
          })
          .signers([unauthorizedSigner])
          .rpc();

        expect.fail("Should have failed with Unauthorized error");
      } catch (error) {
        // Use the error parsing utility
        const parsed = testBase.parseError(error);

        // Should be an Anchor error with Unauthorized constraint violation
        expect(parsed.anchor.isAnchorError).to.be.true;
        expect(parsed.anchor.errorName).to.equal("Unauthorized");
      }
    });

    it("should successfully add_authorized_program when signed by correct admin", async () => {
      // Check initial state
      const initialConfig =
        await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );
      const initialProgramCount = initialConfig.authorizedPrograms.length;
      expect(initialConfig.authorizedPrograms).to.not.include(testProgramId);

      // Execute add_authorized_program with correct admin
      await testBase.vaultProgram.methods
        .addAuthorizedProgram(testProgramId)
        .accountsPartial({
          config: testBase.vaultConfig,
          admin: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      // Verify program was added
      const finalConfig = await testBase.vaultProgram.account.vaultConfig.fetch(
        testBase.vaultConfig
      );
      expect(finalConfig.authorizedPrograms.length).to.equal(
        initialProgramCount + 1
      );
      expect(
        finalConfig.authorizedPrograms.map((p) => p.toBase58())
      ).to.include(testProgramId.toBase58());
    });

    it("should reject adding the same program twice (duplicate check)", async () => {
      // Try to add the same program again (testProgramId was added in previous test)
      testBase.provider.client.expireBlockhash();
      try {
        await testBase.vaultProgram.methods
          .addAuthorizedProgram(testProgramId)
          .accountsPartial({
            config: testBase.vaultConfig,
            admin: testBase.admin.publicKey,
          })
          .signers([testBase.admin])
          .rpc();

        expect.fail("Should have failed with ProgramAlreadyAuthorized error");
      } catch (error) {
        // Use the error parsing utility to see full error structure
        const parsed = testBase.parseError(error);

        // Should be an Anchor error with ProgramAlreadyAuthorized
        expect(parsed.anchor.isAnchorError).to.be.true;
        expect(parsed.anchor.errorName).to.equal("ProgramAlreadyAuthorized");
      }
    });

    it("should successfully add multiple different programs", async () => {
      // Get initial state
      const initialConfig =
        await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );
      const initialProgramCount = initialConfig.authorizedPrograms.length;

      // Add another program
      await testBase.vaultProgram.methods
        .addAuthorizedProgram(anotherProgramId)
        .accountsPartial({
          config: testBase.vaultConfig,
          admin: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      // Verify both programs are authorized
      const finalConfig = await testBase.vaultProgram.account.vaultConfig.fetch(
        testBase.vaultConfig
      );
      expect(finalConfig.authorizedPrograms.length).to.equal(
        initialProgramCount + 1
      );
      expect(
        finalConfig.authorizedPrograms.map((p) => p.toBase58())
      ).to.include(testProgramId.toBase58());
      expect(
        finalConfig.authorizedPrograms.map((p) => p.toBase58())
      ).to.include(anotherProgramId.toBase58());
    });
  });

  describe("revoke admin", () => {
    it("should not revoke the admin as non-admin", async () => {
      try {
        await testBase.vaultProgram.methods
          .revokeAdmin()
          .accounts({ admin: newAdmin.publicKey })
          .signers([newAdmin])
          .rpc();
        assert.fail("should revert with invalid admin");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Unauthorized admin");
      }
    });

    it("should revoke the admin", async () => {
      const config = await testBase.vaultProgram.account.vaultConfig.fetch(
        testBase.vaultConfig
      );
      expect(config.admin.toBase58()).to.equal(
        testBase.admin.publicKey.toBase58()
      );
      await testBase.vaultProgram.methods
        .revokeAdmin()
        .accounts({ admin: testBase.admin.publicKey })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig =
        await testBase.vaultProgram.account.vaultConfig.fetch(
          testBase.vaultConfig
        );
      expect(updatedConfig.admin.toBase58()).to.equal(
        new PublicKey("11111111111111111111111111111111").toBase58()
      );
    });
  });
});
