/**
 * Jito Bundle Client
 *
 * This module provides a client interface for interacting with Jito's bundling
 * infrastructure on Solana. It handles bundle simulation, submission, confirmation,
 * and tip estimation for maximizing transaction execution priority.
 *
 * Key features:
 * - Bundle simulation and validation
 * - Dynamic tip estimation for priority
 * - Bundle status monitoring and confirmation
 * - Rate limiting protection with retry mechanisms (Default Jito RPC connection very prone to error 429)
 */

import * as anchor from "@coral-xyz/anchor";
import base58 from "bs58";
import dotenv from "dotenv";
import { JitoRpcConnection } from "jito-ts";
import { JitoJsonRpcClient } from "jito-js-rpc";
import { SendBundleParams } from "jito-js-rpc/dist/types";
import { convertToBase64 } from "./utils";

// Load environment variables for RPC configuration
dotenv.config();

/** Jito block engine API endpoint for bundle submission (Singapore) */
const JITO_BLOCK_ENGINE_URL =
  "https://singapore.mainnet.block-engine.jito.wtf/api/v1";
/** Jito tip floor API endpoint for dynamic tip estimation */
const JITO_TIP_RPC_URL = "https://bundles.jito.wtf/api/v1/bundles/tip_floor";
/** Jito explorer URL for bundle monitoring and verification */
const JITO_EXPLORER_URL = "https://explorer.jito.wtf/";
/** Fallback tip amount in lamports when API estimation fails (10_000 lamports usually corresponds to ~50th percentile) */
const JITO_FALLBACK_TIP = 10_000;

/**
 * Jito Bundle Client for executing transaction bundles
 *
 * This class provides methods to create, simulate, submit, and monitor bundles
 * on Solana through Jito's infrastructure. It ensures transaction execution priority.
 */
export default class Jito {
  /** Jito JSON-RPC client for most Jito related functionality */
  private jitoClient: JitoJsonRpcClient;
  /** Jito RPC connection - contains all typical Solana RPC methods, plus Jito bundle simulation */
  private jitoConnection: JitoRpcConnection;

  /**
   * Initialize the Jito client with block engine and RPC connections
   */
  constructor() {
    this.jitoClient = new JitoJsonRpcClient(JITO_BLOCK_ENGINE_URL);
    this.jitoConnection = new JitoRpcConnection(process.env.RPC_URL);
  }

  /**
   * Execute a bundle of transactions
   *
   * This method simulates the bundle first, then submits it to Jito's block engine
   * if simulation succeeds. It then provides status monitoring and
   * returns the relevant execution information.
   *
   * @param bundle - Array of versioned transactions to execute as a bundle
   * @param address - Public key of the account to monitor during simulation (usually, the account processing the operation)
   * @param isSimulationOnly - If true, only simulate without submitting
   * @returns Promise resolving to execution status message or simulation results
   * @throws Error if bundle simulation or execution fails
   *
   * @example
   * ```typescript
   * const jito = new Jito();
   * const result = await jito.executeBundle(
   *   [transaction1, transaction2],
   *   wallet.publicKey,
   *   false
   * );
   * console.log(result);
   * ```
   */
  public async executeBundle(
    bundle: anchor.web3.VersionedTransaction[],
    address: anchor.web3.PublicKey,
    isSimulationOnly: boolean = false
  ) {
    try {
      // Simulate bundle to validate execution before submission
      const bundleSimulation = await this.simulateBundle(bundle, address);

      // Process simulation results to get tx logs if successful and error message if failed
      const result = this.handleSimulateBundleResponse(
        bundleSimulation,
        isSimulationOnly
      );

      if (!result.success) {
        throw new Error(`Bundle simulation failed: ${result.message}`);
      }

      // If simulation only, return the simulation result message
      if (isSimulationOnly) {
        return result.message;
      } else {
        console.log(result.message);
      }

      // If simulation succeeds, submit bundle to Jito's block engine
      const bundleId = await this.sendBundle(bundle);

      // Monitor bundle confirmation and get final slot
      const slot = await this.confirmBundle(bundleId, bundle);

      // Construct comprehensive result message with explorer links
      let message = `Bundle finalized at slot: ${slot}\n`;
      message += `\nBundle Event History: ${JITO_EXPLORER_URL}events/${bundleId}`;
      message += `\nBundle Details (Wait ~30 seconds to update): ${JITO_EXPLORER_URL}bundle/${bundleId}`;
      return message;
    } catch (error: any) {
      console.log(error);
      throw new Error(`Bundle execution failed: ${error.message}`);
    }
  }

