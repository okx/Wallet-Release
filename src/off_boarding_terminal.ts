import inquirer from "inquirer";
import dotenv from "dotenv";
import { ethers, Contract, Transaction as EthersTransaction } from "ethers";
import {
  Connection,
  Keypair,
  PublicKey,
  clusterApiUrl,
  Transaction,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
  SystemProgram,
} from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";
import { cleanEnvironmentVariables, parseBase58SecretKeyToUint8Array, parseSolanaKeypair } from "./utils";
import { BaseSmartAccountExecutor } from "./base_smart_account_executor";
import evmExecuteABI from "./evmExecuteABI.json";
import { SOLANA_RPC_URL, BASE_RPC_URL, BSC_RPC_URL, XLAYER_RPC_URL } from "./consts";
import { getSAId } from "./utils";

dotenv.config();

type SupportedChain = "Solana" | "Base" | "BSC" | "xLayer";

const DEFAULT_RPCS: Record<SupportedChain, string> = {
  Solana: SOLANA_RPC_URL,
  Base: BASE_RPC_URL,
  BSC: BSC_RPC_URL,
  xLayer: XLAYER_RPC_URL,
};

const main = async () => {
  console.log("--- Welcome to the Off-Boarding Tool ---");
  console.log("A standalone CLI to manage assets off-boarding.\n");

  try {
    const { chain } = await inquirer.prompt([
      {
        type: "list",
        name: "chain",
        message: "Select chain",
        choices: ["Solana", "Base", "BSC", "xLayer"],
      },
    ]);
    const rpcUrl = DEFAULT_RPCS[chain as SupportedChain];
    console.log("Connected RPC URL: ", rpcUrl);

    if (chain === "Solana") {
      // Load private key into a Buffer for secure cleanup

      const connection = new Connection(rpcUrl, "confirmed");
      
      let keypair: Keypair;
      const secretKeyString = parseBase58SecretKeyToUint8Array(process.env.SOL_EOA_PRIVATE_KEY);
      keypair = parseSolanaKeypair(secretKeyString);

      const provider = new anchor.AnchorProvider(
        connection,
        new anchor.Wallet(keypair),
        { preflightCommitment: "confirmed" }
      );

      console.log(`\nWallet loaded successfully.`);
      console.log(`Your address: ${keypair.publicKey.toBase58()}\n`);

      const AAWalletAddress = process.env.SOL_DEXTRADING_ADDRESS || "";
      if (!AAWalletAddress) {
        console.error("SOL_DEXTRADING_ADDRESS is not set in the environment variables.");
        return;
      }

      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: ["Send Transaction", "Exit"],
          },
        ]);

        if (action === "Exit") break;
        switch (action) {
          case "Send Transaction":
            await sendTransactionSolana(AAWalletAddress, keypair, provider);
            break;
        }
      }
    } else {
      // Load EVM private key into Buffer for secure cleanup
      let privateKeyBuf = Buffer.from(process.env.EVM_EOA_PRIVATE_KEY || "", 'utf8');
      const fetchReq = new ethers.FetchRequest(rpcUrl);
      const provider = new ethers.JsonRpcProvider(fetchReq);
      const AAWalletAddress = process.env.EVM_DEXTRADING_ADDRESS || "";
      
      let wallet: ethers.Wallet;
      try {
        wallet = new ethers.Wallet(privateKeyBuf.toString(), provider);
      } catch (error) {
        console.error(
          "\nℹ️ Error: Invalid private key provided. Please check and try again."
        );
        return;
      } finally {
        // Wipe the buffer after wallet creation (but keep env var for CLI session)
        privateKeyBuf.fill(0);
        privateKeyBuf = Buffer.alloc(0);
      }
      console.log(`\nWallet loaded successfully.`);
      console.log(`Your EOA address: ${wallet.address}`);

      while (true) {
        const { action } = await inquirer.prompt([
          {
            type: "list",
            name: "action",
            message: "What would you like to do?",
            choices: ["Send Transaction", "Exit"],
          },
        ]);
        if (action === "Exit") break;
        switch (action) {
          case "Send Transaction":
            await sendTransactionEvm(wallet, AAWalletAddress);
            break;
        }
      }
    }
  } catch (error: any) {
    console.error("\nAn unexpected error occurred:", error.message);
  } 
  cleanEnvironmentVariables();
  console.log("\nThank you for using the EscapeTool. Exiting now.");
};

