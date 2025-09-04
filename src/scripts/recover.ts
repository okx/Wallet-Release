#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { buildBn128, utils } from "ffjavascript";
const { unstringifyBigInts } = utils;
import fs from "fs";
import path from "path";
import * as wasm from "../wasm/pkg/wasm";
import { ZkEmailVerifier } from "../target/types/zk_email_verifier";
import { DkimKeyOracle } from "../target/types/dkim_key_oracle";
import { Vault } from "../target/types/vault";
import { SmartAccountSolana } from "../target/types/smart_account_solana";
import { keccak256 } from "ethers";
import { loadEnv } from "../helpers/setup";
import dotenv from "dotenv";
import { displayKeyInfo, loadKeyFromEnv } from "../helpers/key-loader";
import { generateIdFromString } from "../tests/utils/helpers";
import { TestR1KeyHelper } from "../helpers/r1-test-helper";

// Load environment variables
dotenv.config();

/**
 * Process ZK proof from file
 */
async function processProof(proofPath: string) {

    const curve = await buildBn128(true);
    const proof = JSON.parse(fs.readFileSync(path.resolve(proofPath), "utf-8"));
    const proofProc = unstringifyBigInts(proof);

    // Convert proof components
    let pi_a = g1Uncompressed(curve, proofProc.pi_a);
    pi_a = Buffer.from(wasm.convert_proof(pi_a));
    const pi_b = g2Uncompressed(curve, proofProc.pi_b);
    const pi_c = g1Uncompressed(curve, proofProc.pi_c);

    return {
        proofA: Array.from(pi_a),
        proofB: Array.from(pi_b),
        proofC: Array.from(pi_c),
    };
}

function g1Uncompressed(curve: any, p1Raw: any): Buffer {
    let p1 = curve.G1.fromObject(p1Raw);

    let buff = new Uint8Array(64); // 64 bytes for G1 uncompressed
    curve.G1.toRprUncompressed(buff, 0, p1);

    return Buffer.from(buff);
}

function g2Uncompressed(curve: any, p2Raw: any): Buffer {
    let p2 = curve.G2.fromObject(p2Raw);

    let buff = new Uint8Array(128); // 128 bytes for G2 uncompressed
    curve.G2.toRprUncompressed(buff, 0, p2);

    return Buffer.from(buff);
}

/**
 * Recover smart account
 */
async function recover() {
    const saId = process.env.SA_ID;
    if (!saId) {
        throw new Error("SA_ID environment variable is required");
    }

    const r1KeyInfo = loadKeyFromEnv("TEST_RECOVERY_R1_PRIVATE_KEY");
    const recoverySignerInfo = loadKeyFromEnv("RECOVERY_SIGNER_SECRET_KEY");

    if (r1KeyInfo.type !== "r1") {
        throw new Error("Expected R1 key type for TEST_RECOVERY_R1_PRIVATE_KEY");
    }
    if (recoverySignerInfo.type !== "solana") {
        throw new Error("Expected Solana key type for RECOVERY_SIGNER_SECRET_KEY");
    }

    displayKeyInfo("Using environment R1 key for passkey", r1KeyInfo);
    displayKeyInfo("Recovery Signer", recoverySignerInfo);

    // Set up the provider
    const rpc = process.env.RPC_URL || anchor.AnchorProvider.env().connection.rpcEndpoint;
    const connection = new anchor.web3.Connection(rpc, "confirmed");

    const { saProgram, vaultProgram, zkVerifierProgram, dkimKeyOracleProgram } = loadEnv();
    const wallet = new anchor.Wallet(recoverySignerInfo.keyObject);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Proof data
    const proofData = {
        emailDomain: "gmail.com",
        keyHash: "0x0EA9C777DC7110E5A9E89B13F0CFC540E3845BA120B2B6DC24024D61488D4788",
        emailNullifier: "0x0CB271F23B723D29C956CC40D8DB871ACF829657DB404358AE6C4F0A9E4866FC",
        timestamp: 1753696800,
        timestampStr: "2025-07-28 18:00:00",
        emailHash: "0x0668EC67BE5F7C5A5F57D65AA96741AE2EDCC9F53C3446074BA2CE84920183C5",
        proofFile: "tests/emails/proof.json",
    };

    const pemString = r1KeyInfo.keyObject.encodePrivateKey();
    const wrappedR1Key = new TestR1KeyHelper(pemString);

    // Generate accounts
    const okxId = generateIdFromString(saId);
    const zkVerifierAccount = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("zk_verifier"), okxId],
        zkVerifierProgram.programId
    )[0];
    const smartAccountConfigPda = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("config")],
        saProgram.programId
    )[0];
    const smartAccount = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("smart_account"), okxId],
        saProgram.programId
    )[0];
    const smartAccountVault = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("smart_account_vault"), okxId],
        vaultProgram.programId
    )[0];
    const vaultState = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault_state"), okxId],
        vaultProgram.programId
    )[0];
    const dkimEntryPda = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("entry"), Buffer.from(keccak256(Buffer.from(proofData.emailDomain, "utf-8")).substring(2), "hex"), Buffer.from(proofData.keyHash.substring(2), "hex")],
        dkimKeyOracleProgram.programId
    )[0];

    // Process proof
    console.log("📄 Processing proof...");
    const zkProof = await processProof(proofData.proofFile);

    // Recovery data
    const recoveryData = {
        emailDomain: "gmail.com",
        dkimPubkeyHash: Array.from(Buffer.from(proofData.keyHash.substring(2), "hex")),
        emailNullifer: Array.from(Buffer.from(proofData.emailNullifier.substring(2), "hex")),
        emailHash: Array.from(Buffer.from(proofData.emailHash.substring(2), "hex")),
        pubkey: wrappedR1Key.getPublicKeyArray(),
        timestamp: new anchor.BN(proofData.timestamp),
        timestampStr: proofData.timestampStr,
    };

    console.log("🚀 Executing recovery...");

    // Execute recovery
    const tx = await zkVerifierProgram.methods
        .recover(recoveryData, zkProof)
        .accounts({
            recoverySigner: recoverySignerInfo.keyObject.publicKey,
            feeRecipient: recoverySignerInfo.keyObject.publicKey,
            // @ts-ignore
            zkVerifierAccount: zkVerifierAccount,
            smartAccountProgram: saProgram.programId,
            smartAccountConfig: smartAccountConfigPda,
            smartAccount: smartAccount,
            vaultProgram: vaultProgram.programId,
            smartAccountVault: smartAccountVault,
            vaultState: vaultState,
            entryPda: dkimEntryPda,
            sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([recoverySignerInfo.keyObject])
        .preInstructions([
            anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ units: 500_000 }),
            anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }),
        ])
        .rpc();

    console.log(`✅ Recovery completed: ${tx}`);
}

// Run
if (require.main === module) {
    recover()
        .then(() => console.log("✅ Done"))
        .catch((err) => {
            console.error("❌ Error:", err.message || err);
            process.exit(1);
        });
}