  /**
   * Simulate bundle execution to validate transactions before submission
   *
   * This method simulates the entire bundle to catch any execution errors
   * before submitting to the network. Note that the config object can be used
   * to set the accounts to monitor before and after execution. In this method,
   * we default to monitoring just one account, the one processing the operation.
   *
   * @param bundle - Array of versioned transactions to simulate
   * @param address - Public key of the account to monitor during simulation
   * @returns Promise resolving to simulation results from Jito
   * @throws Error if simulation request fails
   *
   * @private
   */
  private async simulateBundle(
    bundle: anchor.web3.VersionedTransaction[],
    address: anchor.web3.PublicKey
  ) {
    // Configure account monitoring for simulation
    const txConfig = {
      addresses: [address.toString()],
      encoding: "base64" as const,
    };

    try {
      // Execute bundle simulation with pre/post execution account state monitoring
      const { value } = await this.jitoConnection.simulateBundle(bundle, {
        preExecutionAccountsConfigs: bundle.map((_) => txConfig),
        postExecutionAccountsConfigs: bundle.map((_) => txConfig),
      });

      return value;
    } catch (error: any) {
      throw new Error(`Failed to make simulateBundle call: ${error.message}`);
    }
  }

  /**
   * Process and validate bundle simulation response
   *
   * This method analyzes the simulation results to determine if the bundle
   * can be safely executed. It checks for transaction failures and provides
   * detailed logging for simulation-only mode.
   *
   * @param response - Raw simulation response from Jito
   * @param isSimulationOnly - Whether to provide detailed simulation output
   * @returns Object indicating simulation success/failure with message
   *
   * @private
   */
  private handleSimulateBundleResponse(
    response: any,
    isSimulationOnly: boolean
  ) {
    // Check if bundle simulation failed
    if (typeof response.summary !== "string" && response.summary.failed) {
      const { error } = response.summary.failed as any;
      if (
        error?.TransactionFailure &&
        Array.isArray(error.TransactionFailure)
      ) {
        return {
          success: false,
          message: error.TransactionFailure[1],
        };
      }
    }

    // Provide detailed simulation output if requested
    if (isSimulationOnly) {
      console.log(`Bundle simulation status: ${response.summary}`);
      for (let i = 0; i < response.transactionResults.length; i++) {
        const tx = response.transactionResults[i];
        console.log(`Transaction ${i + 1} logs:`);
        console.log(tx.logs);
        if (tx.postExecutionAccounts) {
          console.log(`Transaction ${i + 1} post execution accounts:`);
          console.log(tx.postExecutionAccounts);
        }
        if (tx.preExecutionAccounts) {
          console.log(`Transaction ${i + 1} pre execution accounts:`);
          console.log(tx.preExecutionAccounts);
        }
      }
    }

    return {
      success: true,
      message: "Bundle simulation successful",
    };
  }

  /**
   * Submit bundle to Jito's block engine for execution
   *
   * This method converts transactions to base64 format and submits the bundle
   * to Jito's infrastructure.
   *
   * @param bundle - Array of transactions to submit as a bundle
   * @returns Promise resolving to the bundle ID for tracking
   * @throws Error if bundle submission fails
   *
   * @private
   */
  private async sendBundle(
    bundle: (anchor.web3.VersionedTransaction | anchor.web3.Transaction)[]
  ) {
    try {
      // Convert transactions to base64 format for Jito API
      const base64Bundle: SendBundleParams = [
        bundle.map((tx) => convertToBase64(tx)),
        { encoding: "base64" },
      ];

      // Submit bundle with retry protection against rate limiting
      const result = await this.retry(() =>
        this.jitoClient.sendBundle(base64Bundle)
      );

      if (result.error) {
        throw new Error(result.error.message);
      }

      return result.result;
    } catch (error: any) {
      throw new Error(`Bundle sending failed: ${error.message}`);
    }
  }

