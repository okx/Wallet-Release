import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  ApiV3PoolInfoConcentratedItem,
  ApiV3PoolInfoItem,
  CLMM_PROGRAM_ID,
  ClmmKeys,
  MAX_SQRT_PRICE_X64,
  MEMO_PROGRAM_ID2,
  METADATA_PROGRAM_ID,
  MIN_SQRT_PRICE_X64,
  MaxU64,
  PoolKeys,
  PoolUtils,
  RENT_PROGRAM_ID,
  Raydium,
  SYSTEM_PROGRAM_ID,
  SqrtPriceMath,
  TickUtils,
  getATAAddress,
  getLiquidityFromAmounts,
  getPdaExBitmapAccount,
  getPdaMetadataKey,
  getPdaPersonalPositionAddress,
  getPdaProtocolPositionAddress,
  getPdaTickArrayAddress,
  u64,
} from "@raydium-io/raydium-sdk-v2";

const raydiumV3Idl = require("./protocol-interfaces/raydium_v3_idl.json");
import { AmmV3 } from "./protocol-interfaces/raydium_v3_types";
import {
  AccountMeta,
  Connection,
  Keypair,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { ASSOCIATED_PROGRAM_ID } from "@coral-xyz/anchor/dist/cjs/utils/token";

const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";
export const RAYDIUM_CLMM_USDC_USDT_POOL = new PublicKey(
  "BZtgQEyS6eXUXicYPHecYQ7PybqodXQMvkjUbP4R8mUU"
);

export async function createIncreaseLiquidityInstruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    authority: PublicKey;
    poolId: PublicKey;
    lpTokenKeypair: Keypair;
    tokenAccount0: PublicKey;
    tokenAccount1: PublicKey;
  }
): Promise<TransactionInstruction> {
  const raydiumV3 = new anchor.Program<AmmV3>(raydiumV3Idl, provider);
  let nftMint = params.lpTokenKeypair.publicKey;

  //SDK related
  const poolInfo = await getPoolInfo(params.poolId);
  const poolKey = await getPoolKey(params.poolId);
  const clmmPoolInfo = await getComputeClmmInfo(
    new Connection(MAINNET_RPC_URL) as any,
    poolInfo
  );

  const poolState = new PublicKey(poolInfo.id);
  let tokenVault0 = new PublicKey(poolKey.vault.A);
  let tokenVault1 = new PublicKey(poolKey.vault.B);
  let vaultMint0 = new PublicKey(poolKey.mintA.address);
  let vaultMint1 = new PublicKey(poolKey.mintB.address);

  const { publicKey: personalPosition, nonce: bump4 } =
    getPdaPersonalPositionAddress(clmmPoolInfo.programId, nftMint);
  const personalPositionInfo = await getPersonalPositionInfo(
    raydiumV3,
    personalPosition
  );

  let ownerPosition = {
    nftMint: personalPositionInfo.nftMint,
    tickLower: personalPositionInfo.tickLowerIndex,
    tickUpper: personalPositionInfo.tickUpperIndex,
  };

  const { publicKey: nftAccount, nonce: bump6 } = getATAAddress(
    params.authority,
    nftMint,
    TOKEN_PROGRAM_ID
  );

  const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    ownerPosition.tickLower,
    poolInfo.config.tickSpacing
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    ownerPosition.tickUpper,
    poolInfo.config.tickSpacing
  );

  const { publicKey: tickArrayLower } = getPdaTickArrayAddress(
    clmmPoolInfo.programId,
    params.poolId,
    tickArrayLowerStartIndex
  );
  const { publicKey: tickArrayUpper } = getPdaTickArrayAddress(
    clmmPoolInfo.programId,
    params.poolId,
    tickArrayUpperStartIndex
  );

  const { publicKey: protocolPosition } = getPdaProtocolPositionAddress(
    clmmPoolInfo.programId,
    poolState,
    ownerPosition.tickLower,
    ownerPosition.tickUpper
  );

  return await raydiumV3.methods
    .increaseLiquidityV2(
      new BN(params.data.liquidity),
      new BN(params.data.amount0Max),
      new BN(params.data.amount1Max),
      Boolean(params.data.baseFlag)
    )
    .accounts({
      nftOwner: params.authority,
      nftAccount: nftAccount,
      poolState: poolState,
      protocolPosition: protocolPosition,
      personalPosition: personalPosition,
      tickArrayLower: tickArrayLower,
      tickArrayUpper: tickArrayUpper,
      tokenAccount0: params.tokenAccount0,
      tokenAccount1: params.tokenAccount1,
      tokenVault0: tokenVault0,
      tokenVault1: tokenVault1,
      vault0Mint: vaultMint0,
      vault1Mint: vaultMint1,
    })
    .instruction();
}

