#!/usr/bin/env tsx

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import dotenv from "dotenv";
import { BaseSmartAccountHelper } from "./base_smart_account_helper";
import {
  BSOL_MINT,
  JITOSOL_MINT,
  RAY_MINT,
  USDC_MINT,
  WSOL_MINT,
} from "../../../tests/utils/consts";
import {
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createRaydiumWsolUsdcCpmmInstruction,
  createRaydiumWsolUsdcRayCpmmInstruction,
} from "./okx_dex_instructions";

dotenv.config();

const DEFAULT_SWAP_AMOUNT = 100; // 1 token (6 decimals)

const BSOL_WSOL_LUT: PublicKey[] = [
  new PublicKey("4jgg9CHLiTeQUwSDK9srby9Vp1NhDGqpdacWvUASGUwY"),
  new PublicKey("LFMjku5eEixYqisD1c5WrpV5GdAgRoLm1xmgvsVAmBg"),
];

async function raydiumSwap() {
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  const executor = new BaseSmartAccountHelper(saId);

  // //WSOL-RAY
  // const sourceTokenAccount = getAssociatedTokenAddressSync(
  //   WSOL_MINT,
  //   executor.smartAccountHelper.vault,
  //   true, // allowOwnerOffCurve for PDA
  //   TOKEN_PROGRAM_ID
  // );
  // const destinationTokenAccount = getAssociatedTokenAddressSync(
  //   RAY_MINT,
  //   executor.smartAccountHelper.vault,
  //   true, // allowOwnerOffCurve for PDA
  //   TOKEN_PROGRAM_ID
  // );
  // const depositInstruction = await createRaydiumWsolUsdcRayCpmmInstruction(
  //   executor.provider,
  //   new BN(DEFAULT_SWAP_AMOUNT),
  //   executor.smartAccountHelper.vault,
  //   sourceTokenAccount,
  //   destinationTokenAccount
  // );
  // const result = await executor.execute(
  //   [depositInstruction],
  //   "okxdex-raydium-swap",
  //   BSOL_WSOL_LUT
  // );

  //WSOL-USDC
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    WSOL_MINT,
    executor.smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    USDC_MINT,
    executor.smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );

  const swapInstruction = await createRaydiumWsolUsdcCpmmInstruction(
    executor.provider,
    new BN(DEFAULT_SWAP_AMOUNT),
    executor.smartAccountHelper.vault,
    sourceTokenAccount,
    destinationTokenAccount
  );

  const result = await executor.execute(
    [swapInstruction],
    "okxdex-raydium-swap",
    BSOL_WSOL_LUT
  );

  return result;
}

async function main() {
  try {
    await raydiumSwap();
  } catch (error: any) {
    console.error(`Error:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
