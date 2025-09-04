#!/usr/bin/env tsx

import { PublicKey, Keypair } from "@solana/web3.js";
import dotenv from "dotenv";
import { BaseSmartAccountExecutor } from "./base_smart_account_executor";
import { USDC_MINT, USDT_MINT } from "../../../tests/utils/consts";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { createClosePositionInstruction } from "./raydium_v3_instructions";
import { loadKeyFromEnv } from "../../../helpers/key-loader";

dotenv.config();

const DEPOSIT_LUT: PublicKey[] = [
  new PublicKey("AcL1Vo8oy1ULiavEcjSUcwfBSForXMudcZvDZy5nzJkU"),
  new PublicKey("8TM3cxoXfnNXU7XUjsAeyN8niu7dQMDf5ZB47nmrTcLD"),
];

async function closePositionRaydium() {
  const saId = process.env.SA_ID;
  if (!saId) {
    throw new Error("SA_ID environment variable is required");
  }

  // Load Raydium V3 USDC/USDT LP key from environment
  const raydiumKeyInfo = loadKeyFromEnv("RAYDIUM_V3_USDC_USDT_LP_KEY");
  if (raydiumKeyInfo.type !== "solana") {
    throw new Error("Expected Solana key type for RAYDIUM_V3_USDC_USDT_LP_KEY");
  }
  const lpTokenKeypair = raydiumKeyInfo.keyObject as Keypair;

  const executor = new BaseSmartAccountExecutor(saId);
  const depositInstruction = await createClosePositionInstruction(
    executor.provider,
    executor.smartAccountHelper.vault,
    lpTokenKeypair
  );
  const result = await executor.execute(
    [depositInstruction],
    "RaydiumV3 closePosition",
    DEPOSIT_LUT
  );
  return result;
}

async function main() {
  try {
    await closePositionRaydium();
  } catch (error: any) {
    console.error(`Error:`, error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