async function _createClosePositionInstruction(
  provider: anchor.AnchorProvider,
  params: {
    authority: PublicKey;
    poolId: PublicKey;
    lpTokenKeypair: Keypair;
  }
): Promise<TransactionInstruction> {
  const raydiumV3 = new anchor.Program<AmmV3>(raydiumV3Idl, provider);
  const poolInfo = await getPoolInfo(params.poolId);
  const poolKey = await getPoolKey(params.poolId);
  const clmmPoolInfo = await getComputeClmmInfo(
    new Connection(MAINNET_RPC_URL) as any,
    poolInfo
  );

  const { publicKey: personalPosition, nonce: bump4 } =
    getPdaPersonalPositionAddress(
      clmmPoolInfo.programId,
      params.lpTokenKeypair.publicKey
    );
  const { publicKey: nftAccount, nonce: bump6 } = getATAAddress(
    params.authority,
    params.lpTokenKeypair.publicKey,
    TOKEN_PROGRAM_ID
  );
  return await raydiumV3.methods
    .closePosition()
    .accountsPartial({
      nftOwner: params.authority,
      positionNftMint: params.lpTokenKeypair.publicKey,
      positionNftAccount: nftAccount,
      personalPosition: personalPosition,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .instruction();
}

export async function createDecreaseLiquidityInstruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    authority: PublicKey;
    poolId: PublicKey;
    lpTokenKeypair: Keypair;
    tokenAccount0: PublicKey;
    tokenAccount1: PublicKey;
    rewardTokenAccount: PublicKey;
  }
): Promise<TransactionInstruction> {
  const raydiumV3 = new anchor.Program<AmmV3>(raydiumV3Idl, provider);
  let nftMint = params.lpTokenKeypair.publicKey;

  //SDK related
  const poolInfo = await getPoolInfo(params.poolId);
  const poolKey = await getPoolKey(params.poolId);
  const clmmPoolInfo = await getComputeClmmInfo(
    new Connection(MAINNET_RPC_URL) as any,
    poolInfo
  );

  const poolState = new PublicKey(poolInfo.id);
  let tokenVault0 = new PublicKey(poolKey.vault.A);
  let tokenVault1 = new PublicKey(poolKey.vault.B);
  let vaultMint0 = new PublicKey(poolKey.mintA.address);
  let vaultMint1 = new PublicKey(poolKey.mintB.address);

  const { publicKey: personalPosition, nonce: bump4 } =
    getPdaPersonalPositionAddress(clmmPoolInfo.programId, nftMint);
  const personalPositionInfo = await getPersonalPositionInfo(
    raydiumV3,
    personalPosition
  );

  let ownerPosition = {
    nftMint: personalPositionInfo.nftMint,
    tickLower: personalPositionInfo.tickLowerIndex,
    tickUpper: personalPositionInfo.tickUpperIndex,
  };

  const { publicKey: nftAccount, nonce: bump6 } = getATAAddress(
    params.authority,
    nftMint,
    TOKEN_PROGRAM_ID
  );

  const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    ownerPosition.tickLower,
    poolInfo.config.tickSpacing
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    ownerPosition.tickUpper,
    poolInfo.config.tickSpacing
  );

  const { publicKey: tickArrayLower } = getPdaTickArrayAddress(
    clmmPoolInfo.programId,
    params.poolId,
    tickArrayLowerStartIndex
  );
  const { publicKey: tickArrayUpper } = getPdaTickArrayAddress(
    clmmPoolInfo.programId,
    params.poolId,
    tickArrayUpperStartIndex
  );

  const { publicKey: protocolPosition } = getPdaProtocolPositionAddress(
    clmmPoolInfo.programId,
    poolState,
    ownerPosition.tickLower,
    ownerPosition.tickUpper
  );

  const remainingAccounts: AccountMeta[] = [
    {
      pubkey: new PublicKey(poolKey.rewardInfos[0].vault),
      isSigner: false,
      isWritable: true,
    },
    { pubkey: params.rewardTokenAccount, isSigner: false, isWritable: true },
    {
      pubkey: new PublicKey(poolInfo.rewardDefaultInfos[0].mint.address),
      isSigner: false,
      isWritable: false,
    },
  ];

  return await raydiumV3.methods
    .decreaseLiquidityV2(
      new BN(params.data.liquidity),
      new BN(params.data.amount0Max),
      new BN(params.data.amount1Max)
    )
    .accounts({
      nftOwner: params.authority,
      nftAccount: nftAccount,
      poolState: poolState,
      protocolPosition: protocolPosition,
      personalPosition: personalPosition,
      tickArrayLower: tickArrayLower,
      tickArrayUpper: tickArrayUpper,
      recipientTokenAccount0: params.tokenAccount0,
      recipientTokenAccount1: params.tokenAccount1,
      tokenVault0: tokenVault0,
      tokenVault1: tokenVault1,
      vault0Mint: vaultMint0,
      vault1Mint: vaultMint1,
    })
    .remainingAccounts(remainingAccounts)
    .instruction();
}
export async function createClosePositionInstruction(
  provider: anchor.AnchorProvider,
  authority: PublicKey,
  lpTokenKeypair: Keypair
): Promise<TransactionInstruction> {
  return await _createClosePositionInstruction(provider, {
    authority: authority,
    poolId: RAYDIUM_CLMM_USDC_USDT_POOL,
    lpTokenKeypair: lpTokenKeypair,
  });
}
export async function createUsdcUsdtOpenPositionIx(
  provider: anchor.AnchorProvider,
  authority: PublicKey,
  usdcAmountMax: BN,
  usdtAmountMax: BN,
  usdcTokenAccount: PublicKey,
  usdtTokenAccount: PublicKey,
  lpTokenKeypair: Keypair
): Promise<TransactionInstruction> {
  return createOpenPositionInstruction(provider, {
    data: {
      liquidity: new BN(0),
      amount0Max: usdcAmountMax,
      amount1Max: usdtAmountMax,
      withMetadata: true,
      baseFlag: false,
    },
    authority,
    poolId: RAYDIUM_CLMM_USDC_USDT_POOL,
    tokenAccount0: usdcTokenAccount,
    tokenAccount1: usdtTokenAccount,
    lpTokenKeypair: lpTokenKeypair,
  });
}

