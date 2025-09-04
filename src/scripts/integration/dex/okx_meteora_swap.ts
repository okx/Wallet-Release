#!/usr/bin/env tsx

import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import dotenv from "dotenv";
import { BaseSmartAccountHelper } from "./base_smart_account_helper";
import {
  BSOL_MINT,
  JITOSOL_MINT,
  WSOL_MINT,
} from "../../../tests/utils/consts";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import {
  createMeteoraBSolWsolInstruction,
  createMeteoraWSolJitosolInstruction,
} from "./okx_dex_instructions";

dotenv.config();

const DEFAULT_SWAP_AMOUNT = 100; // 1 token (6 decimals)

const BSOL_WSOL_LUT: PublicKey[] = [
  new PublicKey("AUEghuJaUr4qshAQoSDvV8kfv7xz2kQGeR13G3FihMum"),
  new PublicKey("DKjYmNFTR1SkTV5sD5C4YLyivRDb1Xqku9tzY4MwhTKC"),
];

async function meteoraSwap() {
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  const executor = new BaseSmartAccountHelper(saId);

  //   //WSOL-JITOSOL
  //   const sourceTokenAccount = getAssociatedTokenAddressSync(
  //     WSOL_MINT,

  //     executor.smartAccountHelper.vault,
  //     true, // allowOwnerOffCurve for PDA
  //     TOKEN_PROGRAM_ID
  //   );
  //   const destinationTokenAccount = getAssociatedTokenAddressSync(
  //     JITOSOL_MINT,
  //     executor.smartAccountHelper.vault,
  //     true, // allowOwnerOffCurve for PDA
  //     TOKEN_PROGRAM_ID
  //   );
  //   const depositInstruction = await createMeteoraWSolJitosolInstruction(
  //     executor.provider,
  //     new BN(DEFAULT_SWAP_AMOUNT),
  //     executor.smartAccountHelper.vault,
  //     sourceTokenAccount,
  //     destinationTokenAccount
  //   );
  //   const result = await executor.execute(
  //     [depositInstruction],
  //     "okxdex-meteora-swap",
  //     BSOL_WSOL_LUT
  //   );

  //BSOL-WSOL
  const sourceTokenAccount = getAssociatedTokenAddressSync(
    BSOL_MINT,
    executor.smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );
  const destinationTokenAccount = getAssociatedTokenAddressSync(
    WSOL_MINT,
    executor.smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );
  const depositInstruction = await createMeteoraBSolWsolInstruction(
    executor.provider,
    new BN(DEFAULT_SWAP_AMOUNT),
    executor.smartAccountHelper.vault,
    sourceTokenAccount,
    destinationTokenAccount
  );
  const result = await executor.execute(
    [depositInstruction],
    "okxdex-meteora-swap",
    BSOL_WSOL_LUT
  );

  return result;
}

async function main() {
  try {
    await meteoraSwap();
  } catch (error: any) {
    console.error(`Error:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
