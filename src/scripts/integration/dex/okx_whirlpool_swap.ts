// #!/usr/bin/env tsx

// import { PublicKey } from "@solana/web3.js";
// import { BN } from "@coral-xyz/anchor";
// import dotenv from "dotenv";
// import { BaseSmartAccountHelper } from "./base_smart_account_helper";
// import {
//   BSOL_MINT,
//   JITOSOL_MINT,
//   USDC_MINT,
//   WSOL_MINT,
// } from "../../../tests/utils/consts";
// import { getAssociatedTokenAddressSync } from "@solana/spl-token";
// import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
// import {
//   createMeteoraBSolWsolInstruction,
//   createMeteoraWSolJitosolInstruction,
//   createWhirlpoolWsolUsdcInstruction,
// } from "./okx_dex_instructions";

// dotenv.config();

// const DEFAULT_SWAP_AMOUNT = 100; // 1 token (6 decimals)

// const WHIRLPOOL_LUT: PublicKey[] = [
//   new PublicKey("4jgg9CHLiTeQUwSDK9srby9Vp1NhDGqpdacWvUASGUwY"),
//   new PublicKey("AasXE6kXjTUJNrguDCRXH9KMKVtFR81FNF9AxGZPFazZ"),
//   new PublicKey("6iKL9eCnLbdysrTeoMjR2QiDFXBYWX5pACjkBkkkqAda"),
//   new PublicKey("86SrhKd777zVoBSNEDrGdwbo7RMbbLxzk3qjHWrCfwb4"),
// ];

// async function whirlpoolSwap() {
//   const saId = process.env.SA_ID;
//   if (!saId) {
//     throw new Error("SA_ID environment variable is required");
//   }

//   const executor = new BaseSmartAccountHelper(saId);

//   //WSOL-USDC
//   const sourceTokenAccount = getAssociatedTokenAddressSync(
//     WSOL_MINT,
//     executor.smartAccountHelper.vault,
//     true, // allowOwnerOffCurve for PDA
//     TOKEN_PROGRAM_ID
//   );
//   const destinationTokenAccount = getAssociatedTokenAddressSync(
//     USDC_MINT,
//     executor.smartAccountHelper.vault,
//     true, // allowOwnerOffCurve for PDA
//     TOKEN_PROGRAM_ID
//   );
//   const depositInstruction = await createWhirlpoolWsolUsdcInstruction(
//     executor.provider,
//     new BN(DEFAULT_SWAP_AMOUNT),
//     executor.smartAccountHelper.vault,
//     sourceTokenAccount,
//     destinationTokenAccount
//   );
//   const result = await executor.execute(
//     [depositInstruction],
//     "okxdex-whirlpool-swap",
//     WHIRLPOOL_LUT
//   );

//   return result;
// }

// async function main() {
//   try {
//     await whirlpoolSwap();
//   } catch (error: any) {
//     console.error(`Error:`, error.message);
//     process.exit(1);
//   }
// }

// if (require.main === module) {
//   main().catch(console.error);
// }