// --- EVM Operations ---
const sendTransactionEvm = async (
  wallet: ethers.Wallet,
  AAWalletAddress: string
) => {
  console.log("\n--- Transfer Tokens ---");

  // 1. Get user inputs
  const { assetType } = await inquirer.prompt([
    {
      type: "list",
      name: "assetType",
      message: "Select asset type to transfer:",
      choices: ["Native Token", "ERC20 Token"],
    },
  ]);

  let tokenAddress: string = "";
  if (assetType === "ERC20 Token") {
    const tokenPrompt = await inquirer.prompt([
      {
        type: "input",
        name: "tokenAddress",
        message: "Enter the ERC20 token contract address:",
        validate: (input) =>
          ethers.isAddress(input) || "Please enter a valid contract address.",
      },
    ]);
    tokenAddress = tokenPrompt.tokenAddress;
  }

  const { address: to } = await inquirer.prompt([
    {
      type: "input",
      name: "address",
      message: "Enter the receiver address:",
      validate: (input) =>
        ethers.isAddress(input) || "Please enter a valid EVM address.",
    },
  ]);

  const { amount } = await inquirer.prompt([
    {
      type: "input",
      name: "amount",
      message: "Enter the amount to send:",
      validate: (input) =>
        !isNaN(Number(input)) || "Please enter a valid number.",
    },
  ]);

  // 2. Check balance before forming instructions
  let calls: Array<{ target: string; value: bigint; data: string }> = [];

  if (assetType === "Native Token") {
    // --- Native token balance check ---
    const balance = await wallet.provider!.getBalance(AAWalletAddress);
    const requiredAmount = ethers.parseEther(amount);
    
    console.log(`💰 AA Wallet Balance: ${ethers.formatEther(balance)} Native Token`);
    console.log(`💸 Transfer Amount: ${amount} Native Token`);
    
    if (balance < requiredAmount) {
      console.error(`❌ Insufficient balance! Need ${amount}, have ${ethers.formatEther(balance)}`);
      return;
    }

    // --- Native token transfer path ---
    const value = ethers.parseEther(amount);
    calls = [{ target: to, value, data: "0x" }];
  } else {
    // --- ERC20 token transfer path ---
    
    //Prepare ERC20 universal interface (transfer & decimals)
    const erc20Iface = new ethers.Interface([
      "function transfer(address to,uint256 amount) external returns (bool)",
      "function decimals() view returns (uint8)",
    ]);

    const tokenContract = new Contract(tokenAddress, erc20Iface, wallet);

    //Determine token decimals (ask user if on-chain call fails)
    let decimals: number = 18;
    try {
      decimals = await tokenContract.decimals();
      console.log("decimals", decimals);
    } catch (_) {
      const { manualDecimals } = await inquirer.prompt([
        {
          type: "input",
          name: "manualDecimals",
          message:
            "Could not fetch token decimals automatically. Please enter token decimals:",
          validate: (input) =>
            !isNaN(Number(input)) || "Please enter a valid number.",
        },
      ]);
      decimals = Number(manualDecimals);
    }

    // Check ERC20 token balance
    const erc20BalanceIface = new ethers.Interface([
      "function balanceOf(address owner) view returns (uint256)"
    ]);
    const balanceContract = new Contract(tokenAddress, erc20BalanceIface, wallet);
    
    try {
      const balance = await balanceContract.balanceOf(AAWalletAddress);
      const requiredAmount = ethers.parseUnits(amount, decimals);

      console.log(`💰 AA Wallet Token Balance: ${ethers.formatUnits(balance, decimals)} tokens`);
      console.log(`💸 Transfer Amount: ${amount} tokens`);
      
      if (balance < requiredAmount) {
        console.error(`❌ Insufficient token balance! Need ${amount}, have ${ethers.formatUnits(balance, decimals)}`);
        return;
      }
    } catch (err) {
      console.warn(`⚠️ Could not check token balance: ${err}`);
    }

    //Encode transfer call data
    const amtInBaseUnits = ethers.parseUnits(amount, decimals);

    const data = erc20Iface.encodeFunctionData("transfer", [
      to,
      amtInBaseUnits,
    ]);

    calls = [{ target: tokenAddress, value: 0n, data }];
  }

  //3. Create contract with signer
  const contractWithSigner = new Contract(
    AAWalletAddress,
    evmExecuteABI,
    wallet
  );

  //4. Estimate Gas Fee 
  try {
    const gasEstimate: bigint = await (contractWithSigner.execute as any).estimateGas(calls);
    const feeData = await wallet.provider!.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (gasPrice) {
      const estimatedFee = gasEstimate * gasPrice;
      console.log(`📝 Estimated fee: ${ethers.formatEther(estimatedFee)} ETH (gas: ${gasEstimate}, gasPrice: ${ethers.formatUnits(gasPrice, "gwei")} gwei)`);
    }
  } catch (err) {
    console.warn("⚠️  Could not estimate gas fee:", (err as any).message || err);
  }

  // Confirmation prompt
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Do you want to proceed with the transaction?",
      default: false,
    },
  ]);

  if (!confirm) {
    console.log("❌ Transaction cancelled by user.");
    return;
  }

  try {
    //5. Execute via AA wallet
    const tx = await contractWithSigner.execute(calls);
    console.log(`✅ Transaction sent: ${tx.hash}`);
  } catch (err: any) {
    console.error("❌ Transaction failed:", err.reason || err.message);
  }
};

