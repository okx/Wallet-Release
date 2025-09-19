import * as anchor from "@coral-xyz/anchor";

//seeds
export const CONFIG_SEED = "config";
export const SMART_ACCOUNT_SEED = "smart_account";
export const SMART_ACCOUNT_VAULT_SEED = "smart_account_vault";
export const VAULT_STATE_SEED = "vault_state";
export const VAULT_CONFIG_SEED = "vault_config";
export const DKIM_ENTRY_SEED = "entry";
export const PROPOSAL_SEED = "proposal";
export const DKIM_CONFIG_SEED = "dkim_config";
export const WEB_AUTHN_TABLE_SEED = "webauthn_table";
export const ORIGIN = "https://example.com";
export const ANDROID_PACKAGE_NAME = "com.okinc.okex.gp";
export const PRE_JSON = '{"type":"webauthn.get"';
export const POST_JSON = `"origin":"${ORIGIN}","androidPackageName":"${ANDROID_PACKAGE_NAME}"}`;

//rpc urls
export const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
// export const SOLANA_RPC_URL = "https://api.mainnet-beta.solana.com";
export const BASE_RPC_URL = "https://mainnet.base.org";
export const BNB_CHAIN_RPC_URL = "https://bsc-dataseed.binance.org";
export const XLAYER_RPC_URL = "https://mainnet.xlayer-rpc.com";
//solana lookup table address
export const LOOKUP_TABLE_ADDRESS = "Gjj1dX4UR6HcXGDm48wJHCZjompq5SJ6eKse1Trfq6Qe";

//public keys
export const USDC_MINT = new anchor.web3.PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

export const USDT_MINT = new anchor.web3.PublicKey(
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB"
);

export const WSOL_MINT = new anchor.web3.PublicKey(
  "So11111111111111111111111111111111111111112"
);

export const PYUSD_MINT = new anchor.web3.PublicKey(
  "2b1kV6DkPAnxd5ixfnxCpjxmKwqjjaYmCZfHsFu24GXo"
);

export const JITOSOL_MINT = new anchor.web3.PublicKey(
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"
);

export const BSOL_MINT = new anchor.web3.PublicKey(
  "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1"
);

export const MINT_$CWIF = new anchor.web3.PublicKey(
  "7atgF8KQo4wJrD5ATGX7t1V2zVvykPJbFfNeVf1icFv1"
);

export const RAY_MINT = new anchor.web3.PublicKey(
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
);

export const RAYDIUM_CPMM_PROGRAM_ID = new anchor.web3.PublicKey(
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C"
);

export const WHIRLPOOL_PROGRAM_ID = new anchor.web3.PublicKey(
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc"
);

export const UPGRADEABLE_LOADER_PROGRAM_ID = new anchor.web3.PublicKey(
  "BPFLoaderUpgradeab1e11111111111111111111111"
);

// //localnet
// export const SMART_ACCOUNT_SOLANA_PROGRAM_ID = new anchor.web3.PublicKey(
//   "8CfU477AfpF2ttCoxiF7s9Tdbmsvh9A8NauonsUGujuU"
// );
// export const VAULT_PROGRAM_ID = new anchor.web3.PublicKey(
//   "A7CsUmonBupSwmfAwzavwTnPEZbqfryWG8qSfkFmUMwB"
// );
// //devnet
// export const SMART_ACCOUNT_SOLANA_PROGRAM_ID = new anchor.web3.PublicKey(
//   "DXkuJYJfne9v7vc85361VvdhGezJ6ynMA6oLXYC4qiSp"
// );
// export const VAULT_PROGRAM_ID = new anchor.web3.PublicKey(
//   "L69twvAN6711ojwdei5Zkj9rQ6bpjzND2Xrmx6fWqWu"
// );
// mainnet
export const SMART_ACCOUNT_SOLANA_PROGRAM_ID = new anchor.web3.PublicKey(
  "sa12qbQyuQqEaDcEqEPKmZEGTdzSMaqj87nKRYbE3QE"
);
export const VAULT_PROGRAM_ID = new anchor.web3.PublicKey(
  "va1t8sdGkReA6XFgAeZGXmdQoiEtMirwy4ifLv7yGdH"
);

export const ZK_EMAIL_VERIFIER_PROGRAM_ID = new anchor.web3.PublicKey(
  "5ZWpsrh3afwUcbuiX6m1LwCriFFqtKnTf8DkJjvUfYb9"
);

export const UPGRADE_MOCK_PROGRAM_ID = new anchor.web3.PublicKey(
  "tqVoUexaDpW35SukukXhMXhtWC1n1PBJq8riiiBZf8R"
);

export const DKIM_KEY_ORACLE_PROGRAM_ID = new anchor.web3.PublicKey(
  "FXo8XW4G5qTzR9G4EnRcQGDBwJ2EciWfni57gV2pLL7w"
);

//DEX RELATED
export const METEORA_PROGRAM_ID = new anchor.web3.PublicKey(
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB"
);

export const METEORA_VAULT_PROGRAM_ID = new anchor.web3.PublicKey(
  "24Uqj9JCLxUeoC3hGfh5W3s9FM9uCHDS2SG3LYwBpyTi"
);

// custom types
export type AddedAccount = {
  address: anchor.web3.PublicKey;
  info: unknown;
};

export const LAMPORTS_PER_SIGNER = 5000;
export const MICRO_LAMPORTS_PER_LAMPORT = 1_000_000;

export const SPL_tokenChoices = [
  { name: 'WSOL', value: WSOL_MINT },
  { name: 'USDC', value: USDC_MINT },
  { name: 'USDT', value: USDT_MINT },
  { name: 'PYUSD', value: PYUSD_MINT },
  { name: 'JITOSOL', value: JITOSOL_MINT },
  { name: 'BSOL', value: BSOL_MINT },
  { name: 'CWIF', value: MINT_$CWIF },
  { name: 'RAY', value: RAY_MINT },
  { name: 'Custom address', value: 'custom' }
];
