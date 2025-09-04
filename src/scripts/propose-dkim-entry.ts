#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { DkimKeyOracle } from "../target/types/dkim_key_oracle";
import { getDkimOracleConfigAccount, getDkimProposalAccount, getDkimEntryAccount } from "../tests/utils/helpers";
import { loadKeyFromEnv } from "../helpers/key-loader";
import dotenv from "dotenv";
import crypto from "crypto";
import { ethers } from "ethers";

// Load environment variables
dotenv.config();

interface ProposalArgs {
    proposalType: "add" | "remove";
    domain: string;
    publicKeyHash: string; // Required 32-byte hex string
}

interface ExecuteArgs {
    proposalType: "add" | "remove";
    domain: string;
    publicKeyHash: string;
}

async function proposeDkimEntry(args: ProposalArgs) {
    console.log(`🚀 Creating ${args.proposalType.toUpperCase()} proposal for DKIM entry...`);

    // Set up the provider
    const rpc = process.env.RPC_URL || anchor.AnchorProvider.env().connection.rpcEndpoint;
    const connection = new anchor.web3.Connection(rpc, "confirmed");

    // Load proposer key from environment
    const proposerInfo = loadKeyFromEnv("PROPOSER_SECRET_KEY");
    const payerInfo = loadKeyFromEnv("ADMIN_SECRET_KEY"); // Use admin as payer fallback

    if (proposerInfo.type !== "solana" || payerInfo.type !== "solana") {
        throw new Error("Expected Solana key type for PROPOSER_SECRET_KEY and ADMIN_SECRET_KEY");
    }

    const wallet = new anchor.Wallet(proposerInfo.keyObject);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Load the DKIM Oracle program
    const dkimProgram = anchor.workspace.DkimKeyOracle as anchor.Program<DkimKeyOracle>;

    // Generate domain hash (keccak256 of domain)
    const domainHash = ethers.keccak256(Buffer.from(args.domain, "utf-8"));
    const domainHashBuf = Buffer.from(domainHash.substring(2), "hex");
    console.log(`   Domain: ${args.domain}`);
    console.log(`   Domain Hash: ${domainHash}`);

    // Use provided public key hash
    const keyHash = Buffer.from(args.publicKeyHash, "hex");
    console.log(`   Public Key Hash: ${args.publicKeyHash}`);

    // Calculate PDAs
    const configPda = getDkimOracleConfigAccount();

    const proposalTypeBuf = Buffer.from(args.proposalType);
    const proposalPda = getDkimProposalAccount(proposalTypeBuf, domainHashBuf, keyHash);

    const configAccount = await dkimProgram.account.dkimOracleConfig.fetch(configPda);

    // Check if proposal already exists
    const proposalExists = await provider.connection.getAccountInfo(proposalPda);
    if (proposalExists) {
        console.log("\n⚠️  Proposal already exists for this domain/key combination!");

        // Display existing proposal details, calculate execution time
        const proposalAccount = await dkimProgram.account.dkimProposal.fetch(proposalPda);
        console.log("\n📋 Existing Proposal Details:");
        console.log(`   Type: ${Object.keys(proposalAccount.proposalType)[0]}`);
        console.log(`   Domain Hash: ${Buffer.from(proposalAccount.domainHash).toString("hex")}`);
        console.log(`   Key Hash: ${Buffer.from(proposalAccount.keyHash).toString("hex")}`);
        console.log(`   Proposed At: ${new Date(Number(proposalAccount.proposeTime) * 1000).toISOString()}`);
        const timelockDuration = Number(configAccount.timelockDuration);
        const executionTime = new Date((Number(proposalAccount.proposeTime) + timelockDuration) * 1000);
        console.log(`   Execution Time: ${executionTime.toISOString()}`);
        return;
    }

    // Check if proposer has permission
    console.log("\n🔍 Verifying proposer permissions...");
    const proposerMember = configAccount.members.find(
        member => member.key.equals(proposerInfo.keyObject.publicKey)
    );

    if (!proposerMember) {
        throw new Error(`Proposer ${proposerInfo.keyObject.publicKey.toBase58()} is not a member of the oracle`);
    }

    const hasProposerPermission = (Number(proposerMember.permissions.mask) & 1) !== 0; // Permission::Proposer = 1 << 0
    if (!hasProposerPermission) {
        throw new Error(`Member ${proposerInfo.keyObject.publicKey.toBase58()} does not have proposer permissions`);
    }

    console.log(`   ✅ Proposer has valid permissions`);

    // Create the proposal
    console.log("\n🔧 Creating proposal...");

    const proposalTypeObj = args.proposalType === "add" ? { add: {} } : { remove: {} };

    const proposeTx = await dkimProgram.methods
        .propose(
            // @ts-ignore - Anchor type inference issue with enum variants
            {
                proposalType: proposalTypeObj,
                domainHash: Array.from(domainHashBuf),
                keyHash: Array.from(keyHash),
            }
        )
        .accounts({
            // @ts-ignore - Anchor type inference issue with enum variants
            config: configPda,
            proposal: proposalPda,
            member: proposerInfo.keyObject.publicKey,
            rentPayer: payerInfo.keyObject.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([proposerInfo.keyObject, payerInfo.keyObject])
        .transaction();
    proposeTx.recentBlockhash = (
        await provider.connection.getLatestBlockhash()
    ).blockhash;
    proposeTx.feePayer = payerInfo.keyObject.publicKey;

    // Sign the transaction with all instructions (including compute budget)
    proposeTx.sign(payerInfo.keyObject, proposerInfo.keyObject);

    const serializedTx = proposeTx.serialize({
        requireAllSignatures: true,
        verifySignatures: true,
    });

    const res = await provider.connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        preflightCommitment: "processed",
    });

    console.log(`✅ Transaction sent: ${res}`);
}

