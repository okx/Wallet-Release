import * as anchor from "@coral-xyz/anchor";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";
import { A } from "@raydium-io/raydium-sdk-v2/lib/raydium-a0e78f8b";
import { deriveWebAuthnTableAddress } from "../utils/helpers";

describe("update smart account config", () => {
  let testBase: TestBase;

  before(async () => {
    testBase = new TestBase();
    await testBase.setup();
  });

  describe("update admin", () => {
    it("should update admin", async () => {
      const config = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(config.admin.toBase58()).to.equal(
        testBase.admin.publicKey.toBase58()
      );

      const newAdmin = new anchor.web3.Keypair();
      await testBase.saProgram.methods
        .updateAdmin(newAdmin.publicKey)
        .accounts({
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(updatedConfig.admin.toBase58()).to.equal(
        newAdmin.publicKey.toBase58()
      );

      // switch back
      await testBase.saProgram.methods
        .updateAdmin(testBase.admin.publicKey)
        .accounts({
          txPayer: newAdmin.publicKey,
        })
        .signers([newAdmin])
        .rpc();
    });

    it("should not update the admin as non-admin", async () => {
      const newAdmin = new anchor.web3.Keypair();
      try {
        await testBase.saProgram.methods
          .updateAdmin(newAdmin.publicKey)
          .accounts({ txPayer: newAdmin.publicKey })
          .signers([newAdmin])
          .rpc();
        assert.fail("should revert with invalid admin");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Only updated by admin");
      }
    });

    it("should not update admin to default address", async () => {
      try {
        // default public key
        await testBase.saProgram.methods
          .updateAdmin(
            new anchor.web3.PublicKey("11111111111111111111111111111111")
          )
          .accounts({
            txPayer: testBase.admin.publicKey,
          })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should throw error");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Invalid admin");
      }
    });
  });

  describe("update creator", () => {
    it("should update creator", async () => {
      const config = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(config.creator.toBase58()).to.equal(
        testBase.creator.publicKey.toBase58()
      );

      const newCreator = new anchor.web3.Keypair();
      await testBase.saProgram.methods
        .updateCreator(newCreator.publicKey)
        .accounts({
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(updatedConfig.creator.toBase58()).to.equal(
        newCreator.publicKey.toBase58()
      );

      // switch back
      await testBase.saProgram.methods
        .updateCreator(testBase.creator.publicKey)
        .accounts({
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();
    });
  });

  describe("update webauthn moderator", () => {
    it("should update webauthn moderator", async () => {
      const config = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(config.webauthnModerator.toBase58()).to.equal(
        testBase.webauthnModerator.publicKey.toBase58()
      );

      const newWebauthnModerator = new anchor.web3.Keypair();
      await testBase.saProgram.methods
        .updateWebauthnModerator(newWebauthnModerator.publicKey)
        .accounts({
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(updatedConfig.webauthnModerator.toBase58()).to.equal(
        newWebauthnModerator.publicKey.toBase58()
      );

      // switch back
      await testBase.saProgram.methods
        .updateWebauthnModerator(testBase.webauthnModerator.publicKey)
        .accounts({
          txPayer: testBase.admin.publicKey,
        })
        .signers([testBase.admin])
        .rpc();
    });
  });

  const newRecoverySigner = [
    new anchor.web3.Keypair(),
    new anchor.web3.Keypair(),
    new anchor.web3.Keypair(),
  ];

  describe("revoke admin", () => {
    it("should revoke admin", async () => {
      await testBase.saProgram.methods
        .revokeAdmin()
        .accounts({ txPayer: testBase.admin.publicKey })
        .signers([testBase.admin])
        .rpc();

      const updatedConfig = await testBase.saProgram.account.config.fetch(
        testBase.config
      );
      expect(updatedConfig.admin).to.deep.equal(
        new anchor.web3.PublicKey("11111111111111111111111111111111")
      );
    });
  });

  describe("webauthn table", () => {
    let webauthnTable: anchor.web3.PublicKey;
    let preJsonMock = "preJsonMock";
    let postJsonMock = "postJsonMock";
    let authDataMock = new Uint8Array(37).fill(1);
    before(async () => {
      [webauthnTable] = deriveWebAuthnTableAddress(1);
    });
    it("should validate creation is from webauthn moderator", async () => {
      try {
        await testBase.saProgram.methods
          .createWebauthnTable({ tableIndex: 1 })
          .accountsPartial({
            webauthnModerator: testBase.admin.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should throw error");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Not WebAuthn moderator");
      }
    });

    it("should be able to create webauthn table", async () => {
      await testBase.saProgram.methods
        .createWebauthnTable({ tableIndex: 1 })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.tableIndex).to.equal(1);
      expect(webauthnTableState.preJsonTable.length).to.equal(0);
      expect(webauthnTableState.postJsonTable.length).to.equal(0);
      expect(webauthnTableState.authDataTable.length).to.equal(0);
    });

    it("should validate that only webauthn moderator can add entries", async () => {
      try {
        await testBase.saProgram.methods
          .addWebauthnTableEntry({
            entry: { preJson: [preJsonMock] },
          })
          .accountsPartial({
            webauthnModerator: testBase.admin.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should throw error - not webauthn moderator");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Not WebAuthn moderator");
      }
    });

    it("should add preJson entry successfully", async () => {
      await testBase.saProgram.methods
        .addWebauthnTableEntry({
          entry: { preJson: [preJsonMock] },
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(1);
      expect(webauthnTableState.preJsonTable[0]).to.equal(preJsonMock);
      expect(webauthnTableState.postJsonTable.length).to.equal(0);
      expect(webauthnTableState.authDataTable.length).to.equal(0);
    });

    it("should add postJson entry successfully", async () => {
      await testBase.saProgram.methods
        .addWebauthnTableEntry({
          entry: { postJson: [postJsonMock] },
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(1);
      expect(webauthnTableState.preJsonTable[0]).to.equal(preJsonMock);
      expect(webauthnTableState.postJsonTable.length).to.equal(1);
      expect(webauthnTableState.postJsonTable[0]).to.equal(postJsonMock);
      expect(webauthnTableState.authDataTable.length).to.equal(0);
    });

    it("should add authData entry successfully", async () => {
      await testBase.saProgram.methods
        .addWebauthnTableEntry({
          entry: { authData: [Array.from(authDataMock)] },
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(1);
      expect(webauthnTableState.preJsonTable[0]).to.equal(preJsonMock);
      expect(webauthnTableState.postJsonTable.length).to.equal(1);
      expect(webauthnTableState.postJsonTable[0]).to.equal(postJsonMock);
      expect(webauthnTableState.authDataTable.length).to.equal(1);
      expect(
        Buffer.from(webauthnTableState.authDataTable[0]).toString("hex")
      ).to.equal(Buffer.from(authDataMock).toString("hex"));
    });

    it("should prevent duplicate preJson entries", async () => {
      await testBase.client.expireBlockhash();
      try {
        await testBase.saProgram.methods
          .addWebauthnTableEntry({
            entry: { preJson: [preJsonMock] },
          })
          .accountsPartial({
            webauthnModerator: testBase.webauthnModerator.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.webauthnModerator])
          .rpc();
        assert.fail("should throw error - duplicate entry");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Duplicate entry");
      }
    });

    it("should prevent duplicate postJson entries", async () => {
      await testBase.client.expireBlockhash();
      try {
        await testBase.saProgram.methods
          .addWebauthnTableEntry({
            entry: { postJson: [postJsonMock] },
          })
          .accountsPartial({
            webauthnModerator: testBase.webauthnModerator.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.webauthnModerator])
          .rpc();
        assert.fail("should throw error - duplicate entry");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Duplicate entry");
      }
    });

    it("should prevent duplicate authData entries", async () => {
      await testBase.client.expireBlockhash();
      try {
        await testBase.saProgram.methods
          .addWebauthnTableEntry({
            entry: { authData: [Array.from(authDataMock)] },
          })
          .accountsPartial({
            webauthnModerator: testBase.webauthnModerator.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.webauthnModerator])
          .rpc();
        assert.fail("should throw error - duplicate entry");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Duplicate entry");
      }
    });

    it("should validate final table state after all operations", async () => {
      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);

      // Verify all tables have the expected content
      expect(webauthnTableState.preJsonTable.length).to.equal(1);
      expect(webauthnTableState.preJsonTable[0]).to.equal(preJsonMock);

      expect(webauthnTableState.postJsonTable.length).to.equal(1);
      expect(webauthnTableState.postJsonTable[0]).to.equal(postJsonMock);

      expect(webauthnTableState.authDataTable.length).to.equal(1);
      expect(
        Buffer.from(webauthnTableState.authDataTable[0]).toString("hex")
      ).to.equal(Buffer.from(authDataMock).toString("hex"));
    });

    it("should validate that only webauthn moderator can remove entries", async () => {
      try {
        await testBase.saProgram.methods
          .removeWebauthnTableEntry({
            tableType: { preJson: {} },
            entryIndex: 0,
          })
          .accountsPartial({
            webauthnModerator: testBase.admin.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should throw error - not webauthn moderator");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Not WebAuthn moderator");
      }
    });

    it("should remove RP ID entry successfully", async () => {
      // First verify the entry exists
      let webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(1);
      expect(webauthnTableState.preJsonTable[0]).to.equal(preJsonMock);

      // Remove the entry
      await testBase.saProgram.methods
        .removeWebauthnTableEntry({
          tableType: { preJson: {} },
          entryIndex: 0,
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      // Verify the entry was removed
      webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(0);
      expect(webauthnTableState.postJsonTable.length).to.equal(1);
      expect(webauthnTableState.authDataTable.length).to.equal(1);
    });

    it("should remove postJson entry successfully", async () => {
      // First verify the entry exists
      let webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.postJsonTable.length).to.equal(1);
      expect(webauthnTableState.postJsonTable[0]).to.equal(postJsonMock);

      // Remove the entry
      await testBase.saProgram.methods
        .removeWebauthnTableEntry({
          tableType: { postJson: {} },
          entryIndex: 0,
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      // Verify the entry was removed
      webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(0);
      expect(webauthnTableState.postJsonTable.length).to.equal(0);
      expect(webauthnTableState.authDataTable.length).to.equal(1);
    });

    it("should remove authData entry successfully", async () => {
      // First verify the entry exists
      let webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.authDataTable.length).to.equal(1);
      expect(
        Buffer.from(webauthnTableState.authDataTable[0]).toString("hex")
      ).to.equal(Buffer.from(authDataMock).toString("hex"));

      // Remove the entry
      await testBase.saProgram.methods
        .removeWebauthnTableEntry({
          tableType: { authData: {} },
          entryIndex: 0,
        })
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      // Verify the entry was removed
      webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.preJsonTable.length).to.equal(0);
      expect(webauthnTableState.postJsonTable.length).to.equal(0);
      expect(webauthnTableState.authDataTable.length).to.equal(0);
    });

    it("should fail to remove entry with invalid index", async () => {
      try {
        await testBase.saProgram.methods
          .removeWebauthnTableEntry({
            tableType: { preJson: {} },
            entryIndex: 5, // Invalid index
          })
          .accountsPartial({
            webauthnModerator: testBase.webauthnModerator.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.webauthnModerator])
          .rpc();
        assert.fail("should throw error - invalid index");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Invalid webauthn index");
      }
    });

    it("should fail to remove entry from empty table", async () => {
      await testBase.client.expireBlockhash();
      try {
        await testBase.saProgram.methods
          .removeWebauthnTableEntry({
            tableType: { preJson: {} },
            entryIndex: 0, // Table is now empty
          })
          .accountsPartial({
            webauthnModerator: testBase.webauthnModerator.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.webauthnModerator])
          .rpc();
        assert.fail("should throw error - empty table");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Invalid webauthn index");
      }
    });

    it("should validate final empty state after all removals", async () => {
      const webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);

      // Verify all tables are empty
      expect(webauthnTableState.preJsonTable.length).to.equal(0);
      expect(webauthnTableState.postJsonTable.length).to.equal(0);
      expect(webauthnTableState.authDataTable.length).to.equal(0);

      // Verify table metadata remains intact
      expect(webauthnTableState.tableIndex).to.equal(1);
      expect(webauthnTableState.bump[0]).to.be.greaterThan(0);
    });

    it("should validate that only webauthn moderator can close table", async () => {
      try {
        await testBase.saProgram.methods
          .closeWebauthnTable()
          .accountsPartial({
            webauthnModerator: testBase.admin.publicKey,
            webauthnTable: webauthnTable,
          })
          .signers([testBase.admin])
          .rpc();
        assert.fail("should throw error - not webauthn moderator");
      } catch (err) {
        expect(err.error.errorMessage).to.equal("Not WebAuthn moderator");
      }
    });

    it("should close webauthn table successfully", async () => {
      // First verify the table exists
      let webauthnTableState =
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
      expect(webauthnTableState.tableIndex).to.equal(1);

      // Close the table
      await testBase.saProgram.methods
        .closeWebauthnTable()
        .accountsPartial({
          webauthnModerator: testBase.webauthnModerator.publicKey,
          webauthnTable: webauthnTable,
        })
        .signers([testBase.webauthnModerator])
        .rpc();

      // Verify the table was closed (account should no longer exist)
      try {
        await testBase.saProgram.account.webauthnTable.fetch(webauthnTable);
        assert.fail("table should have been closed");
      } catch (err) {
        expect(err.message).to.include("Account does not exist");
      }
    });
  });
});
