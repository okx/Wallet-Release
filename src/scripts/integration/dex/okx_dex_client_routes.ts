import { OKXDexClient } from "./okx_dex_client";

/**
 * This is a simple script used to test the OKX DEX client with various routes.
 */
async function main() {
  const client = new OKXDexClient();
  const swapParams = [
    // USDT to USDC
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
      toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
    // SOL to USDC
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "11111111111111111111111111111111",
      toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
    // USDC to TRUMP
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
      toTokenAddress: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
    // WSOL to PUMP
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "So11111111111111111111111111111111111111112",
      toTokenAddress: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
    // PUMP to TRUMP
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "pumpCmXqMfrsAkQ5r49WcJnRayYRqmXz6ae8H7H9Dfn",
      toTokenAddress: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
    // TRUMP to CT
    {
      chainId: 501,
      feePercent: 1,
      amount: 1000_000,
      fromTokenAddress: "6p6xgHyF7AeE6TZkSmFsko444wqoP15icUSqi2jfGiPN",
      toTokenAddress: "6fUwECXzRQeh2wYuTg3xeQHGt4wSbiUbsdd1PYw3pump",
      slippage: 0.1,
      userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7",
      autoSlippage: false,
      directRoute: true,
    },
  ];
  for (const swapParam of swapParams) {
    const swapInstructions = await client.getSwapInstructions(swapParam);
    console.log("------------------------------------------------------");
    console.log(swapInstructions);
    await new Promise((resolve) => setTimeout(resolve, 1500)); // Sleep to avoid rate limiting
  }
}

main();
