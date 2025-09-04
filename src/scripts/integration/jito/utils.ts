import * as anchor from "@coral-xyz/anchor";

/**
 * Convert transactions to base64 format required by Jito's API
 *
 * This function handles both versioned and legacy transactions, converting
 * them to the base64-encoded format that Jito's block engine expects.
 *
 * @param tx - Transaction to convert (VersionedTransaction or legacy Transaction)
 * @returns Base64-encoded string representation of the transaction
 *
 * @example
 * ```typescript
 * const base64Tx = convertToBase64(versionedTransaction);
 * const bundle = [[base64Tx, { encoding: "base64" }]];
 * ```
 */
export function convertToBase64(
  tx: anchor.web3.VersionedTransaction | anchor.web3.Transaction
): string {
  return Buffer.from(tx.serialize()).toString("base64");
}

/**
 * Build a versioned transaction for Jito bundle execution
 *
 * This function creates a versioned transaction that can include
 * address lookup tables for optimized transaction size.
 *
 * @param keypair - Keypair to sign the transaction
 * @param recentBlockhash - Recent blockhash for transaction validity
 * @param instructions - Array of instructions to include in the transaction
 * @param lookupTableAccounts - Optional lookup table accounts for address optimization
 * @returns VersionedTransaction ready for signing and execution
 *
 * @example
 * ```typescript
 * const tx = buildVersionedTransaction(
 *   wallet,
 *   blockhash,
 *   [transferInstruction],
 *   lookupTables
 * );
 * ```
 */
export function buildVersionedTransaction(
  keypair: anchor.web3.Keypair,
  recentBlockhash: string,
  instructions: anchor.web3.TransactionInstruction[],
  lookupTableAccounts?: anchor.web3.AddressLookupTableAccount[]
): anchor.web3.VersionedTransaction {
  const messageV0 = new anchor.web3.TransactionMessage({
    payerKey: keypair.publicKey,
    recentBlockhash: recentBlockhash,
    instructions,
  }).compileToV0Message(lookupTableAccounts);

  const tx = new anchor.web3.VersionedTransaction(messageV0);
  tx.sign([keypair]);

  return tx;
}

/**
 * Build a simple transfer transaction for Jito bundle inclusion
 *
 * This utility creates a basic SOL transfer transaction that can be
 * included in Jito bundles.
 *
 * @param keypair - Keypair to sign and pay for the transfer
 * @param recipient - Public key of the recipient account
 * @param recentBlockhash - Recent blockhash for transaction validity
 * @param amount - Amount of lamports to transfer
 * @returns VersionedTransaction containing the transfer instruction
 *
 * @example
 * ```typescript
 * const transferTx = buildTransferTransaction(
 *   wallet,
 *   recipientAddress,
 *   blockhash,
 *   1_000_000
 * );
 * ```
 */
export function buildTransferTransaction(
  keypair: anchor.web3.Keypair,
  recipient: anchor.web3.PublicKey,
  recentBlockhash: string,
  amount: number
): anchor.web3.VersionedTransaction {
  const ix = anchor.web3.SystemProgram.transfer({
    fromPubkey: keypair.publicKey,
    toPubkey: recipient,
    lamports: amount,
  });

  // Build and return the versioned transaction
  return buildVersionedTransaction(keypair, recentBlockhash, [ix]);
}

/**
 * Build a memo transaction for Jito bundle inclusion
 *
 * This utility creates a memo transaction that can store arbitrary data
 * on the Solana blockchain.
 *
 * @param keypair - Keypair to sign and pay for the memo transaction
 * @param message - String message to store in the memo
 * @param recentBlockhash - Recent blockhash for transaction validity
 * @param programId - Optional custom memo program ID (defaults to official Memo program)
 * @returns VersionedTransaction containing the memo instruction
 *
 * @example
 * ```typescript
 * const memoTx = buildMemoTransaction(
 *   wallet,
 *   "Bundle execution timestamp: " + Date.now(),
 *   blockhash
 * );
 * ```
 */
export function buildMemoTransaction(
  keypair: anchor.web3.Keypair,
  message: string,
  recentBlockhash: string,
  programId: string = "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo"
): anchor.web3.VersionedTransaction {
  const ix = new anchor.web3.TransactionInstruction({
    keys: [
      {
        pubkey: keypair.publicKey,
        isSigner: true, // Keypair must sign the transaction
        isWritable: true, // Account may be modified (for fee payment)
      },
    ],
    programId: new anchor.web3.PublicKey(programId),
    data: Buffer.from(message), // Convert message string to buffer
  });

  return buildVersionedTransaction(keypair, recentBlockhash, [ix]);
}