  /**
   * Monitor bundle confirmation and return final execution slot
   *
   * This method tracks both individual transaction statuses and overall bundle
   * status to ensure complete execution. It is expected that transaction success be
   * confirmed within a few seconds/queries, but bundle finalization can take up to a minute.
   *
   * @param bundleId - Unique identifier for the submitted bundle
   * @param bundle - Original transaction bundle for hash extraction
   * @returns Promise resolving to the slot where bundle was finalized
   * @throws Error if bundle confirmation fails or times out
   *
   * @private
   */
  private async confirmBundle(
    bundleId: string,
    bundle: anchor.web3.VersionedTransaction[]
  ) {
    // Extract transaction hashes for individual status monitoring
    const getTxHash = (tx: anchor.web3.VersionedTransaction) => {
      return base58.encode(tx.signatures[0]);
    };

    const txHashes = bundle.map(getTxHash);

    console.log(`Bundle ID: ${bundleId}`);
    console.log("Transaction hashes:");
    console.log(txHashes);

    // Monitor both individual transaction statuses and overall bundle status
    try {
      const txStatuses = this.getTransactionStatuses(txHashes);
      const bundleStatus = this.getBundleStatus(bundleId);

      // Wait for both monitoring processes to complete
      const [_, bundleStatusFinished] = await Promise.all([
        txStatuses,
        bundleStatus,
      ]);
      return bundleStatusFinished;
    } catch (error: any) {
      throw new Error(`Bundle confirmation failed: ${error.message}`);
    }
  }