export async function createUsdcUsdtDecreaseLiquidityIx(
  provider: anchor.AnchorProvider,
  authority: PublicKey,
  usdcAmountMax: BN,
  usdtAmountMax: BN,
  usdcTokenAccount: PublicKey,
  usdtTokenAccount: PublicKey,
  lpTokenKeypair: Keypair,
  rewardTokenAccount: PublicKey
): Promise<TransactionInstruction> {
  return createDecreaseLiquidityInstruction(provider, {
    data: {
      liquidity: new BN(0),
      amount0Max: usdcAmountMax,
      amount1Max: usdtAmountMax,
    },
    authority,
    poolId: RAYDIUM_CLMM_USDC_USDT_POOL,
    tokenAccount0: usdcTokenAccount,
    tokenAccount1: usdtTokenAccount,
    lpTokenKeypair: lpTokenKeypair,
    rewardTokenAccount: rewardTokenAccount,
  });
}

export async function createUsdcUsdtIncreaseLiquidityIx(
  provider: anchor.AnchorProvider,
  authority: PublicKey,
  usdcAmountMax: BN,
  usdtAmountMax: BN,
  usdcTokenAccount: PublicKey,
  usdtTokenAccount: PublicKey,
  lpTokenKeypair: Keypair
): Promise<TransactionInstruction> {
  return createIncreaseLiquidityInstruction(provider, {
    data: {
      liquidity: new BN(0),
      amount0Max: usdcAmountMax,
      amount1Max: usdtAmountMax,
      baseFlag: false,
    },
    authority,
    poolId: RAYDIUM_CLMM_USDC_USDT_POOL,
    tokenAccount0: usdcTokenAccount,
    tokenAccount1: usdtTokenAccount,
    lpTokenKeypair: lpTokenKeypair,
  });
}