async function executeDkimProposal(args: ExecuteArgs) {
    console.log(`🚀 Executing ${args.proposalType.toUpperCase()} proposal for DKIM entry...`);

    // Set up the provider
    const rpc = process.env.RPC_URL || anchor.AnchorProvider.env().connection.rpcEndpoint;
    const connection = new anchor.web3.Connection(rpc, "confirmed");

    // Load executor key from environment
    const executorInfo = loadKeyFromEnv("EXECUTOR_SECRET_KEY");
    const payerInfo = loadKeyFromEnv("ADMIN_SECRET_KEY"); // Use admin as payer fallback

    if (executorInfo.type !== "solana" || payerInfo.type !== "solana") {
        throw new Error("Expected Solana key type for EXECUTOR_SECRET_KEY and ADMIN_SECRET_KEY");
    }

    const wallet = new anchor.Wallet(executorInfo.keyObject);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Load the DKIM Oracle program
    const dkimProgram = anchor.workspace.DkimKeyOracle as anchor.Program<DkimKeyOracle>;

    // Generate domain hash (keccak256 of domain)
    const domainHash = ethers.keccak256(Buffer.from(args.domain, "utf-8"));
    const domainHashBuf = Buffer.from(domainHash.substring(2), "hex");
    console.log(`   Domain: ${args.domain}`);
    console.log(`   Domain Hash: ${domainHash}`);

    // Use provided public key hash
    const keyHash = Buffer.from(args.publicKeyHash, "hex");
    console.log(`   Public Key Hash: ${args.publicKeyHash}`);

    // Calculate PDAs
    const configPda = getDkimOracleConfigAccount();
    const proposalTypeBuf = Buffer.from(args.proposalType);
    const proposalPda = getDkimProposalAccount(proposalTypeBuf, domainHashBuf, keyHash);
    const dkimEntryPda = getDkimEntryAccount(domainHashBuf, keyHash);

    // Check if proposal exists
    const proposalExists = await provider.connection.getAccountInfo(proposalPda);
    if (!proposalExists) {
        throw new Error("Proposal does not exist! Create a proposal first.");
    }

    // Fetch proposal and config
    const proposalAccount = await dkimProgram.account.dkimProposal.fetch(proposalPda);
    const configAccount = await dkimProgram.account.dkimOracleConfig.fetch(configPda);

    console.log("\n📋 Proposal Details:");
    console.log(`   Type: ${Object.keys(proposalAccount.proposalType)[0].toUpperCase()}`);
    console.log(`   Proposed At: ${new Date(Number(proposalAccount.proposeTime) * 1000).toISOString()}`);

    // Check if timelock has expired
    const proposalTime = Number(proposalAccount.proposeTime);
    const timelockDuration = Number(configAccount.timelockDuration);
    const currentTime = Math.floor(Date.now() / 1000);
    const executionTime = proposalTime + timelockDuration;

    if (currentTime < executionTime) {
        const remainingTime = executionTime - currentTime;
        const canExecuteAt = new Date(executionTime * 1000);
        throw new Error(`Proposal is still in timelock! Can execute in ${remainingTime} seconds at ${canExecuteAt.toISOString()}`);
    }

    console.log(`   ✅ Timelock has expired, can execute now`);

    // Check if executor has permission
    console.log("\n🔍 Verifying executor permissions...");
    const executorMember = configAccount.members.find(
        member => member.key.equals(executorInfo.keyObject.publicKey)
    );

    if (!executorMember) {
        throw new Error(`Executor ${executorInfo.keyObject.publicKey.toBase58()} is not a member of the oracle`);
    }

    const hasExecutorPermission = (Number(executorMember.permissions.mask) & 2) !== 0; // Permission::Executor = 1 << 1
    if (!hasExecutorPermission) {
        throw new Error(`Member ${executorInfo.keyObject.publicKey.toBase58()} does not have executor permissions`);
    }

    console.log(`   ✅ Executor has valid permissions`);

    // Execute the proposal
    console.log("\n🔧 Executing proposal...");

    let executeTx;
    if (args.proposalType === "add") {
        executeTx = await dkimProgram.methods
            .executeAdd()
            .accountsPartial({
                config: configPda,
                dkimEntry: dkimEntryPda,
                proposal: proposalPda,
                member: executorInfo.keyObject.publicKey,
                rentPayer: payerInfo.keyObject.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([executorInfo.keyObject, payerInfo.keyObject])
            .transaction();
    } else {
        // For remove, check if DKIM entry exists
        const entryExists = await provider.connection.getAccountInfo(dkimEntryPda);
        if (!entryExists) {
            throw new Error("DKIM entry does not exist! Cannot remove non-existent entry.");
        }

        executeTx = await dkimProgram.methods
            .executeDelete()
            .accountsPartial({
                config: configPda,
                dkimEntry: dkimEntryPda,
                proposal: proposalPda,
                member: executorInfo.keyObject.publicKey,
                rentPayer: payerInfo.keyObject.publicKey,
            })
            .signers([executorInfo.keyObject, payerInfo.keyObject])
            .transaction();
    }

    executeTx.recentBlockhash = (
        await provider.connection.getLatestBlockhash()
    ).blockhash;
    executeTx.feePayer = payerInfo.keyObject.publicKey;

    // Sign and send transaction
    executeTx.sign(payerInfo.keyObject, executorInfo.keyObject);

    const serializedTx = executeTx.serialize({
        requireAllSignatures: true,
        verifySignatures: true,
    });

    const res = await provider.connection.sendRawTransaction(serializedTx, {
        skipPreflight: false,
        preflightCommitment: "processed",
    });

    console.log(`   ✅ Proposal executed successfully: ${res}`);

    console.log("\n🎊 DKIM proposal execution completed!");
    console.log("\n📋 Summary:");
    console.log(`   Proposal Type: ${args.proposalType.toUpperCase()}`);
    console.log(`   Domain: ${args.domain}`);
    console.log(`   Executor: ${executorInfo.keyObject.publicKey.toBase58()}`);
    console.log(`   Transaction: ${res}`);
    console.log(`   Network: ${provider.connection.rpcEndpoint}`);
}

async function main() {
    try {
        // Parse command line arguments
        const args = process.argv.slice(2);

        if (args.length < 4) {
            console.log("Usage: npm run propose-dkim-entry <propose|execute> <add|remove> <domain> <publicKeyHash>");
            console.log("Examples:");
            console.log("  # Create proposal:");
            console.log("  npm run propose-dkim-entry propose add gmail.com 0EA9C777DC7110E5A9E89B13F0CFC540E3845BA120B2B6DC24024D61488D4788");
            console.log("  # Execute proposal:");
            console.log("  npm run propose-dkim-entry execute add gmail.com 0EA9C777DC7110E5A9E89B13F0CFC540E3845BA120B2B6DC24024D61488D4788");
            process.exit(1);
        }

        const [action, proposalType, domain, publicKeyHash] = args;

        if (!["propose", "execute"].includes(action)) {
            throw new Error("Action must be 'propose' or 'execute'");
        }

        if (!["add", "remove"].includes(proposalType)) {
            throw new Error("Proposal type must be 'add' or 'remove'");
        }

        if (!/^[0-9a-fA-F]{64}$/.test(publicKeyHash)) {
            throw new Error("Public key hash must be 64 hex characters (32 bytes)");
        }

        const commonArgs = {
            proposalType: proposalType as "add" | "remove",
            domain,
            publicKeyHash,
        };

        if (action === "propose") {
            await proposeDkimEntry(commonArgs);
        } else {
            await executeDkimProposal(commonArgs);
        }
    } catch (error: any) {
        console.error(`❌ Error:`, error.message);
        if (error.logs) {
            console.error("Transaction logs:", error.logs);
        }
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(console.error);
}
