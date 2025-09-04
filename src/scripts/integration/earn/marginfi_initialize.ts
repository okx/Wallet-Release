#!/usr/bin/env tsx

import { PublicKey } from "@solana/web3.js";
import dotenv from "dotenv";
import { BaseSmartAccountExecutor } from "./base_smart_account_executor";
import {
  createMarginfiInitializeInstruction,
  createWsolDepositInstruction,
} from "./marginfi_instructions";
import { loadKeyFromEnv } from "../../../helpers/key-loader";

dotenv.config();

const DEFAULT_DEPOSIT_AMOUNT = 1_000_000; // 1 token (6 decimals)
const WSOL_MINT = new PublicKey("So11111111111111111111111111111111111111112");

const DEPOSIT_LUT: PublicKey[] = [
  new PublicKey("HGmknUTUmeovMc9ryERNWG6UFZDFDVr9xrum3ZhyL4fC"),
];

async function initializeMarginfiAccount() {
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  // Load MarginFi account key from environment
  const marginfiAccountInfo = loadKeyFromEnv("MARGINFI_ACCOUNT_KEY");
  if (marginfiAccountInfo.type !== "solana") {
    throw new Error("Expected Solana key type for MARGINFI_ACCOUNT_KEY");
  }

  const executor = new BaseSmartAccountExecutor(saId);
  const initializeMarginfiAccountInstruction =
    await createMarginfiInitializeInstruction(
      executor.provider,
      executor.smartAccountHelper.vault
    );
  const result = await executor.execute(
    [initializeMarginfiAccountInstruction],
    "MarginFi initialize",
    DEPOSIT_LUT,
    [marginfiAccountInfo.keyObject]
  );
  return result;
}

async function main() {
  try {
    await initializeMarginfiAccount();
  } catch (error: any) {
    console.error(`Error:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