export async function createOpenPositionInstruction(
  provider: anchor.AnchorProvider,
  params: {
    data: any;
    authority: PublicKey;
    poolId: PublicKey;
    tokenAccount0: PublicKey;
    tokenAccount1: PublicKey;
    lpTokenKeypair: Keypair;
  }
): Promise<TransactionInstruction> {
  const raydiumV3 = new anchor.Program<AmmV3>(raydiumV3Idl, provider);

  //SDK related
  const poolInfo = await getPoolInfo(params.poolId);
  const poolKey = await getPoolKey(params.poolId);
  const clmmPoolInfo = await getComputeClmmInfo(
    new Connection(MAINNET_RPC_URL) as any,
    poolInfo
  );
  const poolState = new PublicKey(poolInfo.id);
  let tokenVault0 = new PublicKey(poolKey.vault.A);
  let tokenVault1 = new PublicKey(poolKey.vault.B);
  let vaultMint0 = new PublicKey(poolKey.mintA.address);
  let vaultMint1 = new PublicKey(poolKey.mintB.address);

  const nftMintAccountKeyPair = params.lpTokenKeypair;
  const positionNftMint = nftMintAccountKeyPair.publicKey;
  const { publicKey: positionNftAccount, nonce: bump6 } = getATAAddress(
    params.authority,
    nftMintAccountKeyPair.publicKey,
    TOKEN_PROGRAM_ID
  );
  let { publicKey: metadataAccount } = getPdaMetadataKey(
    nftMintAccountKeyPair.publicKey
  );

  const { publicKey: personalPosition, nonce: bump5 } =
    getPdaPersonalPositionAddress(
      new PublicKey(poolInfo.programId),
      nftMintAccountKeyPair.publicKey
    );

  let currentTick = clmmPoolInfo.tickCurrent;

  const tickLower = currentTick - 1;
  const tickUpper = currentTick + 1;
  // Get PDA addresses for tick arrays and protocol position
  const tickArrayLowerStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickLower,
    clmmPoolInfo.tickSpacing
  );
  const tickArrayUpperStartIndex = TickUtils.getTickArrayStartIndexByTick(
    tickUpper,
    clmmPoolInfo.tickSpacing
  );

  const { publicKey: tickArrayLower } = getPdaTickArrayAddress(
    new PublicKey(poolInfo.programId),
    params.poolId,
    tickArrayLowerStartIndex
  );
  const { publicKey: tickArrayUpper } = getPdaTickArrayAddress(
    new PublicKey(poolInfo.programId),
    params.poolId,
    tickArrayUpperStartIndex
  );
  const { publicKey: protocolPosition } = getPdaProtocolPositionAddress(
    new PublicKey(poolInfo.programId),
    params.poolId,
    tickLower,
    tickUpper
  );

  return await raydiumV3.methods
    .openPositionV2(
      tickLower,
      tickUpper,
      tickArrayLowerStartIndex,
      tickArrayUpperStartIndex,
      new BN(params.data.liquidity),
      new BN(params.data.amount0Max),
      new BN(params.data.amount1Max),
      Boolean(params.data.withMetadata),
      Boolean(params.data.baseFlag)
    )
    .accountsPartial({
      payer: params.authority,
      positionNftOwner: params.authority,
      positionNftMint: positionNftMint,
      positionNftAccount: positionNftAccount,
      metadataAccount: metadataAccount,
      poolState: poolState,
      protocolPosition: protocolPosition,
      tickArrayLower: tickArrayLower,
      tickArrayUpper: tickArrayUpper,
      personalPosition: personalPosition,
      tokenAccount0: params.tokenAccount0,
      tokenAccount1: params.tokenAccount1,
      tokenVault0: tokenVault0,
      tokenVault1: tokenVault1,
      rent: RENT_PROGRAM_ID,
      systemProgram: SYSTEM_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_PROGRAM_ID,
      metadataProgram: METADATA_PROGRAM_ID,
      tokenProgram2022: TOKEN_2022_PROGRAM_ID,
      vault0Mint: vaultMint0,
      vault1Mint: vaultMint1,
    })
    .instruction();
}

async function getComputeClmmInfo(connection: Connection, poolInfo: any) {
  const clmmPoolInfos = await PoolUtils.fetchComputeClmmInfo({
    connection: connection as any,
    poolInfo: poolInfo,
  });
  return clmmPoolInfos;
}

export async function getPoolInfo(
  poolId: PublicKey
): Promise<ApiV3PoolInfoConcentratedItem> {
  let raydium = await Raydium.load({
    connection: new Connection(MAINNET_RPC_URL) as any,
    cluster: "mainnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
  });
  let pools: ApiV3PoolInfoItem[] = await raydium.api.fetchPoolById({
    ids: poolId.toBase58(),
  });
  let p: ApiV3PoolInfoConcentratedItem = <ApiV3PoolInfoConcentratedItem>(
    pools[0]
  );
  return p;
}

