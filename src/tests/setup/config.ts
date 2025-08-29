import {
  getAssociatedTokenAddressSync,
  AccountLayout,
  ACCOUNT_SIZE,
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
} from "@solana/spl-token";
import * as anchor from "@coral-xyz/anchor";
import { Connection, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { AddedAccount, USDC_MINT, USDT_MINT, WSOL_MINT } from "../utils/consts";

import * as dotenv from "dotenv";
dotenv.config();

let cachedMainnetAccounts: AddedAccount[] | null = null;

const GENESIS_ACCOUNTS = [USDC_MINT, USDT_MINT, WSOL_MINT];

export async function getInitialAccounts(
  solAccounts: anchor.web3.PublicKey[]
): Promise<AddedAccount[]> {
  let initialAccounts: AddedAccount[] = [];
  //airdrop sol
  console.log("airdropping sol..");
  for (var account of solAccounts) {
    initialAccounts.push(prefundAccount(account, 10_000));
  }

  //add token account
  console.log("loading token accounts..");
  initialAccounts.push(getMockUsdcATA(BigInt(1000 * LAMPORTS_PER_SOL)));
  initialAccounts.push(getMockWsolATA(BigInt(1000 * LAMPORTS_PER_SOL)));

  //add mainnet accounts
  return initialAccounts.concat(await pullMainnetAccounts());
}

export async function pullMainnetAccounts(): Promise<AddedAccount[]> {
  console.log("loading mainnet accounts..");
  if (cachedMainnetAccounts) {
    console.log("using cached accounts..");
    return cachedMainnetAccounts;
  }
  if (!process.env.RPC_URL) {
    throw new Error("RPC_URL environment variable is not set");
  }
  const connection = new Connection(process.env.RPC_URL);
  console.log("pulling mainnet accounts..");
  cachedMainnetAccounts = [];
  for (let i = 0; i < GENESIS_ACCOUNTS.length; i++) {
    cachedMainnetAccounts.push({
      address: GENESIS_ACCOUNTS[i],
      info: await connection.getAccountInfo(GENESIS_ACCOUNTS[i]),
    });
    //prevent rate limit from rpc provider
    await sleep(100);
  }
  return cachedMainnetAccounts;
}

export function prefundAccount(
  account: PublicKey,
  amount_sol: number
): AddedAccount {
  return {
    address: account,
    info: {
      lamports: amount_sol * anchor.web3.LAMPORTS_PER_SOL,
      data: Buffer.alloc(0),
      owner: anchor.web3.SystemProgram.programId,
      executable: false,
    },
  };
}

function getMockUsdcATA(amount: bigint): AddedAccount {
  return MockATA(
    (anchor.AnchorProvider.env().wallet as anchor.Wallet).payer.publicKey,
    WSOL_MINT,
    amount,
    false
  );
}
function getMockWsolATA(amount: bigint): AddedAccount {
  return MockATA(
    (anchor.AnchorProvider.env().wallet as anchor.Wallet).payer.publicKey,
    USDC_MINT,
    amount,
    false
  );
}

export function MockATA(
  owner: anchor.web3.PublicKey,
  mint: anchor.web3.PublicKey,
  amount: bigint,
  is2022: boolean,
  allowOwnerOffCurve: boolean = false
): AddedAccount {
  const ata = is2022
    ? getAssociatedTokenAddressSync(
        mint,
        owner,
        allowOwnerOffCurve,
        TOKEN_2022_PROGRAM_ID
      )
    : getAssociatedTokenAddressSync(mint, owner, allowOwnerOffCurve);
  const tokenAccData = Buffer.alloc(ACCOUNT_SIZE);
  AccountLayout.encode(
    {
      mint: mint,
      owner: owner,
      amount: amount,
      delegateOption: 0,
      delegate: anchor.web3.PublicKey.default,
      delegatedAmount: BigInt(0),
      state: 1,
      isNativeOption: 0,
      isNative: BigInt(0),
      closeAuthorityOption: 0,
      closeAuthority: anchor.web3.PublicKey.default,
    },
    tokenAccData
  );

  return {
    address: ata,
    info: {
      lamports: 1_000_000_000,
      data: tokenAccData,
      owner: is2022 ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID,
      executable: false,
    },
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
