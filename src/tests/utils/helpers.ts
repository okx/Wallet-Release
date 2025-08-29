import * as anchor from "@coral-xyz/anchor";
import {
  CONFIG_SEED,
  DKIM_KEY_ORACLE_PROGRAM_ID,
  SMART_ACCOUNT_SEED,
  SMART_ACCOUNT_VAULT_SEED,
  VAULT_STATE_SEED,
  SMART_ACCOUNT_SOLANA_PROGRAM_ID,
  VAULT_CONFIG_SEED,
  VAULT_PROGRAM_ID,
  DKIM_ENTRY_SEED,
  PROPOSAL_SEED,
  DKIM_CONFIG_SEED,
  WEB_AUTHN_TABLE_SEED,
} from "./consts";
import * as crypto from "crypto";
import {
  AddressLookupTableAccount,
  Connection,
  PublicKey,
} from "@solana/web3.js";

// Function to fetch the upgrade authority
async function getUpgradeAuthority(
  programId: anchor.web3.PublicKey,
  provider: anchor.Provider
) {
  const programDataAddress = await anchor.web3.PublicKey.findProgramAddressSync(
    [programId.toBuffer()],
    new anchor.web3.PublicKey("BPFLoaderUpgradeab1e11111111111111111111111")
  )[0];

  const programDataAccountInfo =
    await provider.connection.getAccountInfo(programDataAddress);

  if (!programDataAccountInfo) {
    throw new Error("Program data account not found");
  }

  // Decode the account info
  const programData = anchor.utils.bytes.utf8.decode(
    programDataAccountInfo.data
  );

  // The upgrade authority is at the end of the account data
  // Depending on your program, you might need to adjust the offset
  const upgradeAuthorityPubkey = new anchor.web3.PublicKey(
    programData.slice(8, 40)
  );

  return upgradeAuthorityPubkey;
}

export function getConfigAccount(
  programId: anchor.web3.PublicKey = SMART_ACCOUNT_SOLANA_PROGRAM_ID
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(CONFIG_SEED)],
    programId
  )[0];
}

export function getVaultConfigAccount(): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_CONFIG_SEED)],
    VAULT_PROGRAM_ID
  )[0];
}

export function getSmartAccount(
  id: string | number[],
  programId: anchor.web3.PublicKey = SMART_ACCOUNT_SOLANA_PROGRAM_ID
): anchor.web3.PublicKey {
  const idBuffer = typeof id === "string" ? Buffer.from(id) : Buffer.from(id);
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(SMART_ACCOUNT_SEED), idBuffer],
    programId
  )[0];
}

export function deriveWebAuthnTableAddress(
  tableIndex: number
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(WEB_AUTHN_TABLE_SEED),
      Buffer.from(toBytesUint32LE(tableIndex)),
    ],
    SMART_ACCOUNT_SOLANA_PROGRAM_ID
  );
}

export function getSmartAccountVault(
  id: string | number[]
): anchor.web3.PublicKey {
  const idBuffer = typeof id === "string" ? Buffer.from(id) : Buffer.from(id);
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(SMART_ACCOUNT_VAULT_SEED), idBuffer],
    VAULT_PROGRAM_ID
  )[0];
}

export function getVaultState(id: string | number[]): anchor.web3.PublicKey {
  const idBuffer = typeof id === "string" ? Buffer.from(id) : Buffer.from(id);
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(VAULT_STATE_SEED), idBuffer],
    VAULT_PROGRAM_ID
  )[0];
}

export function getDkimOracleConfigAccount(): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from(DKIM_CONFIG_SEED)],
    DKIM_KEY_ORACLE_PROGRAM_ID
  )[0];
}

export function getDkimEntryAccount(
  domainHash: Buffer | Uint8Array,
  keyHash: Buffer | Uint8Array
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(DKIM_ENTRY_SEED),
      Buffer.from(domainHash),
      Buffer.from(keyHash),
    ],
    DKIM_KEY_ORACLE_PROGRAM_ID
  )[0];
}

export function getDkimProposalAccount(
  proposalType: Buffer | Uint8Array,
  domainHash: Buffer | Uint8Array,
  keyHash: Buffer | Uint8Array
): anchor.web3.PublicKey {
  return anchor.web3.PublicKey.findProgramAddressSync(
    [
      Buffer.from(PROPOSAL_SEED),
      Buffer.from(proposalType),
      Buffer.from(domainHash),
      Buffer.from(keyHash),
    ],
    DKIM_KEY_ORACLE_PROGRAM_ID
  )[0];
}

export function generateIdFromString(input: string): Buffer<ArrayBufferLike> {
  return crypto.createHash("sha256").update(input).digest();
}

export function toBytesUInt32(num: number) {
  const arr = new Uint8Array([
    (num & 0xff000000) >> 24,
    (num & 0x00ff0000) >> 16,
    (num & 0x0000ff00) >> 8,
    num & 0x000000ff,
  ]);
  return Array.from(arr);
}

export function toBytesUint32LE(num: number) {
  const buffer = Buffer.allocUnsafe(4);
  buffer.writeUInt32LE(num, 0);
  return Array.from(buffer);
}

export function toBytesUInt64(num: number) {
  const buffer = Buffer.allocUnsafe(8);
  // Use little-endian to match Rust's to_le_bytes()
  buffer.writeBigUInt64LE(BigInt(num), 0);
  return Array.from(buffer);
}

export async function getLookupTableAccounts(
  connection: Connection,
  lookupTableAddresses: PublicKey[]
): Promise<AddressLookupTableAccount[]> {
  const lookupTableAccounts: AddressLookupTableAccount[] = [];

  // Process one lookup table at a time to reduce memory pressure
  for (const address of lookupTableAddresses) {
    try {
      const accountInfo = await connection.getAccountInfo(address);
      if (!accountInfo) {
        throw new Error(`Lookup table not found: ${address.toBase58()}`);
      }

      const lookupTableAccount = new AddressLookupTableAccount({
        key: address,
        state: AddressLookupTableAccount.deserialize(accountInfo.data),
      });

      lookupTableAccounts.push(lookupTableAccount);
    } catch (error) {
      console.error(
        `Error processing lookup table ${address.toBase58()}:`,
        error
      );
      throw error;
    }
  }
  return lookupTableAccounts;
}
