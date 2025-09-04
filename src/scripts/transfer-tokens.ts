#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import {
  createTransferInstruction,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { PublicKey, Keypair, Transaction } from "@solana/web3.js";
import { loadEnv } from "../helpers/setup";
import { loadKeyFromEnv, displayKeyInfo } from "../helpers/key-loader";
import { InstructionLogger } from "../helpers/instruction-logger";
import { SmartAccountHelper } from "../tests/utils/smartAccount/helpers";
import {
  deriveWebAuthnTableAddress,
  generateIdFromString,
} from "../tests/utils/helpers";
import { createSecp256r1Instruction } from "../tests/utils/r1-utils";
import { simulateBatchExecution } from "./utils";
import dotenv from "dotenv";
import { WebAuthnAuthDataHelpers } from "../tests/utils/webauthn";
import { WebAuthnStringHelpers } from "../tests/utils/webauthn";
import {
  LAMPORTS_PER_SIGNER,
  WEB_AUTHN_TABLE_SEED,
} from "../tests/utils/consts";

// Load environment variables
dotenv.config();

// Configuration constants
const DEFAULT_TRANSFER_AMOUNT = 1_000_000; // 1 token (6 decimals)
const USE_COMPUTE_BUDGET_OPTIMIZATION =
  process.env.USE_COMPUTE_BUDGET_OPTIMIZATION !== "false";

/**
 * Transfer tokens using smart account vault with automatic optimization
 */
