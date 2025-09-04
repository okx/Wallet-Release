#!/usr/bin/env tsx

import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  createSyncNativeInstruction,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from "@solana/web3.js";
import { Marginfi } from "./protocol-interfaces/marginfi_types";

const marginfiIdl = require("./protocol-interfaces/marginfi_idl.json");

// Default MarginFi addresses for WSOL
const GROUP = new PublicKey("4qp6Fx6tnZkY5Wropq9wUYgtFxXKwE6viZxFHg3rdAG8");
const MARGINFI_ACCOUNT = new PublicKey(
  "7bJQLA6c1zqffbn7MNYQEdwyusnafgr4WMPE8RJt9WZM"
);
const DEFAULT_WSOL_BANK = new PublicKey(
  "CCKtUs6Cgwo4aaQUmBPmyoApH2gUDErxNZCAntD6LYGh"
);
const DEFAULT_WSOL_LIQUIDITY_VAULT = new PublicKey(
  "2eicbpitfJXDwqCuFAmPgDP7t2oUotnAzbGzRKLMgSLe"
);

const DEFAULT_JITOSOL_BANK = new PublicKey(
  "Bohoc1ikHLD7xKJuzTyiTyCwzaL5N7ggJQu75A8mKYM8"
);
const DEFAULT_JITOSOL_LIQUIDITY_VAULT = new PublicKey(
  "38VGtXd2pDPq9FMh1z6AVjcHCoHgvWyMhdNyamDTeeks"
);

/**
 * Create a MarginFi deposit instruction
 */
export async function createMarginfiDepositInstruction(
  provider: anchor.AnchorProvider,
  params: {
    amount: number;
    autoCompound: boolean;
    group: PublicKey;
    marginfiAccount: PublicKey;
    authority: PublicKey;
    bank: PublicKey;
    signerTokenAccount: PublicKey;
    liquidityVault: PublicKey;
    tokenProgram: PublicKey;
  }
): Promise<TransactionInstruction> {
  const marginfiProgram = new anchor.Program<Marginfi>(marginfiIdl, provider);

  return await marginfiProgram.methods
    .lendingAccountDeposit(new BN(params.amount), params.autoCompound)
    .accountsPartial({
      group: params.group,
      marginfiAccount: params.marginfiAccount,
      authority: params.authority,
      bank: params.bank,
      signerTokenAccount: params.signerTokenAccount,
      liquidityVault: params.liquidityVault,
      tokenProgram: params.tokenProgram,
    })
    .preInstructions([createSyncNativeInstruction(params.signerTokenAccount)])
    .instruction();
}

/**
 * Create a MarginFi withdraw instruction
 */
export async function createMarginfiWithdrawInstruction(
  provider: anchor.AnchorProvider,
  params: {
    amount: number;
    group: PublicKey;
    marginfiAccount: PublicKey;
    authority: PublicKey;
    bank: PublicKey;
    destinationTokenAccount: PublicKey;
    liquidityVault: PublicKey;
  }
): Promise<TransactionInstruction> {
  const marginfiProgram = new anchor.Program<Marginfi>(marginfiIdl, provider);

  return await marginfiProgram.methods
    .lendingAccountWithdraw(new BN(params.amount), true)
    .accountsPartial({
      group: params.group,
      marginfiAccount: params.marginfiAccount,
      authority: params.authority,
      bank: params.bank,
      destinationTokenAccount: params.destinationTokenAccount,
      liquidityVault: params.liquidityVault,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function initializeMarginfiAccount(
  provider: anchor.AnchorProvider,
  params: {
    group: PublicKey;
    marginfiAccount: PublicKey;
    authority: PublicKey;
  }
): Promise<TransactionInstruction> {
  const marginfiProgram = new anchor.Program<Marginfi>(marginfiIdl, provider);
  return await marginfiProgram.methods
    .marginfiAccountInitialize()
    .accountsPartial({
      marginfiGroup: params.group,
      marginfiAccount: params.marginfiAccount,
      authority: params.authority,
      feePayer: params.authority,
      systemProgram: SystemProgram.programId,
    })
    .instruction();
}

export async function createMarginfiInitializeInstruction(
  provider: anchor.AnchorProvider,
  authority: PublicKey
): Promise<TransactionInstruction> {
  return initializeMarginfiAccount(provider, {
    group: GROUP,
    marginfiAccount: MARGINFI_ACCOUNT,
    authority,
  });
}

/**
 * Helper function to create WSOL deposit instruction with default addresses
 */
export async function createWsolDepositInstruction(
  provider: anchor.AnchorProvider,
  amount: number,
  authority: PublicKey,
  signerTokenAccount: PublicKey,
  autoCompound: boolean = true
): Promise<TransactionInstruction> {
  return createMarginfiDepositInstruction(provider, {
    amount,
    autoCompound,
    group: GROUP,
    marginfiAccount: MARGINFI_ACCOUNT,
    authority,
    bank: DEFAULT_WSOL_BANK,
    signerTokenAccount,
    liquidityVault: DEFAULT_WSOL_LIQUIDITY_VAULT,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function createJitosolDepositInstruction(
  provider: anchor.AnchorProvider,
  amount: number,
  authority: PublicKey,
  signerTokenAccount: PublicKey,
  autoCompound: boolean = true
): Promise<TransactionInstruction> {
  return createMarginfiDepositInstruction(provider, {
    amount,
    autoCompound,
    group: GROUP,
    marginfiAccount: MARGINFI_ACCOUNT,
    authority,
    bank: DEFAULT_JITOSOL_BANK,
    signerTokenAccount,
    liquidityVault: DEFAULT_JITOSOL_LIQUIDITY_VAULT,
    tokenProgram: TOKEN_PROGRAM_ID,
  });
}

export async function createJitosolWithdrawInstruction(
  provider: anchor.AnchorProvider,
  amount: number,
  authority: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  return createMarginfiWithdrawInstruction(provider, {
    amount,
    group: GROUP,
    marginfiAccount: MARGINFI_ACCOUNT,
    authority,
    bank: DEFAULT_JITOSOL_BANK,
    destinationTokenAccount,
    liquidityVault: DEFAULT_JITOSOL_LIQUIDITY_VAULT,
  });
}

/**
 * Helper function to create WSOL withdraw instruction with default addresses
 */
export async function createWsolWithdrawInstruction(
  provider: anchor.AnchorProvider,
  amount: number,
  authority: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  return createMarginfiWithdrawInstruction(provider, {
    amount,
    group: GROUP,
    marginfiAccount: MARGINFI_ACCOUNT,
    authority,
    bank: DEFAULT_WSOL_BANK,
    destinationTokenAccount,
    liquidityVault: DEFAULT_WSOL_LIQUIDITY_VAULT,
  });
}
