/**
 * OKX DEX Client for Solana Smart Account Integration
 *
 * This module provides a client interface for interacting with OKX's DEX aggregator API
 * to execute token swaps on Solana.
 */

import HmacSHA256 from "crypto-js/hmac-sha256";
import Base64 from "crypto-js/enc-base64";
import dotenv from "dotenv";

// Load environment variables for API credentials
dotenv.config();

/**
 * Parameters required for requesting swap instructions from OKX DEX
 */
export interface SwapRequestParams {
  /** The blockchain network identifier (e.g., 501 for Solana mainnet) */
  chainId: number;
  /** The amount of tokens to swap (in smallest unit) */
  amount: number;
  /** The source token's contract address */
  fromTokenAddress: string;
  /** The destination token's contract address */
  toTokenAddress: string;
  /** Maximum acceptable slippage percentage (e.g., 0.5 for 0.5%) */
  slippage: number;
  /** Whether to use automatic slippage calculation */
  autoSlippage?: boolean;
  /** Maximum automatic slippage percentage when autoSlippage is enabled */
  maxAutoSlippage?: number;
  /** The user's wallet address performing the swap */
  userWalletAddress: string;
  /** Optional address to receive the swapped tokens (defaults to userWalletAddress) */
  swapReceiverAddress?: string;
  /** Fee percentage for the swap operation */
  feePercent?: number;
  /** Referrer wallet address for the source token */
  fromTokenReferrerWalletAddress?: string;
  /** Referrer wallet address for the destination token */
  toTokenReferrerWalletAddress?: string;
  /** Positive slippage percentage for fee sharing */
  positiveSlippagePercent?: number;
  /** Wallet address to receive positive slippage fees */
  positiveSlippageFeeAddress?: string;
  /** Specific DEX IDs to use for the swap (comma-separated) */
  dexIds?: string;
  /** Whether to use direct routing (single pool) */
  directRoute?: boolean;
  /** Price impact protection threshold percentage */
  priceImpactProtectionPercentage?: number;
  /** Compute unit price for Solana transaction */
  computeUnitPrice?: number;
  /** Compute unit limit for Solana transaction */
  computeUnitLimit?: number;
}

/** Base URL for OKX Web3 API endpoints */
const BASE_URL = "https://web3.okx.com";
/** API endpoint path for swap instruction requests (specific to Solana) */
const SWAP_INSTRUCTION_PATH = "/api/v5/dex/aggregator/swap-instruction";

/**
 * OKX DEX Client for executing token swaps on Solana
 *
 * This class provides methods to interact with OKX's DEX aggregator API.
 */
export class OKXDexClient {
  /**
   * Retrieves swap instructions from OKX DEX aggregator
   *
   * This method constructs an authenticated request to OKX's API to get
   * swap instructions for the specified token pair and parameters.
   *
   * @param params - Configuration parameters for the swap operation
   * @returns Promise resolving to the swap instruction data from OKX
   * @throws Error if the API request fails or returns an error code
   *
   * @example
   * ```typescript
   * const client = new OKXDexClient();
   * const instructions = await client.getSwapInstructions({
   *   chainId: 501,
   *   amount: 1000_000,
   *   fromTokenAddress: "So11111111111111111111111111111111111111112",
   *   toTokenAddress: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
   *   slippage: 0.5,
   *   userWalletAddress: "HxuPhmAYQwM4CvdJREL8ad3DgDWGVq4xBfy1vgGev5X7"
   * });
   * ```
   */
  public async getSwapInstructions(params: SwapRequestParams) {
    // Generate ISO timestamp for API authentication
    const timestamp = new Date().toISOString();

    // Convert parameters to query string format
    const queryString = `?${new URLSearchParams(params as unknown as Record<string, string>).toString()}`;

    // HTTP method for the request
    const method = "GET";

    // Generate authenticated headers
    const headers = this.getHeaders(
      timestamp,
      method,
      SWAP_INSTRUCTION_PATH,
      queryString
    );

    // Execute the API request
    const response = await fetch(
      `${BASE_URL}${SWAP_INSTRUCTION_PATH}${queryString}`,
      {
        method,
        headers,
      }
    );

    // Parse and validate the response
    const data = await response.json();
    if (data.code !== "0") {
      throw new Error(data.msg);
    }

    return data.data;
  }

  /**
   * Generates authenticated headers for OKX API requests
   *
   * This method implements OKX's API authentication scheme using HMAC-SHA256
   * with the provided API credentials. The signature is generated from a
   * concatenated string of timestamp, HTTP method, request path, and query/body.
   *
   * @param timestamp - ISO timestamp string for the request
   * @param method - HTTP method (GET, POST, etc.)
   * @param requestPath - API endpoint path
   * @param queryString - Query parameters string (optional)
   * @param body - Request body string (optional)
   * @returns Object containing all required headers for OKX API authentication
   *
   * @private
   */
  private getHeaders(
    timestamp: string,
    method: string,
    requestPath: string,
    queryString = "",
    body = ""
  ) {
    // Construct the string to sign according to OKX API specification
    const stringToSign =
      timestamp + method + requestPath + (queryString || body);

    // Return headers with API key, signature, timestamp, passphrase, and project ID
    return {
      "Content-Type": "application/json",
      "OK-ACCESS-KEY": process.env.OKX_API_KEY!,
      "OK-ACCESS-SIGN": Base64.stringify(
        HmacSHA256(stringToSign, process.env.OKX_SECRET_KEY!)
      ),
      "OK-ACCESS-TIMESTAMP": timestamp,
      "OK-ACCESS-PASSPHRASE": process.env.OKX_API_PASSPHRASE!,
      "OK-ACCESS-PROJECT": process.env.OKX_PROJECT_ID!,
    };
  }
}
