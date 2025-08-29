import * as anchor from "@coral-xyz/anchor";
import * as borsh from "@coral-xyz/borsh";
import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { createHash } from "crypto";

export interface SerializableAccountMeta {
  pubkey: PublicKey;
  isSigner: boolean;
  isWritable: boolean;
}

export interface StoredInstruction {
  programId: PublicKey;
  accounts: SerializableAccountMeta[];
  data: Buffer;
}

// Borsh schemas matching the vault's expectations
const borshAccountSchema = borsh.struct([
  borsh.publicKey("pubkey"),
  borsh.bool("isSigner"),
  borsh.bool("isWritable"),
]);

const borshStoredInstructionSchema = borsh.struct([
  borsh.publicKey("programId"),
  borsh.vec(borshAccountSchema, "accounts"),
  borsh.vecU8("data"),
]);

export class BufferUtils {
  /**
   * Convert TransactionInstruction to StoredInstruction format
   */
  static convertToStoredInstruction(
    ix: TransactionInstruction
  ): StoredInstruction {
    return {
      programId: ix.programId,
      accounts: ix.keys.map((key) => ({
        pubkey: key.pubkey,
        isSigner: key.isSigner,
        isWritable: key.isWritable,
      })),
      data: ix.data,
    };
  }

  /**
   * Serialize instructions using proper Borsh format that matches the vault
   */
  static serializeInstructions(instructions: StoredInstruction[]): Buffer {
    // Create an oversized buffer first
    const buffer = Buffer.alloc(1024 * 1024);

    // Use Borsh to encode the vector of instructions
    const length = borsh
      .vec(borshStoredInstructionSchema, "instructions")
      .encode(instructions, buffer);

    // Return the exact sized buffer
    return buffer.subarray(0, length);
  }

  /**
   * Serialize and split instruction data (matching working implementation)
   */
  static serializeAndSplitInstructions(
    instructions: StoredInstruction[],
    thresholdByteLength: number = 700
  ): Buffer[] {
    // First serialize all instructions into one buffer
    const totalSerializedData = BufferUtils.serializeInstructions(instructions);

    // Then split the serialized data into chunks
    const splits = Math.ceil(totalSerializedData.length / thresholdByteLength);
    const splitData: Buffer[] = [];
    let dataCounter = 0;

    for (let i = 0; i < splits; i++) {
      const chunk = totalSerializedData.subarray(
        dataCounter,
        Math.min(dataCounter + thresholdByteLength, totalSerializedData.length)
      );
      splitData.push(chunk);
      dataCounter += thresholdByteLength;
    }

    return splitData;
  }

  /**
   * Split serialized data into chunks for buffer operations
   * @deprecated Use serializeAndSplitInstructions instead
   */
  static splitIntoChunks(data: Buffer, chunkSize: number = 700): Buffer[] {
    const chunks: Buffer[] = [];

    for (let i = 0; i < data.length; i += chunkSize) {
      const chunk = data.subarray(i, i + chunkSize);
      chunks.push(chunk);
    }

    return chunks;
  }

  /**
   * Calculate hash of instruction data for PDA derivation
   */
  static calculateInstructionHash(data: Buffer): number[] {
    const hash = createHash("sha256").update(data).digest();
    return Array.from(hash);
  }

  /**
   * Create buffer account PDA
   */
  static findBufferPda(
    smartAccountPda: PublicKey,
    nonce: number,
    targetHash: number[],
    programId: PublicKey
  ): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from("tx_buffer"),
        smartAccountPda.toBuffer(),
        new anchor.BN(nonce).toArrayLike(Buffer, "le", 8),
        Buffer.from(targetHash),
      ],
      programId
    );
  }

  /**
   * Create buffer account arguments
   */
  static createBufferAccountArgs(
    nonce: number,
    dataLength: number,
    targetHash: number[]
  ) {
    return {
      nonce: new anchor.BN(nonce),
      length: new anchor.BN(dataLength), // Exact size, no extra buffer
      targetHash: targetHash,
    };
  }

  /**
   * Log buffer operation details
   */
  static logBufferInfo(
    instructions: StoredInstruction[],
    serializedData: Buffer,
    chunks: Buffer[]
  ) {
    console.log(`Created ${instructions.length} instructions`);
    console.log(`Total serialized data size: ${serializedData.length} bytes`);
    console.log(`Split into ${chunks.length} chunks of max size`);

    chunks.forEach((chunk, i) => {
      console.log(`  Chunk ${i + 1}: ${chunk.length} bytes`);
    });
  }
}

export default BufferUtils;
