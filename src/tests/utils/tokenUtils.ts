import * as anchor from "@coral-xyz/anchor";
import {
  createMint,
  mintTo,
  getAccount,
  TOKEN_PROGRAM_ID,
  createTransferInstruction,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import {
  PublicKey,
  Keypair,
  Connection,
  Transaction,
  sendAndConfirmTransaction,
  TransactionInstruction,
} from "@solana/web3.js";

export class TokenUtils {
  /**
   * Create a new SPL token mint
   */
  static async createTestToken(
    connection: Connection,
    payer: Keypair,
    decimals: number = 6
  ): Promise<PublicKey> {
    return await createMint(connection, payer, payer.publicKey, null, decimals);
  }

  /**
   * Create associated token account for a mint and owner
   */
  static async createTokenAccount(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve: boolean = false
  ): Promise<PublicKey> {
    const tokenAccount = getAssociatedTokenAddressSync(
      mint,
      owner,
      allowOwnerOffCurve,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const transaction = new Transaction().add(
      createAssociatedTokenAccountInstruction(
        payer.publicKey,
        tokenAccount,
        owner,
        mint,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );

    await sendAndConfirmTransaction(connection, transaction, [payer]);
    return tokenAccount;
  }

  /**
   * Mint tokens to a token account
   */
  static async mintTokens(
    connection: Connection,
    payer: Keypair,
    mint: PublicKey,
    destination: PublicKey,
    amount: number
  ): Promise<void> {
    await mintTo(connection, payer, mint, destination, payer, amount);
  }

  /**
   * Create instructions for batch token operations (account creation + transfer)
   */
  static createBatchTokenInstructions(
    mint: PublicKey,
    sourceTokenAccount: PublicKey,
    sourceAuthority: PublicKey,
    recipients: Keypair[],
    transferAmount: number
  ): TransactionInstruction[] {
    const instructions: TransactionInstruction[] = [];

    for (const recipient of recipients) {
      // Get associated token account address
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mint,
        recipient.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // 1. Create associated token account (idempotent)
      const createAccountIx = createAssociatedTokenAccountIdempotentInstruction(
        sourceAuthority, // payer
        recipientTokenAccount,
        recipient.publicKey, // owner
        mint
      );
      instructions.push(createAccountIx);

      // 2. Transfer tokens
      const transferIx = createTransferInstruction(
        sourceTokenAccount,
        recipientTokenAccount,
        sourceAuthority,
        transferAmount
      );
      instructions.push(transferIx);
    }

    return instructions;
  }

  /**
   * Verify token account balances
   */
  static async verifyTokenBalances(
    connection: Connection,
    mint: PublicKey,
    recipients: Keypair[],
    expectedAmount: number
  ): Promise<boolean> {
    for (const recipient of recipients) {
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mint,
        recipient.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      const accountInfo = await getAccount(connection, recipientTokenAccount);

      if (Number(accountInfo.amount) !== expectedAmount) {
        console.error(
          `Balance mismatch for ${recipient.publicKey.toString()}: expected ${expectedAmount}, got ${Number(
            accountInfo.amount
          )}`
        );
        return false;
      }

      if (accountInfo.owner.toString() !== recipient.publicKey.toString()) {
        console.error(`Owner mismatch for ${recipient.publicKey.toString()}`);
        return false;
      }

      if (accountInfo.mint.toString() !== mint.toString()) {
        console.error(`Mint mismatch for ${recipient.publicKey.toString()}`);
        return false;
      }
    }

    return true;
  }

  /**
   * Generate test recipients
   */
  static generateRecipients(count: number): Keypair[] {
    const recipients: Keypair[] = [];
    for (let i = 0; i < count; i++) {
      recipients.push(Keypair.generate());
    }
    return recipients;
  }

  /**
   * Get remaining accounts for token operations
   * Format: [programId, ...accounts] for each instruction
   */
  static getRemainingAccountsForTokenOps(
    mint: PublicKey,
    sourceTokenAccount: PublicKey,
    sourceAuthority: PublicKey,
    recipients: Keypair[]
  ): anchor.web3.AccountMeta[] {
    const remainingAccounts: anchor.web3.AccountMeta[] = [];

    for (const recipient of recipients) {
      const recipientTokenAccount = getAssociatedTokenAddressSync(
        mint,
        recipient.publicKey,
        false,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );

      // Instruction 1: Create Associated Token Account
      // Program ID first
      remainingAccounts.push({
        pubkey: ASSOCIATED_TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      });

      // Then the accounts for this instruction
      remainingAccounts.push(
        { pubkey: sourceAuthority, isSigner: false, isWritable: true }, // payer
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // account to create
        { pubkey: recipient.publicKey, isSigner: false, isWritable: false }, // owner
        { pubkey: mint, isSigner: false, isWritable: false }, // mint
        {
          pubkey: anchor.web3.SystemProgram.programId,
          isSigner: false,
          isWritable: false,
        },
        { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
      );

      // Instruction 2: Transfer tokens
      // Program ID first
      remainingAccounts.push({
        pubkey: TOKEN_PROGRAM_ID,
        isSigner: false,
        isWritable: false,
      });

      // Then the accounts for this instruction
      remainingAccounts.push(
        { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // source
        { pubkey: recipientTokenAccount, isSigner: false, isWritable: true }, // destination
        { pubkey: sourceAuthority, isSigner: false, isWritable: false } // authority
      );
    }

    return remainingAccounts;
  }
}

export default TokenUtils;
