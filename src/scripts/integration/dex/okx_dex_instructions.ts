import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { Connection, PublicKey, TransactionInstruction } from "@solana/web3.js";
import { DexSolana } from "./protocol-interfaces/okx_dex_types";
import {
  BSOL_MINT,
  JITOSOL_MINT,
  METEORA_PROGRAM_ID,
  METEORA_VAULT_PROGRAM_ID,
  WSOL_MINT,
  RAYDIUM_CPMM_PROGRAM_ID,
  RAY_MINT,
  USDC_MINT,
  PYUSD_MINT,
  WHIRLPOOL_PROGRAM_ID,
} from "../../../tests/utils/consts";
import { DecimalUtil, Percentage } from "@orca-so/common-sdk";
// import {
//   WhirlpoolContext,
//   buildWhirlpoolClient,
//   ORCA_WHIRLPOOL_PROGRAM_ID,
//   PDAUtil,
//   swapQuoteByInputToken,
//   IGNORE_CACHE,
// } from "@orca-so/whirlpools-sdk";
const okxDexIdl = require("./protocol-interfaces/okx_dex_idl.json");

const SA_USDC = new PublicKey("HjkGLCPnsMr4yP2Tmi1Uj7gV7Y2xDj2Npn9kYfVBYr2s");
const SA_PDA = new PublicKey("HV1KXxWFaSeriyFvXyx48FqG9BoFbfinB8njCJonqP7K");

export async function createSwapInstruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    orderId: BN;
    remainingAccounts: Array<anchor.web3.AccountMeta>;
    authority: PublicKey;
    sourceTokenAccount: PublicKey;
    destinationTokenAccount: PublicKey;
    sourceMint: PublicKey;
    destinationMint: PublicKey;
  }
): Promise<TransactionInstruction> {
  const dexRouter = new anchor.Program<DexSolana>(okxDexIdl, provider);

  return await dexRouter.methods
    .swap(params.data, params.orderId)
    .accounts({
      payer: params.authority,
      sourceTokenAccount: params.sourceTokenAccount,
      destinationTokenAccount: params.destinationTokenAccount,
      sourceMint: params.sourceMint,
      destinationMint: params.destinationMint,
    })
    .remainingAccounts(params.remainingAccounts)
    .instruction();
}

export async function createSwapV3Instruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    orderId: BN;
    remainingAccounts: Array<anchor.web3.AccountMeta>;
    authority: PublicKey;
    sourceTokenAccount: PublicKey;
    destinationTokenAccount: PublicKey;
    sourceMint: PublicKey;
    destinationMint: PublicKey;
    sourceTokenProgram: PublicKey;
    destinationTokenProgram: PublicKey;
  }
): Promise<TransactionInstruction> {
  const dexRouter = new anchor.Program<DexSolana>(okxDexIdl, provider);

  return await dexRouter.methods
    .swapV3(params.data, 0, 0, params.orderId)
    .accounts({
      payer: params.authority,
      sourceTokenAccount: params.sourceTokenAccount,
      destinationTokenAccount: params.destinationTokenAccount,
      sourceMint: params.sourceMint,
      destinationMint: params.destinationMint,
      commissionAccount: null,
      platformFeeAccount: null,
      saAuthority: SA_PDA,
      sourceTokenSa: null,
      destinationTokenSa: null,
      sourceTokenProgram: params.sourceTokenProgram,
      destinationTokenProgram: params.destinationTokenProgram,
    })
    .remainingAccounts(params.remainingAccounts)
    .instruction();
}

export async function createProxySwapInstruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    orderId: BN;
    remainingAccounts: Array<anchor.web3.AccountMeta>;
    authority: PublicKey;
    sourceTokenAccount: PublicKey;
    destinationTokenAccount: PublicKey;
    sourceMint: PublicKey;
    destinationMint: PublicKey;
    sourceTokenSa: PublicKey;
    destinationTokenSa: PublicKey;
    sourceTokenProgram: PublicKey;
    destinationTokenProgram: PublicKey;
  }
): Promise<TransactionInstruction> {
  const dexRouter = new anchor.Program<DexSolana>(okxDexIdl, provider);

  return await dexRouter.methods
    .proxySwap(params.data, params.orderId)
    .accounts({
      payer: params.authority,
      sourceTokenAccount: params.sourceTokenAccount,
      destinationTokenAccount: params.destinationTokenAccount,
      sourceMint: params.sourceMint,
      destinationMint: params.destinationMint,
      sourceTokenSa: params.sourceTokenSa,
      destinationTokenSa: params.destinationTokenSa,
      sourceTokenProgram: params.sourceTokenProgram,
      destinationTokenProgram: params.destinationTokenProgram,
    })
    .remainingAccounts(params.remainingAccounts)
    .instruction();
}

