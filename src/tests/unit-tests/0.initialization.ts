import { assert } from "chai";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { SmartAccountSolana } from "../../../target/types/smart_account_solana";
import { Vault } from "../../../target/types/vault";
import {
  CONFIG_SEED,
  VAULT_CONFIG_SEED,
  SMART_ACCOUNT_SOLANA_PROGRAM_ID,
  DKIM_CONFIG_SEED,
} from "../utils/consts";
import { ZkEmailVerifier } from "../../../target/types/zk_email_verifier";
import { DkimKeyOracle } from "../../../target/types/dkim_key_oracle";

const provider = anchor.AnchorProvider.env();
anchor.setProvider(provider);
const deployer = anchor.Wallet.local().payer;
const alice = anchor.web3.Keypair.generate();

const saProgram = anchor.workspace
  .SmartAccountSolana as anchor.Program<SmartAccountSolana>;
const vaultProgram = anchor.workspace.Vault as anchor.Program<Vault>;
const zkVerifierProgram = anchor.workspace
  .ZkEmailVerifier as anchor.Program<ZkEmailVerifier>;
const dkimProgram = anchor.workspace
  .DkimKeyOracle as anchor.Program<DkimKeyOracle>;

let configPda: PublicKey;
let vaultConfigPda: PublicKey;
let dkimConfigPda: PublicKey;