async function transferTokens() {
  // 1. Load required environment variables

  const saId = process.env.SA_ID;
  const testTokenMint = process.env.TEST_TOKEN_MINT;
  const recipientAddress = process.env.RECIPIENT_ADDRESS;
  const transferAmount = process.env.TRANSFER_AMOUNT
    ? parseInt(process.env.TRANSFER_AMOUNT)
    : DEFAULT_TRANSFER_AMOUNT;

  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }
  if (!testTokenMint) {
    throw new Error("TEST_TOKEN_MINT environment variable is required");
  }
  if (!recipientAddress) {
    throw new Error("RECIPIENT_ADDRESS environment variable is required");
  }

  // 2. Setup programs and provider
  const { saProgram, vaultProgram } = loadEnv();
  const provider = anchor.getProvider() as anchor.AnchorProvider;

  // 3. Load keys
  const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
  const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");
  const payerInfo = loadKeyFromEnv("WALLET_SECRET_KEY");

  if (r1KeyInfo.type !== "r1") {
    throw new Error("Expected R1 key type for TEST_R1_PRIVATE_KEY");
  }
  if (mandatorySignerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MANDATORY_SIGNER_SECRET_KEY");
  }
  if (payerInfo.type !== "solana") {
    throw new Error("Expected Solana key type for WALLET_SECRET_KEY");
  }

  console.log(`Smart Account ID: ${saId}`);

  let [webauthnTable] = deriveWebAuthnTableAddress(0);

  // 4. Create smart account helper
  const id = Buffer.from(saId, "hex");
  const smartAccountHelper = SmartAccountHelper.createWithEnvKeys(
    Buffer.from(id),
    saProgram,
    r1KeyInfo.keyObject,
    mandatorySignerInfo.keyObject
  );

  console.log(`📍 Smart Account: ${smartAccountHelper.sa.toBase58()}`);
  console.log(`🏦 Smart Account Vault: ${smartAccountHelper.vault.toBase58()}`);

  // 5. Setup token accounts
  const tokenMintPubkey = new PublicKey(testTokenMint);
  const recipientPubkey = new PublicKey(recipientAddress);

  // Source: vault's token account
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    tokenMintPubkey,
    smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );

  // Destination: recipient's token account
  const recipientTokenAccount = getAssociatedTokenAddressSync(
    tokenMintPubkey,
    recipientPubkey,
    false, // standard account
    TOKEN_PROGRAM_ID
  );

  console.log(`🔄 Source Token Account: ${vaultTokenAccount.toBase58()}`);
  console.log(
    `🎯 Recipient Token Account: ${recipientTokenAccount.toBase58()}`
  );

  // 6. Get initial balances
  let initialVaultBalance: bigint = BigInt(0);
  let initialRecipientBalance: bigint = BigInt(0);

  try {
    const vaultAccount =
      await provider.connection.getTokenAccountBalance(vaultTokenAccount);
    initialVaultBalance = BigInt(vaultAccount.value.amount);
  } catch (error) {
    console.log("   ℹ️ Vault token account not found - balance is 0");
  }

  try {
    const recipientAccount = await provider.connection.getTokenAccountBalance(
      recipientTokenAccount
    );
    initialRecipientBalance = BigInt(recipientAccount.value.amount);
  } catch (error) {
    console.log("   ℹ️ Recipient token account not found - will be created");
  }

  console.log(`💳 Initial Vault Balance: ${initialVaultBalance.toString()}`);
  console.log(
    `💳 Initial Recipient Balance: ${initialRecipientBalance.toString()}`
  );

  // 7. Verify vault has sufficient balance
  if (initialVaultBalance < BigInt(transferAmount)) {
    throw new Error(
      `Insufficient vault balance: has ${initialVaultBalance}, needs ${transferAmount}`
    );
  }

  // 8. Create token transfer transaction
  const tokenTransferTx = new Transaction();

  // Create ATA for recipient (idempotent - won't fail if already exists)
  const createAtaIx = createAssociatedTokenAccountIdempotentInstruction(
    smartAccountHelper.vault, // payer (vault pays for account creation)
    recipientTokenAccount,
    recipientPubkey, // owner
    tokenMintPubkey,
    TOKEN_PROGRAM_ID
  );
  tokenTransferTx.add(createAtaIx);

  // Transfer tokens
  const transferIx = createTransferInstruction(
    vaultTokenAccount, // source
    recipientTokenAccount, // destination
    smartAccountHelper.vault, // authority
    transferAmount,
    [],
    TOKEN_PROGRAM_ID
  );
  tokenTransferTx.add(transferIx);

  // 9. Simulate and optimize (if enabled)
  let optimization;
  if (USE_COMPUTE_BUDGET_OPTIMIZATION) {
    optimization = await simulateBatchExecution(
      saProgram,
      vaultProgram,
      provider,
      smartAccountHelper,
      tokenTransferTx,
      true // use compute budget
    );
  }

  // 10. Create compute budget instructions if optimization is available
  let computeBudgetInstructions: anchor.web3.TransactionInstruction[] = [];
  if (optimization) {
    const computeBudgetIx =
      anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({
        units: optimization.optimalComputeUnits,
      });
    const computePriceIx = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice(
      {
        microLamports: 1000,
      }
    );
    computeBudgetInstructions = [computeBudgetIx, computePriceIx];
  }

  const executionFee = 3 * LAMPORTS_PER_SIGNER;

  // 11. Prepare user intent (including compute budget instructions in signature hash)
  const {
    serializedIntent,
    deconstructedInstructions,
    remainingAccounts,
    numSigners,
  } = await smartAccountHelper.prepareUserIntent(tokenTransferTx, {
    tokenAmount: executionFee,
  });

  // 12. Sign intent with R1 key (now includes compute budget instructions in hash)
  const [message, signature, authData] = smartAccountHelper.signIntent(
    Uint8Array.from(serializedIntent)
  );

  console.log("Executing token transfer...");

  try {
    // Use the same compute budget instructions that were included in the signature
    const preInstructions: anchor.web3.TransactionInstruction[] = [
      ...computeBudgetInstructions,
    ];

    const executeTx = await saProgram.methods
      .validateExecution(
        {
          clientDataJson: WebAuthnStringHelpers.Index([0, 0]),
          authData: WebAuthnAuthDataHelpers.Index(0),
        } as any,
        new anchor.BN(executionFee),
        null
      )
      .accountsPartial({
        txPayer: payerInfo.keyObject.publicKey,
        solanaSigner: null, // not used in cedefi or easy wallet
        smartAccount: smartAccountHelper.sa,
        sysvarInstructions: anchor.web3.SYSVAR_INSTRUCTIONS_PUBKEY,
        vaultProgram: vaultProgram.programId,
        vaultState: smartAccountHelper.vaultState,
        smartAccountVault: smartAccountHelper.vault,
        systemProgram: anchor.web3.SystemProgram.programId,
        webauthnTable: webauthnTable,
        vaultTokenAccount: null,
        tokenMint: null,
        destinationTokenAccount: null,
        tokenProgram: null,
      })
      .preInstructions(preInstructions)
      .postInstructions([
        createSecp256r1Instruction(
          message,
          smartAccountHelper.getPasskeyPubkey(),
          signature
        ),
        await vaultProgram.methods
          .executeBatch({
            deconstructedInstructions,
          })
          .accounts({
            vaultState: smartAccountHelper.vaultState,
            smartAccountVault: smartAccountHelper.vault,
          })
          .remainingAccounts(remainingAccounts)
          .instruction(),
      ])
      .signers([payerInfo.keyObject])
      .transaction();

    // Set recent blockhash for serialization
    executeTx.recentBlockhash = (
      await provider.connection.getLatestBlockhash()
    ).blockhash;
    executeTx.feePayer = payerInfo.keyObject.publicKey;
    // Sign the transaction before serializing for size measurement
    executeTx.sign(payerInfo.keyObject);

    // Log instruction details for debugging and documentation
    InstructionLogger.logValidateExecution(
      {
        origin: smartAccountHelper.ORIGIN,
        android_package_name: smartAccountHelper.ANDROID_PACKAGE_NAME,
        auth_data: Array.from(authData),
      },
      {
        message: message,
        pubkey: smartAccountHelper.getPasskeyPubkey(),
        signature: signature,
      },
      false // don't export JSON during normal execution
    );

    // Log complete transaction data for backend team
    InstructionLogger.logTransaction(
      "VALIDATE_EXECUTION_TOKEN_TRANSFER",
      {
        transaction: executeTx,
        instructionArgs: {
          signer_index: 0,
          operation: "token_transfer",
          token_mint: testTokenMint,
          amount: transferAmount,
          source_account: vaultTokenAccount.toBase58(),
          destination_account: recipientTokenAccount.toBase58(),
          vault_execute_batch: {
            deconstructed_instructions: deconstructedInstructions,
            remaining_accounts: remainingAccounts.map((account) => ({
              address: account.pubkey.toBase58(),
              isSigner: account.isSigner,
              isWritable: account.isWritable,
            })),
            num_signers: numSigners,
            vault_state: smartAccountHelper.vaultState.toBase58(),
            smart_account_vault: smartAccountHelper.vault.toBase58(),
          },
        },
        webauthnArgs: {
          origin: smartAccountHelper.ORIGIN,
          android_package_name: smartAccountHelper.ANDROID_PACKAGE_NAME,
          auth_data: Array.from(authData),
        },
        r1SignatureArgs: {
          message: message,
          pubkey: smartAccountHelper.getPasskeyPubkey(),
          signature: signature,
        },
        accounts: {
          txPayer: {
            address: payerInfo.keyObject.publicKey.toBase58(),
            isSigner: true,
            isWritable: true,
            description: "Transaction fee payer",
          },
          mandatorySigner: {
            address: mandatorySignerInfo.keyObject.publicKey.toBase58(),
            isSigner: true,
            isWritable: false,
            description: "Mandatory signer for smart account",
          },
          smartAccount: {
            address: smartAccountHelper.sa.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "Smart account PDA",
          },
          vaultProgram: {
            address: vaultProgram.programId.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "Vault program",
          },
          vaultState: {
            address: smartAccountHelper.vaultState.toBase58(),
            isSigner: false,
            isWritable: false,
            description: "Vault state account",
          },
          smartAccountVault: {
            address: smartAccountHelper.vault.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Smart account vault PDA",
          },
          tokenMint: {
            address: testTokenMint,
            isSigner: false,
            isWritable: false,
            description: "SPL token mint",
          },
          vaultTokenAccount: {
            address: vaultTokenAccount.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Vault's token account (source)",
          },
          recipientTokenAccount: {
            address: recipientTokenAccount.toBase58(),
            isSigner: false,
            isWritable: true,
            description: "Recipient's token account (destination)",
          },
        },
        signers: [
          {
            name: "Transaction Payer",
            publicKey: payerInfo.keyObject.publicKey.toBase58(),
          },
          {
            name: "Mandatory Signer",
            publicKey: mandatorySignerInfo.keyObject.publicKey.toBase58(),
          },
        ],
        preInstructions: [
          ...(optimization
            ? [
                {
                  name: "ComputeBudgetProgram.setComputeUnitLimit",
                  data: {
                    units: optimization.optimalComputeUnits,
                  },
                },
                {
                  name: "ComputeBudgetProgram.setComputeUnitPrice",
                  data: {
                    microLamports: 1000,
                  },
                },
              ]
            : []),
        ],
        metadata: {
          recentBlockhash: executeTx.recentBlockhash,
          feePayer: payerInfo.keyObject.publicKey.toBase58(),
          computeUnits: optimization?.optimalComputeUnits,
          priorityFee: optimization ? 1000 : undefined,
        },
      },
      true // export JSON for debugging
    );

    // Log transaction size
    const serializedTx = executeTx.serialize({
      requireAllSignatures: true,
      verifySignatures: true,
    });
    console.log(`📏 Final transaction size: ${serializedTx.length} bytes`);

    // Execute the transaction using raw connection (already signed)
    const txSignature = await provider.connection.sendRawTransaction(
      serializedTx,
      {
        skipPreflight: false,
        preflightCommitment: "processed",
      }
    );

    console.log(`✅ Transaction sent: ${txSignature}`);

    // Wait for confirmation
    await provider.connection.confirmTransaction(txSignature, "confirmed");

    // 13. Verify final balances
    console.log("\n💳 Final Balances:");

    // Get and display vault balance
    try {
      const vaultAccount =
        await provider.connection.getTokenAccountBalance(vaultTokenAccount);
      console.log(`   Vault: ${BigInt(vaultAccount.value.amount)} tokens`);
    } catch (error) {
      console.log(`   Vault: Error fetching balance`);
    }

    // Get and display recipient balance
    try {
      const recipientAccount = await provider.connection.getTokenAccountBalance(
        recipientTokenAccount
      );
      console.log(
        `   Recipient: ${BigInt(recipientAccount.value.amount)} tokens`
      );
    } catch (error) {
      console.log(`   Recipient: Error fetching balance`);
    }

    return {
      txSignature,
      optimization,
      initialVaultBalance: initialVaultBalance.toString(),
      initialRecipientBalance: initialRecipientBalance.toString(),
    };
  } catch (error) {
    console.error("Transaction execution failed:");
    console.error("Error details:", error);

    // Try to parse Anchor errors
    if (error.logs) {
      console.error("Transaction logs:");
      error.logs.forEach((log: string, index: number) => {
        console.error(`  ${index}: ${log}`);
      });
    }

    // Re-throw to be caught by main error handler
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await transferTokens();
    console.log("\n🎊 Success! Token transfer completed with optimization.");
  } catch (error: any) {
    console.error(`❌ Error transferring tokens:`, error.message);
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