export async function createMeteoraWSolJitosolInstruction(
  provider: anchor.AnchorProvider,
  amountIn: BN,
  authority: PublicKey,
  sourceTokenAccount: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  const orderId = new BN(new Date().getTime().toString());

  const route = {
    dexes: [{ meteoraLst: {} }],
    weights: Buffer.from([100]),
  };

  const data = {
    amountIn: amountIn,
    expectAmountOut: new BN(1),
    minReturn: new BN(1),
    amounts: [amountIn],
    routes: [[route]],
  };

  const WSOL_JITOSOL_Accounts = [
    { pubkey: METEORA_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
    { pubkey: authority, isSigner: true, isWritable: false }, // swap_authority_pubkey
    { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // swap_source_token
    {
      pubkey: destinationTokenAccount,
      isSigner: false,
      isWritable: true,
    }, // swap_destination_token
    {
      pubkey: new PublicKey("9K1R4DVYZjSH3JiegPfpWndp7RNjFzbtReQPHERoZar8"),
      isSigner: false,
      isWritable: true,
    }, // pool: Meteora (SOL-jitoSOL) Market
    {
      pubkey: new PublicKey("2xqqwsYDPG8stqyksxgeCdNMWKwdvpJw88gGpaiy4m8p"),
      isSigner: false,
      isWritable: true,
    }, // a_vault sol
    {
      pubkey: new PublicKey("BpgPqeH6KURvZdxBkpBrS3QkeRFxGqjvUFCk2awp3Aan"),
      isSigner: false,
      isWritable: true,
    }, // b_vault jitosol
    {
      pubkey: new PublicKey("H8eHe3Fy4mpLZFMdGX77U1S9TSLBi8rtgEEq6SmZa9ed"),
      isSigner: false,
      isWritable: true,
    }, // a_token_vault
    {
      pubkey: new PublicKey("9a6SidbgkdvotSj2bx3ttLBVTemBq5ktBLrKbD6avV2t"),
      isSigner: false,
      isWritable: true,
    }, // b_token_vault
    {
      pubkey: new PublicKey("EcF9SszTQ6wRfvRufYaGde6QVnyTbZRE7ckBV7WkoX7r"),
      isSigner: false,
      isWritable: true,
    }, // a_vault_lp_mint
    {
      pubkey: new PublicKey("7yFNysv3wKwx4QEE3ToVaNTY3qisk7V72hVzkLLYDJHX"),
      isSigner: false,
      isWritable: true,
    }, // b_vault_lp_mint
    {
      pubkey: new PublicKey("G3aQM1ZoMo8sKerCFGGmPmuU6hm4so15EwP7UcUsNWEo"),
      isSigner: false,
      isWritable: true,
    }, // a_vault_lp
    {
      pubkey: new PublicKey("46WZ1wdHjc4K5jGYCdjT5Z24zSKDJhtAfGbf8SLRcKWd"),
      isSigner: false,
      isWritable: true,
    }, // b_vault_lp
    {
      pubkey: new PublicKey("39VpoZuo3rnMfLi5QQqj65drosD2FjAGMTuFA89U2nkf"),
      isSigner: false,
      isWritable: true,
    }, // admin_token_fee
    {
      pubkey: METEORA_VAULT_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // vault_program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // token_program
    {
      pubkey: new PublicKey("Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"),
      isSigner: false,
      isWritable: false,
    }, // lst
  ];

  let remainingAccounts = [];
  WSOL_JITOSOL_Accounts.forEach((account) => remainingAccounts.push(account));

  return await createSwapInstruction(provider, {
    data,
    orderId,
    remainingAccounts,
    authority,
    sourceTokenAccount,
    destinationTokenAccount,
    sourceMint: WSOL_MINT,
    destinationMint: JITOSOL_MINT,
  });
}

export async function createMeteoraBSolWsolInstruction(
  provider: anchor.AnchorProvider,
  amountIn: BN,
  authority: PublicKey,
  sourceTokenAccount: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  const orderId = new BN(new Date().getTime().toString());

  const route = {
    dexes: [{ meteoraLst: {} }],
    weights: Buffer.from([100]),
  };

  const data = {
    amountIn: amountIn,
    expectAmountOut: new BN(1),
    minReturn: new BN(1),
    amounts: [amountIn],
    routes: [[route]],
  };

  const WSOL_JITOSOL_Accounts = [
    { pubkey: METEORA_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
    { pubkey: authority, isSigner: true, isWritable: false }, // swap_authority_pubkey
    { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // swap_source_token
    {
      pubkey: destinationTokenAccount,
      isSigner: false,
      isWritable: true,
    }, // swap_destination_token
    {
      pubkey: new PublicKey("DvWpLaNUPqoCGn4foM6hekAPKqMtADJJbJWhwuMiT6vK"),
      isSigner: false,
      isWritable: true,
    }, // pool: Meteora (BSOL-WSOL) Market
    {
      pubkey: new PublicKey("FERjPVNEa7Udq8CEv68h6tPL46Tq7ieE49HrE2wea3XT"),
      isSigner: false,
      isWritable: true,
    }, // a_vault sol
    {
      pubkey: new PublicKey("62SqUDFBM9dcdb5uwJmPKXgjgBpji9vyAL2qXBbUBQF2"),
      isSigner: false,
      isWritable: true,
    }, // b_vault jitosol
    {
      pubkey: new PublicKey("HZeLxbZ9uHtSpwZC3LBr4Nubd14iHwz7bRSghRZf5VCG"),
      isSigner: false,
      isWritable: true,
    }, // a_token_vault
    {
      pubkey: new PublicKey("EMbnLAPWQtbdp6qA9XNAxMBrEESMwhopmDQKLtsXFMK6"),
      isSigner: false,
      isWritable: true,
    }, // b_token_vault
    {
      pubkey: new PublicKey("FZN7QZ8ZUUAxMPfxYEYkH3cXUASzH8EqA6B4tyCL8f1j"),
      isSigner: false,
      isWritable: true,
    }, // a_vault_lp_mint
    {
      pubkey: new PublicKey("B17utvBuKjiZpBrRZrkDaKWwmNGoLN1vfXFnwhRbB1eZ"),
      isSigner: false,
      isWritable: true,
    }, // b_vault_lp_mint
    {
      pubkey: new PublicKey("BWajRkDXMprxxxPZ9LCh9mJKzCzAxfToTiWyjDJBQwJ9"),
      isSigner: false,
      isWritable: true,
    }, // a_vault_lp
    {
      pubkey: new PublicKey("78PvjMRngHV9fnw7M9bzr86GmU6nsZzsNLmYkphpboqB"),
      isSigner: false,
      isWritable: true,
    }, // b_vault_lp
    {
      pubkey: new PublicKey("4Ck4Dj26eRZqXqxJt4Cmp33MAcH4Z7pCwfjUaqsJ5kd9"),
      isSigner: false,
      isWritable: true,
    }, // admin_token_fee
    {
      pubkey: METEORA_VAULT_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // vault_program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // token_program
    {
      pubkey: new PublicKey("stk9ApL5HeVAwPLr3TLhDXdZS8ptVu7zp6ov8HFDuMi"),
      isSigner: false,
      isWritable: false,
    }, // lst
  ];

  let remainingAccounts = [];
  WSOL_JITOSOL_Accounts.forEach((account) => remainingAccounts.push(account));

  return await createSwapInstruction(provider, {
    data,
    orderId,
    remainingAccounts,
    authority,
    sourceTokenAccount,
    destinationTokenAccount,
    sourceMint: BSOL_MINT,
    destinationMint: WSOL_MINT,
  });
}

export async function createRaydiumWsolUsdcRayCpmmInstruction(
  provider: anchor.AnchorProvider,
  amountIn: BN,
  authority: PublicKey,
  sourceTokenAccount: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  const orderId = new BN(new Date().getTime().toString());

  const route = {
    dexes: [{ raydiumCpmmSwap: {} }],
    weights: Buffer.from([100]),
  };

  const data = {
    amountIn: amountIn,
    expectAmountOut: new BN(1),
    minReturn: new BN(1),
    amounts: [amountIn],
    routes: [[route, route]],
  };

  // 7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny  //WSOL-USDC
  const WSOL_USDC_Accounts = [
    { pubkey: RAYDIUM_CPMM_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
    { pubkey: authority, isSigner: true, isWritable: true }, // swap_authority_pubkey
    { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // swap_source_token
    { pubkey: SA_USDC, isSigner: false, isWritable: true }, // swap_destination_token

    {
      pubkey: new PublicKey("GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL"),
      isSigner: false,
      isWritable: false,
    }, // authority
    {
      pubkey: new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"),
      isSigner: false,
      isWritable: false,
    }, // amm_config
    {
      pubkey: new PublicKey("7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny"),
      isSigner: false,
      isWritable: true,
    }, // pool_state
    {
      pubkey: new PublicKey("7VLUXrnSSDo9BfCa4NWaQs68g7ddDY1sdXBKW6Xswj9Y"),
      isSigner: false,
      isWritable: true,
    }, // input_vault
    {
      pubkey: new PublicKey("3rzbbW5Q8MA7sCaowf28hNgACNPecdS2zceWy7Ptzua9"),
      isSigner: false,
      isWritable: true,
    }, // output_vault
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // input_token_program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // output_token_program
    {
      pubkey: WSOL_MINT,
      isSigner: false,
      isWritable: false,
    }, // input_token_mint
    {
      pubkey: USDC_MINT,
      isSigner: false,
      isWritable: false,
    }, // output_token_mint
    {
      pubkey: new PublicKey("4MYrPgjgFceyhtwhG1ZX8UVb4wn1aQB5wzMimtFqg7U8"),
      isSigner: false,
      isWritable: true,
    }, // observation_state
  ];

  // E4dneNEXM5VuFNcXbRkkQ8y9KUxsxq6mvz6qjidEkqmt  //RAY-USDC
  const USDC_RAY_Accounts = [
    { pubkey: RAYDIUM_CPMM_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
    { pubkey: SA_PDA, isSigner: false, isWritable: true }, // swap_authority_pubkey
    { pubkey: SA_USDC, isSigner: false, isWritable: true }, // swap_source_token
    { pubkey: destinationTokenAccount, isSigner: false, isWritable: true }, // swap_destination_token

    {
      pubkey: new PublicKey("GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL"),
      isSigner: false,
      isWritable: false,
    }, // authority
    {
      pubkey: new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"),
      isSigner: false,
      isWritable: false,
    }, // amm_config
    {
      pubkey: new PublicKey("E4dneNEXM5VuFNcXbRkkQ8y9KUxsxq6mvz6qjidEkqmt"),
      isSigner: false,
      isWritable: true,
    }, // pool_state
    {
      pubkey: new PublicKey("46N1MUfKr28hAexSB9Qvgg9vmhRTY9PL4p3C9QbzHBdZ"),
      isSigner: false,
      isWritable: true,
    }, // input_vault
    {
      pubkey: new PublicKey("2FTpQF59TQ6vawACW2pQ5c66obdzJc99owUKYus8AFF1"),
      isSigner: false,
      isWritable: true,
    }, // output_vault
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // input_token_program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // output_token_program
    {
      pubkey: USDC_MINT,
      isSigner: false,
      isWritable: false,
    }, // input_token_mint
    {
      pubkey: RAY_MINT,
      isSigner: false,
      isWritable: false,
    }, // output_token_mint
    {
      pubkey: new PublicKey("Vhfj6CLT6nGXyhdGAzLj4kkDbHwNYes9eRjRgygU3bP"),
      isSigner: false,
      isWritable: true,
    }, // observation_state
  ];

  let remainingAccounts = [];
  WSOL_USDC_Accounts.forEach((account) => remainingAccounts.push(account));
  USDC_RAY_Accounts.forEach((account) => remainingAccounts.push(account));

  return await createSwapInstruction(provider, {
    data,
    orderId,
    remainingAccounts,
    authority,
    sourceTokenAccount,
    destinationTokenAccount,
    sourceMint: WSOL_MINT,
    destinationMint: RAY_MINT,
  });
}

export async function createRaydiumWsolUsdcCpmmInstruction(
  provider: anchor.AnchorProvider,
  amountIn: BN,
  authority: PublicKey,
  sourceTokenAccount: PublicKey,
  destinationTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  const orderId = new BN(new Date().getTime().toString());

  const route = {
    dexes: [{ raydiumCpmmSwap: {} }],
    weights: Buffer.from([100]),
  };

  const data = {
    amountIn: amountIn,
    expectAmountOut: new BN(1),
    minReturn: new BN(1),
    amounts: [amountIn],
    routes: [[route]],
  };

  // 7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny  //WSOL-USDC
  const WSOL_USDC_Accounts = [
    { pubkey: RAYDIUM_CPMM_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
    { pubkey: authority, isSigner: true, isWritable: true }, // swap_authority_pubkey
    { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // swap_source_token
    { pubkey: destinationTokenAccount, isSigner: false, isWritable: true }, // swap_destination_token

    {
      pubkey: new PublicKey("GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL"),
      isSigner: false,
      isWritable: false,
    }, // authority
    {
      pubkey: new PublicKey("D4FPEruKEHrG5TenZ2mpDGEfu1iUvTiqBxvpU8HLBvC2"),
      isSigner: false,
      isWritable: false,
    }, // amm_config
    {
      pubkey: new PublicKey("7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny"),
      isSigner: false,
      isWritable: true,
    }, // pool_state
    {
      pubkey: new PublicKey("7VLUXrnSSDo9BfCa4NWaQs68g7ddDY1sdXBKW6Xswj9Y"),
      isSigner: false,
      isWritable: true,
    }, // input_vault
    {
      pubkey: new PublicKey("3rzbbW5Q8MA7sCaowf28hNgACNPecdS2zceWy7Ptzua9"),
      isSigner: false,
      isWritable: true,
    }, // output_vault
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // input_token_program
    {
      pubkey: TOKEN_PROGRAM_ID,
      isSigner: false,
      isWritable: false,
    }, // output_token_program
    {
      pubkey: new PublicKey("So11111111111111111111111111111111111111112"),
      isSigner: false,
      isWritable: false,
    }, // input_token_mint
    {
      pubkey: new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"),
      isSigner: false,
      isWritable: false,
    }, // output_token_mint
    {
      pubkey: new PublicKey("4MYrPgjgFceyhtwhG1ZX8UVb4wn1aQB5wzMimtFqg7U8"),
      isSigner: false,
      isWritable: true,
    }, // observation_state
  ];

  let remainingAccounts = [];
  WSOL_USDC_Accounts.forEach((account) => remainingAccounts.push(account));

  return await createSwapInstruction(provider, {
    data,
    orderId,
    remainingAccounts,
    authority,
    sourceTokenAccount,
    destinationTokenAccount,
    sourceMint: WSOL_MINT,
    destinationMint: USDC_MINT,
  });
}

// export async function createWhirlpoolWsolUsdcInstruction(
//   provider: anchor.AnchorProvider,
//   amountIn: BN,
//   authority: PublicKey,
//   sourceTokenAccount: PublicKey,
//   destinationTokenAccount: PublicKey
// ): Promise<TransactionInstruction> {
//   // Derive the Whirlpool address from token mints
//   const ctx = WhirlpoolContext.from(
//     new Connection("https://api.mainnet-beta.solana.com", "confirmed"),
//     provider.wallet,
//     ORCA_WHIRLPOOL_PROGRAM_ID
//   );

//   const client = buildWhirlpoolClient(ctx);

//   const WHIRLPOOLS_CONFIG = new PublicKey(
//     "2LecshUwdy9xi7meFgHtFJQNSKk4KdTrcpvaB56dP2NQ"
//   );

//   // Get devSAMO/devUSDC whirlpool
//   // Whirlpools are identified by 5 elements (Program, Config, mint address of the 1st token,
//   // mint address of the 2nd token, tick spacing), similar to the 5 column compound primary key in DB
//   const tick_spacing = 64;
//   const whirlpool_pubkey = PDAUtil.getWhirlpool(
//     ORCA_WHIRLPOOL_PROGRAM_ID,
//     WHIRLPOOLS_CONFIG,
//     WSOL_MINT,
//     USDC_MINT,
//     tick_spacing
//   ).publicKey;

//   const whirlpool = await client.getPool(whirlpool_pubkey);

//   // Obtain swap estimation (run simulation)
//   const quote = await swapQuoteByInputToken(
//     whirlpool,
//     // Input token and amount
//     WSOL_MINT,
//     amountIn,
//     // Acceptable slippage (10/1000 = 1%)
//     Percentage.fromFraction(10, 1000),
//     ctx.program.programId,
//     ctx.fetcher,
//     IGNORE_CACHE
//   );

//   console.log("quote", quote);

//   const WSOL_USDC_Accounts = [
//     { pubkey: WHIRLPOOL_PROGRAM_ID, isSigner: false, isWritable: false }, // dex_program_id
//     { pubkey: authority, isSigner: true, isWritable: true }, // swap_authority_pubkey
//     { pubkey: sourceTokenAccount, isSigner: false, isWritable: true }, // swap_source_token
//     { pubkey: destinationTokenAccount, isSigner: false, isWritable: true }, // swap_destination_token

//     { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }, // token_program
//     {
//       pubkey: new PublicKey("83v8iPyZihDEjDdY8RdZddyZNyUtXngz69Lgo9Kt5d6d"),
//       isSigner: false,
//       isWritable: true,
//     }, // whirlpool
//     {
//       pubkey: new PublicKey("D3CDPQLoa9jY1LXCkpUqd3JQDWz8DX1LDE1dhmJt9fq4"),
//       isSigner: false,
//       isWritable: true,
//     }, // token_vault_a
//     {
//       pubkey: new PublicKey("dwxR9YF7WwnJJu7bPC4UNcWFpcSsooH6fxbpoa3fTbJ"),
//       isSigner: false,
//       isWritable: true,
//     }, // token_vault_b
//     {
//       pubkey: new PublicKey("BMdNyRddHjueirboyYMVSpDNaPmQvgoKJUE4T8WiyRB2"),
//       isSigner: false,
//       isWritable: true,
//     }, // tick_array0
//     {
//       pubkey: new PublicKey("FviLAXmPAvi8RouVegnYqCraXaLy5zwhsvzvhosX7EaC"),
//       isSigner: false,
//       isWritable: true,
//     }, // tick_array1
//     {
//       pubkey: new PublicKey("5EzgNynWpwAYGNuGZyBGCAh1KqqWwTkmY3pU5F7VJqQm"),
//       isSigner: false,
//       isWritable: true,
//     }, // tick_array2
//     {
//       pubkey: new PublicKey("GwRSc3EPw2fCLJN7zWwcApXgHSrfmj9m4H5sfk1W2SUJ"),
//       isSigner: false,
//       isWritable: false,
//     }, // oracle
//   ];

//   let remainingAccounts = [];
//   WSOL_USDC_Accounts.forEach((account) => remainingAccounts.push(account));

//   const route = {
//     dexes: [{ whirlpool: {} }],
//     weights: Buffer.from([100]),
//   };
//   const data = {
//     amountIn: amountIn,
//     expectAmountOut: new BN(100),
//     minReturn: new BN(100),
//     amounts: [amountIn],
//     routes: [[route]],
//   };

//   const orderId = new BN(new Date().getTime().toString());

//   return await createSwapInstruction(provider, {
//     data,
//     orderId,
//     remainingAccounts,
//     authority,
//     sourceTokenAccount,
//     destinationTokenAccount,
//     sourceMint: WSOL_MINT,
//     destinationMint: USDC_MINT,
//   });
// }