// --- Solana Operations ---
const sendTransactionSolana = async (
  AAWalletAddress: string,
  keypair: Keypair,
  provider: anchor.AnchorProvider
) => {
  console.log("\n--- Transfer Tokens ---");

  //1. Get user input
  const { assetType } = await inquirer.prompt([
    {
      type: "list",
      name: "assetType",
      message: "Select asset type to transfer:",
      choices: ["Native SOL", "SPL Token"],
    },
  ]);

  let tokenMintAddress: string = "";
  if (assetType === "SPL Token") {
    const tokenPrompt = await inquirer.prompt([
      {
        type: "input",
        name: "mintAddress",
        message: "Enter the SPL token mint address:",
        validate: (input) => {
          try {
            new PublicKey(input);
            return true;
          } catch {
            return "Please enter a valid Solana address.";
          }
        },
      },
    ]);
    tokenMintAddress = tokenPrompt.mintAddress;
  }

  const {address: recipientAddress} = await inquirer.prompt([
    {
      type: "input",
      name: "address",
      message: "Enter the recipient address:",
      validate: (input) =>
        PublicKey.isOnCurve(input) || "Please enter a valid Solana address.",
    },
  ]);
  const recipientPubkey = new PublicKey(recipientAddress);

  const { value: transferAmountRaw } = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: "Enter the amount to transfer:",
      validate: (input) => !isNaN(Number(input)) && Number(input) >= 0 || "Please enter a valid number.",
    },
  ]);
  const transferAmount = Number(transferAmountRaw);

  let instructions: TransactionInstruction[] = [];
  const saId = await getSAId(AAWalletAddress,keypair);
  const executor = new BaseSmartAccountExecutor(saId);
  const vaultPda = executor.smartAccountHelper.getVaultPda();

  //2. form instructions to transfer SOL or SPL token
  if (assetType === "Native SOL") {
    // ---------------- Native SOL transfer ----------------
    const balance = await provider.connection.getBalance(vaultPda);
    console.log(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    if (balance < transferAmount * LAMPORTS_PER_SOL) {
      console.error("ℹ️ Insufficient balance in vault");
      return;
    }
    
    // const { vaultProgram } = loadEnv(); // vault program handle
    // const vaultTransferSolIx = await vaultProgram.methods
    //   .vaultTransferSol(new anchor.BN(transferAmount * LAMPORTS_PER_SOL)) // lamports
    //   .accountsPartial({
    //     vaultState: executor.smartAccountHelper.vaultState,
    //     smartAccountVault: vaultPda,
    //     smartAccount: executor.smartAccountHelper.sa, // signer PDA
    //     recipient: recipientPubkey,
    //   })
    //   .instruction();
    
    const vaultTransferSolIx = await SystemProgram.transfer({
      fromPubkey: vaultPda,
      toPubkey: recipientPubkey,
      lamports: BigInt(transferAmount * LAMPORTS_PER_SOL),
    });

    instructions = [vaultTransferSolIx];
  } else {
    // ---------------- SPL Token transfer ----------------
    const tokenMintPubkey = new PublicKey(tokenMintAddress);
    const vaultTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      executor.smartAccountHelper.vault,
      true,
      TOKEN_PROGRAM_ID
    );

    // Check token balance of vault
    let initialVaultBalance: number = 0;
    let decimals = 0;
    try {
      const vaultAccount = await provider.connection.getTokenAccountBalance(
        vaultTokenAccount
      );
      decimals = vaultAccount.value.decimals;
      const initialVaultBalanceTokens = ethers.formatUnits(
        BigInt(vaultAccount.value.amount),
        decimals
      );
      initialVaultBalance = Number(initialVaultBalanceTokens);
    } catch (_) {
      console.log("ℹ️ Vault token account not found - balance is 0");
    }

    console.log(
      `💳 Vault token account balance: ${initialVaultBalance.toString()}`);

    if (initialVaultBalance < transferAmount) {
      console.error("ℹ️ Insufficient balance in vault token account");
      return;
    }
    const recipientTokenAccount = getAssociatedTokenAddressSync(
      tokenMintPubkey,
      recipientPubkey,
      true,
      TOKEN_PROGRAM_ID
    );
    
    // amount in smallest units
    const amountInBaseUnits = ethers.parseUnits(transferAmountRaw.toString(), decimals);
    
    const createVaultAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      vaultPda,
      vaultTokenAccount,
      vaultPda,
      tokenMintPubkey,
      TOKEN_PROGRAM_ID
    )

    const createRecipientAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      vaultPda,
      recipientTokenAccount,
      recipientPubkey,
      tokenMintPubkey,
      TOKEN_PROGRAM_ID
    )

    const transferIx = createTransferInstruction(
      vaultTokenAccount,
      recipientTokenAccount,
      vaultPda,
      Number(amountInBaseUnits),
      [],
      TOKEN_PROGRAM_ID
    )

    //create recipient ata if recipient is not the payer
    if (recipientPubkey.toBase58() != executor.payerInfo.keyObject.publicKey.toBase58()) {
      instructions.push(createRecipientAtaIx);
    }

    instructions = [
      createVaultAtaIx,
      transferIx,
    ];
  }

  //3. Execute transaction
  // --- Estimate Fee (SOL) ---
  try {
    const { blockhash } = await provider.connection.getLatestBlockhash();
    const feeTx = new Transaction({ feePayer: keypair.publicKey, recentBlockhash: blockhash }).add(...instructions);
    const feeInfo = await provider.connection.getFeeForMessage(feeTx.compileMessage());
    if (feeInfo && feeInfo.value) {
      const lamportsFee = feeInfo.value;
      console.log(`📝 Estimated fee: ${lamportsFee} lamports (~${lamportsFee / LAMPORTS_PER_SOL} SOL)`);
    }
  } catch (err) {
    console.warn("⚠️  Could not estimate Solana fee:", (err as any).message || err);
  }

  // Confirmation prompt
  const { confirm } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirm",
      message: "Do you want to proceed with the transaction?",
      default: false,
    },
  ]);

  if (!confirm) {
    console.log("❌ Transaction cancelled by user.");
    return;
  }

  try {
    await executor.execute(instructions, "off-boarding token transfer", [], [], transferAmount * LAMPORTS_PER_SOL, recipientPubkey, assetType);
  } catch (err: any) {
    console.error("❌ Transaction failed:", err.reason || err.message);
  }
};

main();