async function getPoolKey(poolId: PublicKey): Promise<ClmmKeys> {
  let raydium = await Raydium.load({
    connection: new Connection(MAINNET_RPC_URL) as any,
    cluster: "mainnet",
    disableFeatureCheck: true,
    disableLoadToken: true,
  });
  let keys: PoolKeys[] = await raydium.api.fetchPoolKeysById({
    idList: [poolId.toBase58()],
  });
  return <ClmmKeys>keys[0];
}
export async function getPersonalPositionInfo(
  clmm: anchor.Program<AmmV3>,
  position: PublicKey
) {
  const data = await clmm.provider.connection.getAccountInfo(position);
  if (!data) {
    return null;
  }
  const structName = "PersonalPositionState";
  // use anchor idl decode data
  return decodeData(clmm, data!.data, structName);
}
// decode account
async function decodeData(
  clmm: anchor.Program<AmmV3>,
  data: Buffer,
  type: string
) {
  try {
    if (type === "PersonalPositionState") {
      // Manual decode for PersonalPositionState
      return decodePersonalPositionState(data);
    }

    const res = clmm.coder.accounts.decode(type, data);
    return res;
  } catch (error) {
    console.error("Decode error:", error);
    throw error;
  }
}

// Manual decoder for PersonalPositionState
function decodePersonalPositionState(data: Buffer) {
  // Skip discriminator (8 bytes)
  let offset = 8;

  // bump: u8[1]
  const bump = data[offset];
  offset += 1;

  // nft_mint: pubkey (32 bytes)
  const nftMint = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // pool_id: pubkey (32 bytes)
  const poolId = new PublicKey(data.slice(offset, offset + 32));
  offset += 32;

  // tick_lower_index: i32 (4 bytes)
  const tickLowerIndex = data.readInt32LE(offset);
  offset += 4;

  // tick_upper_index: i32 (4 bytes)
  const tickUpperIndex = data.readInt32LE(offset);
  offset += 4;

  // liquidity: u128 (16 bytes)
  const liquidity = new BN(data.slice(offset, offset + 16), "le");
  offset += 16;

  // fee_growth_inside_0_last_x64: u128 (16 bytes)
  const feeGrowthInside0LastX64 = new BN(data.slice(offset, offset + 16), "le");
  offset += 16;

  // fee_growth_inside_1_last_x64: u128 (16 bytes)
  const feeGrowthInside1LastX64 = new BN(data.slice(offset, offset + 16), "le");
  offset += 16;

  // token_fees_owed_0: u64 (8 bytes)
  const tokenFeesOwed0 = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // token_fees_owed_1: u64 (8 bytes)
  const tokenFeesOwed1 = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // reward_infos: PositionRewardInfo[3] (skip for now)
  offset += 3 * 48; // 48 bytes per PositionRewardInfo

  // recent_epoch: u64 (8 bytes)
  const recentEpoch = new BN(data.slice(offset, offset + 8), "le");
  offset += 8;

  // padding: u64[7] (56 bytes)
  offset += 56;

  // console.log("Manually decoded PersonalPositionState:");
  // console.log("  bump:", bump);
  // console.log("  nftMint:", nftMint.toBase58());
  // console.log("  poolId:", poolId.toBase58());
  // console.log("  tickLowerIndex:", tickLowerIndex);
  // console.log("  tickUpperIndex:", tickUpperIndex);
  // console.log("  liquidity:", liquidity.toString());
  // console.log("  feeGrowthInside0LastX64:", feeGrowthInside0LastX64.toString());
  // console.log("  feeGrowthInside1LastX64:", feeGrowthInside1LastX64.toString());
  // console.log("  tokenFeesOwed0:", tokenFeesOwed0.toString());
  // console.log("  tokenFeesOwed1:", tokenFeesOwed1.toString());
  // console.log("  recentEpoch:", recentEpoch.toString());

  return {
    bump,
    nftMint,
    poolId,
    tickLowerIndex,
    tickUpperIndex,
    liquidity,
    feeGrowthInside0LastX64,
    feeGrowthInside1LastX64,
    tokenFeesOwed0,
    tokenFeesOwed1,
    recentEpoch,
  };
}