describe("initialization: smart account & vault", () => {
  before(async () => {
    configPda = PublicKey.findProgramAddressSync(
      [Buffer.from(CONFIG_SEED)],
      saProgram.programId
    )[0];

    vaultConfigPda = PublicKey.findProgramAddressSync(
      [Buffer.from(VAULT_CONFIG_SEED)],
      vaultProgram.programId
    )[0];

    dkimConfigPda = PublicKey.findProgramAddressSync(
      [Buffer.from(DKIM_CONFIG_SEED)],
      dkimProgram.programId
    )[0];

    await airdropSol(alice.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
  });

  describe("smart account program", () => {
    it("should revert initialization as non-deployer", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [saProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      try {
        await saProgram.methods
          .initializeConfig({
            creator: deployer.publicKey,
            webauthnModerator: deployer.publicKey,
          })
          .accountsPartial({
            admin: alice.publicKey,
            config: configPda,
            program: saProgram.programId,
            programData: programDataAddress,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([alice])
          .rpc();
      } catch (err) {
        customErrorProcessor(err, "Not deployer");
      }
    });

    it("should initialize as deployer, and create config account", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [saProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      const tx = await saProgram.methods
        .initializeConfig({
          creator: deployer.publicKey,
          webauthnModerator: deployer.publicKey,
        })
        .accountsPartial({
          admin: deployer.publicKey,
          config: configPda,
          program: saProgram.programId,
          programData: programDataAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();
      // Verify the config account was created and has correct state
      const configAccount = await saProgram.account.config.fetch(configPda);

      // Assert the config fields are set correctly
      assert.strictEqual(
        configAccount.creator.toBase58(),
        deployer.publicKey.toBase58(),
        "Creator should match deployer public key"
      );

      assert.strictEqual(
        configAccount.admin.toBase58(),
        deployer.publicKey.toBase58(),
        "Admin should match deployer public key"
      );
    });
  });

  describe("vault program", () => {
    it("should revert initialization as non-deployer", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [vaultProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      try {
        await vaultProgram.methods
          .initializeConfig()
          .accountsPartial({
            admin: alice.publicKey,
            config: vaultConfigPda,
            program: vaultProgram.programId,
            programData: programDataAddress,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([alice])
          .rpc();
      } catch (err) {
        customErrorProcessor(err, "Not deployer");
      }
    });

    it("should initialize as deployer, and create vault config account", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [vaultProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      const tx = await vaultProgram.methods
        .initializeConfig()
        .accountsPartial({
          admin: deployer.publicKey,
          config: vaultConfigPda,
          program: vaultProgram.programId,
          programData: programDataAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();

      // Verify the vault config account was created and has correct state
      const vaultConfigAccount =
        await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);

      // Assert the vault config fields are set correctly
      assert.strictEqual(
        vaultConfigAccount.admin.toBase58(),
        deployer.publicKey.toBase58(),
        "Admin should match deployer public key"
      );

      assert.strictEqual(
        vaultConfigAccount.authorizedPrograms.length,
        0,
        "Should have no authorized programs initially"
      );
    });

    it("should add authorized program to vault config", async () => {
      const tx = await vaultProgram.methods
        .addAuthorizedProgram(SMART_ACCOUNT_SOLANA_PROGRAM_ID)
        .accountsPartial({
          admin: deployer.publicKey,
          config: vaultConfigPda,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();

      // Verify the authorized program was added
      const vaultConfigAccount =
        await vaultProgram.account.vaultConfig.fetch(vaultConfigPda);

      assert.strictEqual(
        vaultConfigAccount.authorizedPrograms.length,
        1,
        "Should have exactly one authorized program"
      );

      assert.strictEqual(
        vaultConfigAccount.authorizedPrograms[0].toBase58(),
        SMART_ACCOUNT_SOLANA_PROGRAM_ID.toBase58(),
        "Authorized program should be the smart account program"
      );
    });

    it("should revert when adding duplicate authorized program", async () => {
      try {
        await vaultProgram.methods
          .addAuthorizedProgram(SMART_ACCOUNT_SOLANA_PROGRAM_ID)
          .accountsPartial({
            admin: deployer.publicKey,
            config: vaultConfigPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .postInstructions([
            await vaultProgram.methods
              .addAuthorizedProgram(SMART_ACCOUNT_SOLANA_PROGRAM_ID)
              .accountsPartial({
                admin: deployer.publicKey,
                config: vaultConfigPda,
                systemProgram: anchor.web3.SystemProgram.programId,
              })
              .instruction(),
          ])
          .signers([deployer])
          .rpc();

        assert.fail("Should have thrown an error for duplicate program");
      } catch (err) {
        customErrorProcessor(err, "Program already authorized");
      }
    });

    it("should revert when non-admin tries to add authorized program", async () => {
      try {
        await vaultProgram.methods
          .addAuthorizedProgram(PublicKey.unique())
          .accountsPartial({
            admin: alice.publicKey,
            config: vaultConfigPda,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([alice])
          .rpc();

        assert.fail("Should have thrown an error for non-admin");
      } catch (err) {
        customErrorProcessor(err, "Unauthorized admin");
      }
    });
  });

  describe("dkim key oracle program", () => {
    it("should revert initialization as non-deployer", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [dkimProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      try {
        await dkimProgram.methods
          .initialize(new anchor.BN(60))
          .accountsPartial({
            admin: alice.publicKey,
            config: dkimConfigPda,
            program: dkimProgram.programId,
            programData: programDataAddress,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([alice])
          .rpc();

        assert.fail("Should have thrown an error for non-deployer");
      } catch (err) {
        customErrorProcessor(err, "Not deployer");
      }
    });

    it("should initialize as deployer, and create dkim config account", async () => {
      const programDataAddress = anchor.web3.PublicKey.findProgramAddressSync(
        [dkimProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
      )[0];

      const tx = await dkimProgram.methods
        .initialize(new anchor.BN(60))
        .accountsPartial({
          admin: deployer.publicKey,
          config: dkimConfigPda,
          program: dkimProgram.programId,
          programData: programDataAddress,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([deployer])
        .rpc();

      const dkimConfigAccount =
        await dkimProgram.account.dkimOracleConfig.fetch(dkimConfigPda);

      assert.strictEqual(
        dkimConfigAccount.admin.toBase58(),
        deployer.publicKey.toBase58(),
        "Admin should match deployer public key"
      );
      assert.strictEqual(
        dkimConfigAccount.timelockDuration.toString(),
        "60",
        "Timelock duration should be 60"
      );
      assert.strictEqual(
        dkimConfigAccount.members.length,
        0,
        "Should have no members initially"
      );
    });
  });
});

const customErrorProcessor = (_err: any, errMsg: string) => {
  assert.isTrue(_err instanceof anchor.AnchorError);
  const err: anchor.AnchorError = _err;
  assert.strictEqual(err.error.errorMessage, errMsg);
};

// Helper functions
export const airdropSol = async (
  publicKey: anchor.web3.PublicKey,
  amount: number
) => {
  const airdropTx = await anchor
    .getProvider()
    .connection.requestAirdrop(publicKey, amount);
  await confirmTransaction(airdropTx);
};

export const confirmTransaction = async (tx: string) => {
  const latestBlockHash = await anchor
    .getProvider()
    .connection.getLatestBlockhash();
  await anchor.getProvider().connection.confirmTransaction({
    blockhash: latestBlockHash.blockhash,
    lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
    signature: tx,
  });
};
