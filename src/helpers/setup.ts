import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Connection } from "@solana/web3.js";
import dotenv from "dotenv";
import { Keypair } from "@solana/web3.js";
import { SmartAccountSolana } from "../../target/types/smart_account_solana";
import { Vault } from "../../target/types/vault";
import { UpgradeMock } from "../../target/types/upgrade_mock";
import { ZkEmailVerifier } from "../../target/types/zk_email_verifier";
import { DkimKeyOracle } from "../../target/types/dkim_key_oracle";
import { SOLANA_RPC_URL } from "../consts";
import { parseBase58SecretKeyToUint8Array } from "../utils";

// Load environment variables
dotenv.config();

export function loadEnv(): {
  saProgram: Program<SmartAccountSolana>;
  vaultProgram: Program<Vault>;
  upgradeMockProgram: Program<UpgradeMock>;
  zkVerifierProgram: Program<ZkEmailVerifier>;
  dkimKeyOracleProgram: Program<DkimKeyOracle>;
} {
  const rpc = SOLANA_RPC_URL;
  const wallet = loadWallet(); // Load your deployer wallet
  const connection = new Connection(rpc, "confirmed");

  // Set up saPrograme provider with the URL and wallet
  const provider = new anchor.AnchorProvider(connection, wallet, {
    preflightCommitment: "confirmed",
  });
  anchor.setProvider(provider);

  // Get both program instances
  const saProgram = anchor.workspace
    .SmartAccountSolana as Program<SmartAccountSolana>;
  const vaultProgram = anchor.workspace.Vault as Program<Vault>;
  const upgradeMockProgram = anchor.workspace
    .UpgradeMock as Program<UpgradeMock>;
  const zkVerifierProgram = anchor.workspace
    .ZkEmailVerifier as Program<ZkEmailVerifier>;
  const dkimKeyOracleProgram = anchor.workspace
    .DkimKeyOracle as Program<DkimKeyOracle>;
  
  return { saProgram, vaultProgram, upgradeMockProgram, zkVerifierProgram, dkimKeyOracleProgram };
}

function loadWallet(): anchor.Wallet {
  const secretKeyString = parseBase58SecretKeyToUint8Array(process.env.SOL_EOA_PRIVATE_KEY);
  if (!secretKeyString) {
    throw new Error("SOL_EOA_PRIVATE_KEY is not defined in the .env file");
  }

  try {
    // Parse the JSON-encoded secret key from the environment variable
    const secretKey = Uint8Array.from(JSON.parse(secretKeyString));
    if (secretKey.length !== 64) {
      throw new Error("Invalid secret key length. Expected 64 bytes.");
    }

    const keypair = Keypair.fromSecretKey(secretKey);
    return new anchor.Wallet(keypair);
  } catch (error) {
    throw new Error(`Invalid SOL_EOA_PRIVATE_KEY format: ${error.message}`);
  }
}

