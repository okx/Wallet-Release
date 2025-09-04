#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { DkimKeyOracle } from "../target/types/dkim_key_oracle";
import { loadKeyFromEnv } from "../helpers/key-loader";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

async function initializeDkimOracle() {
    console.log("🚀 Initializing DKIM Key Oracle config...");

    // Set up the provider
    const rpc = process.env.RPC_URL || anchor.AnchorProvider.env().connection.rpcEndpoint;
    const connection = new anchor.web3.Connection(rpc, "confirmed");

    // Load admin key from environment
    const adminInfo = loadKeyFromEnv("ADMIN_SECRET_KEY");

    if (adminInfo.type !== "solana") {
        throw new Error("Expected Solana key type for ADMIN_SECRET_KEY");
    }

    // Load role keys from environment (optional)
    let proposerInfo, executorInfo, cancellerInfo;
    try {
        proposerInfo = loadKeyFromEnv("PROPOSER_SECRET_KEY");
        if (proposerInfo.type !== "solana") proposerInfo = null;
    } catch { proposerInfo = null; }

    try {
        executorInfo = loadKeyFromEnv("EXECUTOR_SECRET_KEY");
        if (executorInfo.type !== "solana") executorInfo = null;
    } catch { executorInfo = null; }

    try {
        cancellerInfo = loadKeyFromEnv("CANCELLER_SECRET_KEY");
        if (cancellerInfo.type !== "solana") cancellerInfo = null;
    } catch { cancellerInfo = null; }

    const wallet = new anchor.Wallet(adminInfo.keyObject);
    const provider = new anchor.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    anchor.setProvider(provider);

    // Load the DKIM Oracle program
    const dkimProgram = anchor.workspace.DkimKeyOracle as anchor.Program<DkimKeyOracle>;
    // Continue with initialization

    // Calculate PDAs
    const configPda = PublicKey.findProgramAddressSync(
        [Buffer.from("dkim_config")],
        dkimProgram.programId
    )[0];

    const dkimProgramData = PublicKey.findProgramAddressSync(
        [dkimProgram.programId.toBytes()],
        new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
    )[0];

    // Check if config already exists
    const configExists = await provider.connection.getAccountInfo(configPda);

    if (configExists) {
        console.log("\n⚠️  DKIM Oracle config already exists, skipping initialization");

        // Display existing config details
        const configAccount = await dkimProgram.account.dkimOracleConfig.fetch(configPda);
        console.log("\n📋 Existing DKIM Oracle Config Details:");
        console.log(`   Admin: ${configAccount.admin.toBase58()}`);
        console.log(`   Timelock Duration: ${configAccount.timelockDuration.toString()} seconds`);
        console.log(`   Members: ${configAccount.members.length}`);
        configAccount.members.forEach((member, index) => {
            console.log(`     ${index + 1}. ${member.key.toBase58()} (permissions: ${member.permissions.mask})`);
        });
    } else {
        console.log("\n🔧 Initializing DKIM Oracle config...");

        // Initialize with 60 seconds timelock (same as tests)
        const timelockDuration = new anchor.BN(300);

        const initTx = await dkimProgram.methods
            .initialize(timelockDuration)
            .accountsPartial({
                config: configPda,
                program: dkimProgram.programId,
                programData: dkimProgramData,
                admin: adminInfo.keyObject.publicKey,
                rentPayer: adminInfo.keyObject.publicKey,
                systemProgram: anchor.web3.SystemProgram.programId,
            })
            .signers([adminInfo.keyObject])
            .rpc();

        console.log(`   ✅ DKIM Oracle config initialized: ${initTx}`);

        // Verify the configuration
        console.log("\n🔍 Verifying configuration...");

        const configAccount = await dkimProgram.account.dkimOracleConfig.fetch(configPda);
        console.log("\n📋 DKIM Oracle Config Details:");
        console.log(`   Admin: ${configAccount.admin.toBase58()}`);
        console.log(`   Timelock Duration: ${configAccount.timelockDuration.toString()} seconds`);
        console.log(`   Members: ${configAccount.members.length} (empty initially)`);
    }

    // Grant roles to members if keys are provided
    console.log("\n🔧 Granting roles to members...");

    const roles = [
        { name: "Proposer", keyInfo: proposerInfo, mask: 1 },
        { name: "Executor", keyInfo: executorInfo, mask: 2 },
        { name: "Canceller", keyInfo: cancellerInfo, mask: 4 }
    ];

    for (const role of roles) {
        if (!role.keyInfo) {
            console.log(`   ⚠️  ${role.name} key not provided, skipping role grant`);
            continue;
        }

        try {
            // Check if member already exists
            const currentConfig = await dkimProgram.account.dkimOracleConfig.fetch(configPda);
            const existingMember = currentConfig.members.find(
                member => member.key.equals(role.keyInfo.keyObject.publicKey)
            );

            if (existingMember) {
                const hasPermission = (Number(existingMember.permissions.mask) & role.mask) !== 0;
                if (hasPermission) {
                    console.log(`   ⚠️  ${role.name} role already granted to ${role.keyInfo.keyObject.publicKey.toBase58()}`);
                    continue;
                } else {
                    console.log(`   ⚠️  Member ${role.keyInfo.keyObject.publicKey.toBase58()} exists but doesn't have ${role.name} permission`);
                    console.log(`        Current permissions: ${existingMember.permissions.mask}, needed: ${role.mask}`);
                    continue;
                }
            }

            console.log(`   🔧 Granting ${role.name} role to ${role.keyInfo.keyObject.publicKey.toBase58()}...`);

            const member = {
                key: role.keyInfo.keyObject.publicKey,
                permissions: { mask: role.mask }
            };

            const grantTx = await dkimProgram.methods
                .grantRole(member)
                .accountsPartial({
                    config: configPda,
                    admin: adminInfo.keyObject.publicKey,
                    rentPayer: adminInfo.keyObject.publicKey,
                    systemProgram: anchor.web3.SystemProgram.programId,
                })
                .signers([adminInfo.keyObject])
                .rpc();

            console.log(`      ✅ ${role.name} role granted: ${grantTx}`);

        } catch (error: any) {
            if (error.message.includes("DuplicateMember")) {
                console.log(`   ⚠️  ${role.name} member already exists`);
            } else {
                console.error(`   ❌ Failed to grant ${role.name} role:`, error.message);
            }
        }
    }

    // Final verification of all members
    console.log("\n🔍 Final verification of members...");
    const finalConfig = await dkimProgram.account.dkimOracleConfig.fetch(configPda);
    if (finalConfig.members.length > 0) {
        console.log(`\n📋 Oracle Members (${finalConfig.members.length}):`);
        finalConfig.members.forEach((member, index) => {
            const permissions = [];
            const mask = Number(member.permissions.mask);
            if (mask & 1) permissions.push("Proposer");
            if (mask & 2) permissions.push("Executor");
            if (mask & 4) permissions.push("Canceller");

            console.log(`   ${index + 1}. ${member.key.toBase58()}`);
            console.log(`      Permissions: ${permissions.join(", ")} (mask: ${mask})`);
        });
    } else {
        console.log("   No members added (all role keys were missing or invalid)");
    }

    console.log("\n🎊 DKIM Oracle initialization completed successfully!");
    console.log("\n📋 Summary:");
    console.log(`   DKIM Oracle Program: ${dkimProgram.programId.toBase58()}`);
    console.log(`   DKIM Oracle Config: ${configPda.toBase58()}`);
    console.log(`   Admin: ${adminInfo.keyObject.publicKey.toBase58()}`);
    console.log(`   Network: ${provider.connection.rpcEndpoint}`);

    // Show role assignments in summary
    const finalRoles = [];
    if (proposerInfo) finalRoles.push(`Proposer: ${proposerInfo.keyObject.publicKey.toBase58()}`);
    if (executorInfo) finalRoles.push(`Executor: ${executorInfo.keyObject.publicKey.toBase58()}`);
    if (cancellerInfo) finalRoles.push(`Canceller: ${cancellerInfo.keyObject.publicKey.toBase58()}`);

    if (finalRoles.length > 0) {
        console.log(`   Roles Assigned:`);
        finalRoles.forEach(role => console.log(`     ${role}`));
    } else {
        console.log(`   Roles Assigned: None (no role keys provided)`);
    }
}

async function main() {
    try {
        await initializeDkimOracle();
    } catch (error: any) {
        console.error(`❌ Error initializing DKIM Oracle:`, error.message);
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