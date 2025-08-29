import * as borsh from "@coral-xyz/borsh";
import * as anchor from "@coral-xyz/anchor";
import {
  AddedAccount,
  CONFIG_SEED,
  VAULT_CONFIG_SEED,
  VAULT_PROGRAM_ID,
  DKIM_CONFIG_SEED,
  DKIM_ENTRY_SEED,
} from "./consts";
import { SMART_ACCOUNT_SOLANA_PROGRAM_ID } from "./consts";
import { DKIM_KEY_ORACLE_PROGRAM_ID } from "./consts";

export type GlobalConfig = {
  discriminator: Uint8Array;
  //utilities
  bump: number;
  //business logic related
  admin: anchor.web3.PublicKey;
  creator: anchor.web3.PublicKey;
  webauthnModerator: anchor.web3.PublicKey;
};

export type VaultConfig = {
  discriminator: Uint8Array;
  bump: number;
  admin: anchor.web3.PublicKey;
  authorizedPrograms: Array<anchor.web3.PublicKey>;
};

export type Permissions = {
  mask: number;
};

export type Member = {
  key: anchor.web3.PublicKey;
  permissions: Permissions;
};

export type DkimOracleConfig = {
  discriminator: Uint8Array;
  admin: anchor.web3.PublicKey;
  timelockDuration: anchor.BN;
  members: Array<Member>;
};

export const configSchema = borsh.struct([
  borsh.array(borsh.u8(), 8, "discriminator"),
  borsh.u8("bump"),
  borsh.publicKey("admin"),
  borsh.publicKey("creator"),
  borsh.publicKey("webauthnModerator"),
]);

export const vaultConfigSchema = borsh.struct([
  borsh.array(borsh.u8(), 8, "discriminator"),
  borsh.u8("bump"),
  borsh.publicKey("admin"),
  borsh.vec(borsh.publicKey(), "authorizedPrograms"),
]);

export const permissionsSchema = borsh.struct([borsh.u8("mask")]);

export const memberSchema = borsh.struct([
  borsh.publicKey("key"),
  borsh.struct([borsh.u8("mask")], "permissions"),
]);

export const dkimOracleConfigSchema = borsh.struct([
  borsh.array(borsh.u8(), 8, "discriminator"),
  borsh.publicKey("admin"),
  borsh.u64("timelockDuration"),
  borsh.vec(memberSchema, "members"),
]);

export const dkimEntrySchema = borsh.struct([
  borsh.array(borsh.u8(), 8, "discriminator"),
  borsh.bool("valid"),
]);

export function mockVaultConfigData(
  admin: anchor.web3.PublicKey,
  authorizedPrograms: Array<anchor.web3.PublicKey>
): AddedAccount {
  let [vaultConfigAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED)],
    VAULT_PROGRAM_ID
  );
  let discriminator = new Uint8Array([99, 86, 43, 216, 184, 102, 119, 77]);
  let mockVaultConfig: VaultConfig = {
    discriminator,
    bump,
    admin,
    authorizedPrograms,
  };

  //create oversized buffer
  let b = Buffer.alloc(1024);
  let length = vaultConfigSchema.encode(mockVaultConfig, b);

  try {
    let dataBuffer = b.subarray(0, length);
    return {
      address: vaultConfigAccount,
      info: {
        lamports: 1_000_000,
        data: dataBuffer,
        owner: VAULT_PROGRAM_ID,
        executable: false,
      },
    };
  } catch (error) {
    console.error("Error during array slicing:", error);
    throw error;
  }
}

export function mockConfigData(
  admin: anchor.web3.PublicKey,
  creator: anchor.web3.PublicKey,
  webauthnModerator: anchor.web3.PublicKey
): AddedAccount {
  let [configAccount, bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    SMART_ACCOUNT_SOLANA_PROGRAM_ID
  );
  let discriminator = new Uint8Array([155, 12, 170, 224, 30, 250, 204, 130]);

  let mockConfig: GlobalConfig = {
    discriminator,
    bump,
    admin,
    creator,
    webauthnModerator,
  };

  //create oversized buffer
  let b = Buffer.alloc(1024);
  let length = configSchema.encode(mockConfig, b);

  try {
    let dataBuffer = b.subarray(0, length);
    return {
      address: configAccount,
      info: {
        lamports: 1_000_000,
        data: dataBuffer,
        owner: SMART_ACCOUNT_SOLANA_PROGRAM_ID,
        executable: false,
      },
    };
  } catch (error) {
    console.error("Error during array slicing:", error);
    throw error;
  }
}

export function mockDkimOracleConfigData(
  admin: anchor.web3.PublicKey,
  timelockDuration: anchor.BN
) {
  let [configAccount, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(DKIM_CONFIG_SEED)],
    DKIM_KEY_ORACLE_PROGRAM_ID
  );
  // Discriminator for DkimOracleConfig (from IDL or Anchor, e.g. [77, 209, 106, 247, 38, 228, 183, 230])
  let discriminator = new Uint8Array([77, 209, 106, 247, 38, 228, 183, 230]);
  let mockConfig: DkimOracleConfig = {
    discriminator,
    admin,
    timelockDuration,
    members: [],
  };
  let b = Buffer.alloc(1024);
  let length = dkimOracleConfigSchema.encode(mockConfig, b);
  try {
    let dataBuffer = b.subarray(0, length);
    return {
      address: configAccount,
      info: {
        lamports: 1_000_000,
        data: dataBuffer,
        owner: DKIM_KEY_ORACLE_PROGRAM_ID,
        executable: false,
      },
    };
  } catch (error) {
    console.error("Error during array slicing:", error);
    throw error;
  }
}

export function mockDkimOracleEntryData(
  domainHash: Buffer | Uint8Array,
  keyHash: Buffer | Uint8Array
): AddedAccount {
  let [entryAccount, _bump] = anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(DKIM_ENTRY_SEED),
      Buffer.from(domainHash),
      Buffer.from(keyHash),
    ],
    DKIM_KEY_ORACLE_PROGRAM_ID
  );
  // Discriminator for DkimEntry: [92,252,178,13,38,23,186,239]
  let discriminator = new Uint8Array([92, 252, 178, 13, 38, 23, 186, 239]);
  let mockEntry = {
    discriminator,
  };
  let b = Buffer.alloc(1024);
  let length = dkimEntrySchema.encode(mockEntry, b);
  try {
    let dataBuffer = b.subarray(0, length);
    return {
      address: entryAccount,
      info: {
        lamports: 1_000_000,
        data: dataBuffer,
        owner: DKIM_KEY_ORACLE_PROGRAM_ID,
        executable: false,
      },
    };
  } catch (error) {
    console.error("Error during array slicing:", error);
    throw error;
  }
}
