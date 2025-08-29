import * as anchor from "@coral-xyz/anchor";
import { getDkimEntryAccount, getDkimOracleConfigAccount, getDkimProposalAccount } from "../utils/helpers";
import { TestBase } from "../utils/testBase";
import { assert, expect } from "chai";

describe("dkim key oracle", () => {
    let testBase: TestBase;

    let proposer: anchor.web3.Keypair;
    let executor: anchor.web3.Keypair;
    let canceller: anchor.web3.Keypair;
    let nonAdmin: anchor.web3.Keypair;
    let configPda: anchor.web3.PublicKey;

    before(async () => {
        testBase = new TestBase();
        await testBase.setup();
    });

    describe("initialize", () => {
        it("should initialize", async () => {
            const dkimConfigAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(getDkimOracleConfigAccount());
            expect(dkimConfigAccount.admin.toBase58()).to.equal(testBase.admin.publicKey.toBase58());
            expect(dkimConfigAccount.timelockDuration.toString()).to.equal("60");
            expect((dkimConfigAccount as any).members).to.have.length(0); // Should start with no members
        });
        it("should check dkim entry", async () => {
            const dkimEntryPda = getDkimEntryAccount(Buffer.from(testBase.domainHash), Buffer.from(testBase.keyHash));
            expect(testBase.provider.client.getAccount(dkimEntryPda).owner).to.deep.equal(testBase.dkimProgram.programId);
        });
    });

    describe("privilege management", () => {

        before(async () => {
            proposer = new anchor.web3.Keypair();
            executor = new anchor.web3.Keypair();
            canceller = new anchor.web3.Keypair();
            nonAdmin = new anchor.web3.Keypair();
            configPda = getDkimOracleConfigAccount();
        });

        describe("grant role", () => {
            it("should grant proposer role successfully", async () => {
                const member = {
                    key: proposer.publicKey,
                    permissions: { mask: 1 } // Proposer permission
                };

                // Check rent payer balance before
                const rentPayerBalanceBefore = testBase.provider.client.getBalance(testBase.txPayer.publicKey);

                await testBase.dkimProgram.methods
                    .grantRole(member)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        rentPayer: testBase.txPayer.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin, testBase.txPayer])
                    .rpc();

                // Check rent payer balance after - should have decreased (paid rent for account expansion)
                const rentPayerBalanceAfter = testBase.provider.client.getBalance(testBase.txPayer.publicKey);
                expect(rentPayerBalanceAfter < rentPayerBalanceBefore).to.be.true;

                const configAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(configPda);
                expect((configAccount as any).members).to.have.length(1);
                expect((configAccount as any).members[0].key.toBase58()).to.equal(proposer.publicKey.toBase58());
                expect((configAccount as any).members[0].permissions.mask).to.equal(1);
            });

            it("should grant executor role successfully", async () => {
                const member = {
                    key: executor.publicKey,
                    permissions: { mask: 2 } // Executor permission
                };

                // Check rent payer balance before
                const rentPayerBalanceBefore = testBase.provider.client.getBalance(testBase.txPayer.publicKey);

                await testBase.dkimProgram.methods
                    .grantRole(member)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        rentPayer: testBase.txPayer.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin, testBase.txPayer])
                    .rpc();

                // Check rent payer balance after - should have decreased (paid rent for account expansion)
                const rentPayerBalanceAfter = testBase.provider.client.getBalance(testBase.txPayer.publicKey);
                expect(rentPayerBalanceAfter < rentPayerBalanceBefore).to.be.true;

                const configAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(configPda);
                expect((configAccount as any).members).to.have.length(2);

                const executorMember = (configAccount as any).members.find(m =>
                    m.key.toBase58() === executor.publicKey.toBase58()
                );
                expect(executorMember).to.exist;
                expect(executorMember.permissions.mask).to.equal(2);
            });

            it("should grant canceller role successfully", async () => {
                const member = {
                    key: canceller.publicKey,
                    permissions: { mask: 4 } // Canceller permission
                };

                await testBase.dkimProgram.methods
                    .grantRole(member)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        rentPayer: testBase.txPayer.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin, testBase.txPayer])
                    .rpc();

                const configAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(configPda);
                expect((configAccount as any).members).to.have.length(3);

                const cancellerMember = (configAccount as any).members.find(m =>
                    m.key.toBase58() === canceller.publicKey.toBase58()
                );
                expect(cancellerMember).to.exist;
                expect(cancellerMember.permissions.mask).to.equal(4);
            });

            it("should grant multiple permissions successfully", async () => {
                const member4 = new anchor.web3.Keypair();
                const member = {
                    key: member4.publicKey,
                    permissions: { mask: 7 } // All permissions (1 + 2 + 4 = 7)
                };

                await testBase.dkimProgram.methods
                    .grantRole(member)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        rentPayer: testBase.txPayer.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin, testBase.txPayer])
                    .rpc();

                const configAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(configPda);
                expect((configAccount as any).members).to.have.length(4);

                const allPermsMember = (configAccount as any).members.find(m =>
                    m.key.toBase58() === member4.publicKey.toBase58()
                );
                expect(allPermsMember).to.exist;
                expect(allPermsMember.permissions.mask).to.equal(7);
            });

            it("should fail to grant role to duplicate member", async () => {
                const member = {
                    key: proposer.publicKey,
                    permissions: { mask: 2 } // Different permission
                };

                try {
                    await testBase.dkimProgram.methods
                        .grantRole(member)
                        .accounts({
                            // @ts-ignore
                            config: configPda,
                            admin: testBase.admin.publicKey,
                            rentPayer: testBase.txPayer.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                        .signers([testBase.admin, testBase.txPayer])
                        .rpc();
                    expect.fail("Should have thrown an error for duplicate member");
                } catch (error) {
                    expect(error.toString()).to.include("DuplicateMember");
                }
            });

            it("should fail when non-admin tries to grant role", async () => {
                // airdrop to nonAdmin
                testBase.provider.client.airdrop(nonAdmin.publicKey, testBase.INITIAL_AIRDROP);
                const member5 = new anchor.web3.Keypair();
                const member = {
                    key: member5.publicKey,
                    permissions: { mask: 1 }
                };

                try {
                    await testBase.dkimProgram.methods
                        .grantRole(member)
                        .accounts({
                            // @ts-ignore
                            config: configPda,
                            admin: nonAdmin.publicKey,
                            rentPayer: testBase.txPayer.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                        .signers([nonAdmin, testBase.txPayer])
                        .rpc();
                    expect.fail("Should have thrown an error for non-admin");
                } catch (error) {
                    expect(error.toString()).to.include("NotAdmin");
                }
            });
        });

        describe("revoke role", () => {
            it("should revoke role successfully", async () => {
                await testBase.dkimProgram.methods
                    .revokeRole(proposer.publicKey)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin])
                    .rpc();

                const configAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(configPda);
                expect(configAccount.members).to.have.length(3);

                const revokedMember = configAccount.members.find(m =>
                    m.key.toBase58() === proposer.publicKey.toBase58()
                );
                expect(revokedMember).to.be.undefined;

                // add back
                testBase.provider.client.expireBlockhash();
                const member = {
                    key: proposer.publicKey,
                    permissions: { mask: 1 }
                };

                await testBase.dkimProgram.methods
                    .grantRole(member)
                    .accounts({
                        // @ts-ignore
                        config: configPda,
                        admin: testBase.admin.publicKey,
                        rentPayer: testBase.txPayer.publicKey,
                        systemProgram: anchor.web3.SystemProgram.programId,
                    })
                    .signers([testBase.admin, testBase.txPayer])
                    .rpc();
            });

            it("should fail to revoke role for non-member", async () => {
                const nonMember = new anchor.web3.Keypair();

                try {
                    await testBase.dkimProgram.methods
                        .revokeRole(nonMember.publicKey)
                        .accounts({
                            // @ts-ignore
                            config: configPda,
                            admin: testBase.admin.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                        .signers([testBase.admin])
                        .rpc();
                    expect.fail("Should have thrown an error for non-member");
                } catch (error) {
                    expect(error.toString()).to.include("NotAMember");
                }
            });

            it("should fail when non-admin tries to revoke role", async () => {
                try {
                    await testBase.dkimProgram.methods
                        .revokeRole(executor.publicKey)
                        .accounts({
                            // @ts-ignore
                            config: configPda,
                            admin: nonAdmin.publicKey,
                            systemProgram: anchor.web3.SystemProgram.programId,
                        })
                        .signers([nonAdmin])
                        .rpc();
                    expect.fail("Should have thrown an error for non-admin");
                } catch (error) {
                    expect(error.toString()).to.include("NotAdmin");
                }
            });
        });
    });

    describe("create add proposal and execute add", () => {
        const domainHash = Array(32).fill(1);
        const keyHash = Array(32).fill(2);


        it("should propose", async () => {
            const proposalPda = getDkimProposalAccount(Buffer.from("add"), Buffer.from(domainHash), Buffer.from(keyHash));
            // create a new proposal
            await testBase.dkimProgram.methods
                .propose(
                    {
                        proposalType: { add: {} },
                        domainHash,
                        keyHash,
                    }
                )
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    member: proposer.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([proposer, testBase.txPayer])
                .rpc();

            // send the proposal
            const dkimProposalAccount = await testBase.dkimProgram.account.dkimProposal.fetch(proposalPda);
            expect(dkimProposalAccount.proposalType.add).to.exist;
            expect(dkimProposalAccount.domainHash).to.deep.equal(domainHash);
            expect(dkimProposalAccount.keyHash).to.deep.equal(keyHash);
        });

        it("should execute add", async () => {
            // change time
            const timeNow = testBase.provider.client.getClock();
            timeNow.unixTimestamp = timeNow.unixTimestamp + BigInt(testBase.oracleTimelock);
            testBase.provider.client.setClock(timeNow);

            const proposalPda = getDkimProposalAccount(Buffer.from("add"), Buffer.from(domainHash), Buffer.from(keyHash));
            const dkimEntryPda = getDkimEntryAccount(Buffer.from(domainHash), Buffer.from(keyHash));
            await testBase.dkimProgram.methods
                .executeAdd()
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    dkimEntry: dkimEntryPda,
                    member: executor.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([executor, testBase.txPayer])
                .rpc();
            expect(testBase.provider.client.getAccount(dkimEntryPda).owner).to.deep.equal(testBase.dkimProgram.programId);
        });
    });

    describe("create remove proposal and execute remove", () => {
        const domainHash = Array(32).fill(1);
        const keyHash = Array(32).fill(2);

        it("should propose", async () => {
            const proposalPda = getDkimProposalAccount(Buffer.from("remove"), Buffer.from(domainHash), Buffer.from(keyHash));
            // create a new proposal
            await testBase.dkimProgram.methods
                .propose(
                    {
                        proposalType: { remove: {} },
                        domainHash,
                        keyHash,
                    }
                )
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    member: proposer.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([proposer, testBase.txPayer])
                .rpc();
            const dkimProposalAccount = await testBase.dkimProgram.account.dkimProposal.fetch(proposalPda);
            expect(dkimProposalAccount.proposalType.remove).to.exist;
            expect(dkimProposalAccount.domainHash).to.deep.equal(domainHash);
            expect(dkimProposalAccount.keyHash).to.deep.equal(keyHash);
        });

        it("should execute delete", async () => {
            // change time
            const timeNow = testBase.provider.client.getClock();
            timeNow.unixTimestamp = timeNow.unixTimestamp + BigInt(testBase.oracleTimelock);
            testBase.provider.client.setClock(timeNow);

            const proposalPda = getDkimProposalAccount(Buffer.from("remove"), Buffer.from(domainHash), Buffer.from(keyHash));
            const dkimEntryPda = getDkimEntryAccount(Buffer.from(domainHash), Buffer.from(keyHash));
            await testBase.dkimProgram.methods
                .executeDelete()
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    dkimEntry: dkimEntryPda,
                    member: executor.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([executor, testBase.txPayer])
                .rpc();
            try {
                await testBase.dkimProgram.account.dkimEntry.fetch(dkimEntryPda);
            } catch (error) {
                expect(error).to.exist;
            }
            expect(testBase.provider.client.getAccount(dkimEntryPda).owner).to.deep.equal(anchor.web3.SystemProgram.programId);
        });
    });

    describe("create proposal and cancel", () => {
        const domainHash = Array(32).fill(1);
        const keyHash = Array(32).fill(2);

        it("should propose", async () => {
            // change blockhash or slot
            testBase.provider.client.expireBlockhash();

            const proposalPda = getDkimProposalAccount(Buffer.from("add"), Buffer.from(domainHash), Buffer.from(keyHash));
            // create a new proposal
            await testBase.dkimProgram.methods
                .propose(
                    {
                        proposalType: { add: {} },
                        domainHash,
                        keyHash,
                    }
                )
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    member: proposer.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([proposer, testBase.txPayer])
                .rpc();
            const dkimProposalAccount = await testBase.dkimProgram.account.dkimProposal.fetch(proposalPda);
            expect(dkimProposalAccount.proposalType.add).to.exist;

            // cancel the proposal
            await testBase.dkimProgram.methods
                .cancelProposal()
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    member: canceller.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([canceller, testBase.txPayer])
                .rpc();
            try {
                await testBase.dkimProgram.account.dkimProposal.fetch(proposalPda);
            } catch (error) {
                expect(error).to.exist;
            }

        });

        it("should be able to recreate proposal", async () => {
            // change blockhash or slot
            testBase.provider.client.expireBlockhash();
            const proposalPda = getDkimProposalAccount(Buffer.from("add"), Buffer.from(domainHash), Buffer.from(keyHash));
            // create a new proposal
            await testBase.dkimProgram.methods
                .propose(
                    {
                        proposalType: { add: {} },
                        domainHash,
                        keyHash,
                    }
                )
                .accounts({
                    // @ts-ignore
                    proposal: proposalPda,
                    member: proposer.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([proposer, testBase.txPayer])
                .rpc();
            const dkimProposalAccount = await testBase.dkimProgram.account.dkimProposal.fetch(proposalPda);
            expect(dkimProposalAccount.proposalType.add).to.exist;
        });
    });

    describe("change admin", () => {
        it("should change admin", async () => {
            const newAdmin = new anchor.web3.Keypair();
            await testBase.dkimProgram.methods
                .changeAdmin(newAdmin.publicKey)
                .accounts({
                    // @ts-ignore
                    admin: testBase.admin.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([testBase.admin, testBase.txPayer])
                .rpc();
            const dkimConfigAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(getDkimOracleConfigAccount());
            expect(dkimConfigAccount.admin.toBase58()).to.equal(newAdmin.publicKey.toBase58());

            // change back to original admin
            await testBase.dkimProgram.methods
                .changeAdmin(testBase.admin.publicKey)
                .accounts({
                    // @ts-ignore
                    admin: newAdmin.publicKey,
                    rentPayer: testBase.txPayer.publicKey,
                })
                .signers([newAdmin, testBase.txPayer])
                .rpc();
        });
    });

    describe("revoke admin", () => {
        it("should revoke admin successfully", async () => {
            // Check admin before revocation
            let dkimConfigAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(getDkimOracleConfigAccount());
            expect(dkimConfigAccount.admin.toBase58()).to.equal(testBase.admin.publicKey.toBase58());

            // Revoke admin
            await testBase.dkimProgram.methods
                .revokeAdmin()
                .accounts({
                    // @ts-ignore
                    admin: testBase.admin.publicKey,
                })
                .signers([testBase.admin])
                .rpc();

            // Check admin after revocation - should be default (zero) pubkey
            dkimConfigAccount = await testBase.dkimProgram.account.dkimOracleConfig.fetch(getDkimOracleConfigAccount());
            expect(dkimConfigAccount.admin.toBase58()).to.equal(anchor.web3.PublicKey.default.toBase58());
        });
    });
});