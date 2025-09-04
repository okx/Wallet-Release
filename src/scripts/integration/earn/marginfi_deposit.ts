#!/usr/bin/env tsx

import { PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { BaseSmartAccountExecutor } from "./base_smart_account_executor";
import {
  createJitosolDepositInstruction,
  createWsolDepositInstruction,
} from "./marginfi_instructions";
import {
  JITOSOL_MINT,
  PYUSD_MINT,
  WSOL_MINT,
} from "../../../tests/utils/consts";
import {
  getAssociatedTokenAddressSync,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";

dotenv.config();

const DEFAULT_DEPOSIT_AMOUNT = 1; // 1 token (6 decimals)

const DEPOSIT_LUT: PublicKey[] = [
  new PublicKey("HGmknUTUmeovMc9ryERNWG6UFZDFDVr9xrum3ZhyL4fC"),
];

async function depositWsolMarginFi() {
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  const executor = new BaseSmartAccountExecutor(saId);

  // //WSOL
  // const vaultTokenAccount = getAssociatedTokenAddressSync(
  //   WSOL_MINT,
  //   executor.smartAccountHelper.vault,
  //   true, // allowOwnerOffCurve for PDA
  //   TOKEN_PROGRAM_ID
  // );
  // const depositInstruction = await createWsolDepositInstruction(
  //   executor.provider,
  //   DEFAULT_DEPOSIT_AMOUNT,
  //   executor.smartAccountHelper.vault,
  //   vaultTokenAccount,
  //   true
  // );

  //PYUSD
  const vaultTokenAccount = getAssociatedTokenAddressSync(
    JITOSOL_MINT,
    executor.smartAccountHelper.vault,
    true, // allowOwnerOffCurve for PDA
    TOKEN_PROGRAM_ID
  );
  const depositInstruction = await createJitosolDepositInstruction(
    executor.provider,
    DEFAULT_DEPOSIT_AMOUNT,
    executor.smartAccountHelper.vault,
    vaultTokenAccount,
    true
  );
  const result = await executor.execute(
    [depositInstruction],
    "MarginFi deposit",
    DEPOSIT_LUT
  );
  return result;
}

async function main() {
  try {
    await depositWsolMarginFi();
  } catch (error: any) {
    console.error(`Error:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