  /**
   * Monitor individual transaction statuses within the bundle
   *
   * This method polls the network to check if all transactions in the bundle
   * have been processed. It provides early failure detection and status logging.
   *
   * @param txHashes - Array of transaction hashes to monitor
   * @param timeout - Maximum time to wait for confirmation (default: 120s)
   * @returns Promise resolving to transaction statuses
   * @throws Error if transactions fail or timeout is exceeded
   *
   * @private
   */
  private async getTransactionStatuses(
    txHashes: string[],
    interval: number = 2000,
    timeout: number = 120000
  ) {
    const timestamp = Date.now();

    // Poll transaction statuses until all are confirmed or timeout
    while (Date.now() - timestamp < timeout) {
      const { value: statuses } =
        await this.jitoConnection.getSignatureStatuses(txHashes);

      let isTransactionFound = true;
      for (const status of statuses) {
        if (!status) {
          isTransactionFound = false;
          console.log("Transactions not found, waiting 2 seconds");
          break;
        }
        if (status?.err) {
          throw new Error(`Transaction failed: ${status.err}`);
        }
      }

      if (isTransactionFound) {
        console.log("Transactions successful");
        return statuses;
      }

      // Wait before next status check
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Transaction statuses not found");
  }

  /**
   * Monitor overall bundle status for finalization
   *
   * This method checks the bundle's confirmation status through Jito's API
   * to determine when the entire bundle has been finalized on the network.
   *
   * @param bundleId - Unique identifier for the bundle to monitor
   * @param timeout - Maximum time to wait for finalization (default: 120s)
   * @returns Promise resolving to the slot where bundle was finalized
   * @throws Error if bundle finalization fails or timeout is exceeded
   *
   * @private
   */
  private async getBundleStatus(bundleId: string, timeout: number = 120000) {
    const timestamp = Date.now();

    // Poll bundle status until finalized or timeout
    while (Date.now() - timestamp < timeout) {
      const status = await this.retry(() =>
        this.jitoClient.getBundleStatuses([[bundleId]])
      );

      // Bundle is found, check if it is finalized
      if (status.result?.value.length !== 0 && status.result?.value[0]) {
        const confirmationStatus = status.result?.value[0].confirmation_status;
        if (confirmationStatus === "finalized") {
          return status.result?.value[0].slot;
        }
      }

      console.log("Bundle not finalized, waiting 5 seconds");
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }

    throw new Error("Bundle status not finalized, may have failed");
  }

  /**
   * Estimate tip amount for bundle priority
   *
   * This method fetches recent tip data from Jito's API to determine
   * the appropriate tip amount for maximizing bundle execution priority.
   * Falls back to a default value if API estimation fails.
   *
   * @returns Promise resolving to estimated tip amount in lamports
   *
   * @example
   * ```typescript
   * const tip = await jito.estimateTipAmount();
   * console.log(`Estimated tip: ${tip} lamports`);
   * ```
   */
  public async estimateTipAmount(): Promise<number> {
    let tip = JITO_FALLBACK_TIP;

    try {
      // Get recent tip data from Jito's API for dynamic estimation
      tip = (await this.getRecentTipData()) * anchor.web3.LAMPORTS_PER_SOL;
    } catch (error) {
      console.warn(`Failed to estimate tip: ${error.message}`);
      console.log("Using fallback value for tip:", JITO_FALLBACK_TIP);
    }

    return tip;
  }

  /**
   * Fetch recent tip data from Jito's tip floor API
   *
   * This method retrieves the 95th percentile of landed tips to help
   * estimate appropriate tip amounts for bundle priority. The 95th percentile
   * is selected to ensure inclusion in the block.
   *
   * @returns Promise resolving to tip amount in SOL
   * @throws Error if API request fails
   *
   * @private
   */
  private async getRecentTipData(): Promise<number> {
    try {
      const response = await fetch(JITO_TIP_RPC_URL, {
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        return data[0]["landed_tips_95th_percentile"];
      } else {
        throw new Error(response.statusText);
      }
    } catch (error: any) {
      throw new Error(`Failed to fetch tips from Jito API: ${error.message}`);
    }
  }

  /**
   * Get default tip accounts for bundle submission
   *
   * These are pre-configured tip accounts that receive priority fees
   * to incentivize validators to include the bundle in their blocks.
   *
   * @returns Array of tip account public keys
   *
   * @private
   */
  private getDefaultTipAccounts(): string[] {
    return [
      "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
      "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
      "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
      "ADuUkR4vqLUMWXxW9gh6D6L8pMSawimctcNZ5pGwDcEt",
      "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
      "HFqU5x63VTqvQss8hp11i4wVV8bD44PvwucfZ2bU7gRe",
      "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
      "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    ];
  }

  /**
   * Get a random tip account to reduce contention
   *
   * This method randomly selects one of the default tip accounts to
   * distribute load and reduce contention for the same tip accounts.
   *
   * @returns Randomly selected tip account public key
   *
   * @example
   * ```typescript
   * const tipAccount = jito.getRandomTipAccount();
   * console.log(`Selected tip account: ${tipAccount}`);
   * ```
   */
  public getRandomTipAccount(): string {
    const tipAccounts = this.getDefaultTipAccounts();
    const randomIndex = Math.floor(Math.random() * tipAccounts.length);
    return tipAccounts[randomIndex];
  }

  /**
   * Retry mechanism to handle Jito's rate limiting
   *
   * This method implements exponential backoff retry logic specifically
   * designed to handle Jito's rate limiting (HTTP 429 responses). It
   * automatically retries failed requests with increasing delays.
   *
   * @param fn - Function to retry
   * @param initialDelay - Initial delay in milliseconds (default: 1000ms)
   * @param delayMultiplier - Multiplier for delay increase (default: 2x)
   * @param timeout - Maximum total retry time in milliseconds (default: 120s)
   * @returns Promise resolving to function result
   * @throws Error if function fails after all retries or timeout exceeded
   *
   * @private
   */
  private async retry<T>(
    fn: () => Promise<T>,
    initialDelay: number = 1000,
    delayMultiplier: number = 2,
    timeout: number = 120000
  ): Promise<T> {
    let delay = initialDelay;
    const timestamp = Date.now();

    // Retry loop with exponential backoff
    while (Date.now() - timestamp < timeout) {
      try {
        return await fn();
      } catch (error: any) {
        if (error.status !== 429) {
          // Non-rate-limit error, don't retry
          throw new Error(error);
        }

        // Rate limit exceeded, wait and retry with exponential backoff
        console.log(`Rate limit exceeded, waiting ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= delayMultiplier;
      }
    }

    throw new Error("Retry timeout exceeded");
  }
}
