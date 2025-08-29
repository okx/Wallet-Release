import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import * as fs from "fs";
import * as path from "path";

/**
 * Comprehensive instruction argument logger for backend team documentation
 */
export class InstructionLogger {
  private static formatValue(value: any): string {
    if (value === null || value === undefined) {
      return "null";
    }

    if (value instanceof PublicKey) {
      return `PublicKey("${value.toBase58()}")`;
    }

    if (value instanceof anchor.BN) {
      return `BN(${value.toString()})`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) {
        return "[]";
      }

      // Handle byte arrays
      if (
        typeof value[0] === "number" &&
        value.every((v) => typeof v === "number" && v >= 0 && v <= 255)
      ) {
        if (value.length === 32) {
          return `[u8; 32] = [${value.slice(0, 8).join(", ")}...${value.slice(-4).join(", ")}]`;
        }
        if (value.length === 33) {
          return `[u8; 33] = [${value.slice(0, 8).join(", ")}...${value.slice(-4).join(", ")}]`;
        }
        if (value.length === 37) {
          return `[u8; 37] = [${value.join(", ")}]`;
        }
        return `[u8; ${value.length}] = [${value.join(", ")}]`;
      }

      // Handle PublicKey arrays
      if (value[0] instanceof PublicKey) {
        return `[${value.map((v) => `"${v.toBase58()}"`).join(", ")}]`;
      }

      return `[${value.map((v) => InstructionLogger.formatValue(v)).join(", ")}]`;
    }

    if (typeof value === "object") {
      const entries = Object.entries(value).map(
        ([k, v]) => `${k}: ${InstructionLogger.formatValue(v)}`
      );
      return `{ ${entries.join(", ")} }`;
    }

    if (typeof value === "string") {
      return `"${value}"`;
    }

    return String(value);
  }

  /**
   * Convert any value to JSON-serializable format
   */
  private static toJsonValue(value: any): any {
    if (value === null || value === undefined) {
      return null;
    }

    if (value instanceof PublicKey) {
      return {
        type: "PublicKey",
        value: value.toBase58(),
      };
    }

    if (value instanceof anchor.BN) {
      return {
        type: "BN",
        value: value.toString(),
      };
    }

    if (value instanceof Uint8Array) {
      return {
        type: "Uint8Array",
        value: Array.from(value),
      };
    }

    if (Buffer.isBuffer(value)) {
      return {
        type: "Buffer",
        value: Array.from(value),
      };
    }

    if (Array.isArray(value)) {
      return value.map((v) => InstructionLogger.toJsonValue(v));
    }

    if (typeof value === "object") {
      const result: any = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = InstructionLogger.toJsonValue(v);
      }
      return result;
    }

    return value;
  }

  /**
   * Export instruction data to JSON file
   */
  static exportToJson(
    instructionName: string,
    data: any,
    filePath?: string
  ): void {
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const defaultPath =
      filePath ||
      `logs/instruction-${instructionName.toLowerCase()}-${timestamp}.json`;

    // Ensure directory exists
    const dir = path.dirname(defaultPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const jsonData = {
      instruction: instructionName,
      timestamp: new Date().toISOString(),
      data: InstructionLogger.toJsonValue(data),
    };

    fs.writeFileSync(defaultPath, JSON.stringify(jsonData, null, 2));
    console.log(`📁 Instruction data exported to: ${defaultPath}`);
  }

  private static logSection(title: string, content: string) {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📋 ${title}`);
    console.log(`${"=".repeat(60)}`);
    console.log(content);
    console.log(`${"=".repeat(60)}\n`);
  }

  /**
   * Log initialize_config instruction arguments
   */
  static logInitializeConfig(
    args: {
      creator: PublicKey;
      recovery_signer: PublicKey[];
    },
    exportJson: boolean = false
  ) {
    const content = `
Arguments:
  creator: ${this.formatValue(args.creator)}
  recovery_signer: ${this.formatValue(args.recovery_signer)}

Description: Initialize the global configuration for the smart account program
`;
    this.logSection("INITIALIZE_CONFIG", content);

    if (exportJson) {
      this.exportToJson("INITIALIZE_CONFIG", args);
    }
  }

  /**
   * Log create_account instruction arguments
   */
  static logCreateAccount(
    args: {
      id: number[];
      email_ptr: number[];
      user_passkey: {
        pubkey: number[];
        valid_from: anchor.BN;
        valid_until: anchor.BN;
      };
      mandatory_signer: PublicKey;
      zk_verifier_program: PublicKey;
    },
    webauthn_args: {
      origin: string;
      android_package_name: string | null;
      auth_data: number[];
    },
    r1_signature_args?: {
      message: Uint8Array;
      pubkey: Buffer;
      signature: Buffer;
    },
    exportJson: boolean = false
  ) {
    const r1Content = r1_signature_args
      ? `
R1 Signature Arguments:
  message: ${this.formatValue(Array.from(r1_signature_args.message))}
  pubkey: ${this.formatValue(Array.from(r1_signature_args.pubkey))}
  signature: ${this.formatValue(Array.from(r1_signature_args.signature))}
`
      : "";

    const content = `
Arguments:
  id: ${this.formatValue(args.id)}
  email_ptr: ${this.formatValue(args.email_ptr)}
  user_passkey: {
    pubkey: ${this.formatValue(args.user_passkey.pubkey)}
    valid_from: ${this.formatValue(args.user_passkey.valid_from)}
    valid_until: ${this.formatValue(args.user_passkey.valid_until)}
  }
  mandatory_signer: ${this.formatValue(args.mandatory_signer)}
  zk_verifier_program: ${this.formatValue(args.zk_verifier_program)}

WebAuthn Arguments:
  origin: ${this.formatValue(webauthn_args.origin)}
  android_package_name: ${this.formatValue(webauthn_args.android_package_name)}
  auth_data: ${this.formatValue(webauthn_args.auth_data)}${r1Content}
Description: Create a new smart account with WebAuthn passkey authentication
`;
    this.logSection("CREATE_ACCOUNT", content);

    if (exportJson) {
      this.exportToJson("CREATE_ACCOUNT", {
        args,
        webauthn_args,
        r1_signature_args,
      });
    }
  }

  /**
   * Log simulate_create_account instruction arguments
   */
  static logSimulateCreateAccount(
    args: {
      id: number[];
      email_ptr: number[];
      user_passkey: {
        pubkey: number[];
        valid_from: anchor.BN;
        valid_until: anchor.BN;
      };
      mandatory_signer: PublicKey;
      zk_verifier_program: PublicKey;
    },
    webauthn_args: {
      origin: string;
      android_package_name: string | null;
      auth_data: number[];
    },
    r1_signature_args?: {
      message: Uint8Array;
      pubkey: Buffer;
      signature: Buffer;
    },
    exportJson: boolean = false
  ) {
    const r1Content = r1_signature_args
      ? `
R1 Signature Arguments:
  message: ${this.formatValue(Array.from(r1_signature_args.message))}
  pubkey: ${this.formatValue(Array.from(r1_signature_args.pubkey))}
  signature: ${this.formatValue(Array.from(r1_signature_args.signature))}
`
      : "";

    const content = `
Arguments:
  id: ${this.formatValue(args.id)}
  email_ptr: ${this.formatValue(args.email_ptr)}
  user_passkey: {
    pubkey: ${this.formatValue(args.user_passkey.pubkey)}
    valid_from: ${this.formatValue(args.user_passkey.valid_from)}
    valid_until: ${this.formatValue(args.user_passkey.valid_until)}
  }
  mandatory_signer: ${this.formatValue(args.mandatory_signer)}
  zk_verifier_program: ${this.formatValue(args.zk_verifier_program)}

WebAuthn Arguments:
  origin: ${this.formatValue(webauthn_args.origin)}
  android_package_name: ${this.formatValue(webauthn_args.android_package_name)}
  auth_data: ${this.formatValue(webauthn_args.auth_data)}${r1Content}
Description: Simulate smart account creation (dry run)
`;
    this.logSection("SIMULATE_CREATE_ACCOUNT", content);

    if (exportJson) {
      this.exportToJson("SIMULATE_CREATE_ACCOUNT", {
        args,
        webauthn_args,
        r1_signature_args,
      });
    }
  }

  /**
   * Log validate_execution instruction arguments
   */
  static logValidateExecution(
    webauthn_args: {
      origin: string;
      android_package_name: string | null;
      auth_data: number[];
    },
    r1_signature_args?: {
      message: Uint8Array;
      pubkey: Buffer;
      signature: Buffer;
    },
    exportJson: boolean = false
  ) {
    const r1Content = r1_signature_args
      ? `
R1 Signature Arguments:
  message: ${this.formatValue(Array.from(r1_signature_args.message))}
  pubkey: ${this.formatValue(Array.from(r1_signature_args.pubkey))}
  signature: ${this.formatValue(Array.from(r1_signature_args.signature))}
`
      : "";

    const content = `

WebAuthn Arguments:
  origin: ${this.formatValue(webauthn_args.origin)}
  android_package_name: ${this.formatValue(webauthn_args.android_package_name)}
  auth_data: ${this.formatValue(webauthn_args.auth_data)}${r1Content}
Description: Validate execution of vault operations using WebAuthn signature
`;
    this.logSection("VALIDATE_EXECUTION", content);

    if (exportJson) {
      this.exportToJson("VALIDATE_EXECUTION", {
        webauthn_args,
        r1_signature_args,
      });
    }
  }

  /**
   * Log simulate_validate_execution instruction arguments
   */
  static logSimulateValidateExecution(
    webauthn_args: {
      origin: string;
      android_package_name: string | null;
      auth_data: number[];
    },
    r1_signature_args?: {
      message: Uint8Array;
      pubkey: Buffer;
      signature: Buffer;
    },
    exportJson: boolean = false
  ) {
    const r1Content = r1_signature_args
      ? `
R1 Signature Arguments:
  message: ${this.formatValue(Array.from(r1_signature_args.message))}
  pubkey: ${this.formatValue(Array.from(r1_signature_args.pubkey))}
  signature: ${this.formatValue(Array.from(r1_signature_args.signature))}
`
      : "";

    const content = `
WebAuthn Arguments:
  origin: ${this.formatValue(webauthn_args.origin)}
  android_package_name: ${this.formatValue(webauthn_args.android_package_name)}
  auth_data: ${this.formatValue(webauthn_args.auth_data)}${r1Content}
Description: Simulate validation of vault operations (dry run)
`;
    this.logSection("SIMULATE_VALIDATE_EXECUTION", content);

    if (exportJson) {
      this.exportToJson("SIMULATE_VALIDATE_EXECUTION", {
        webauthn_args,
        r1_signature_args,
      });
    }
  }

  /**
   * Log update_mandatory_signer instruction arguments
   */
  static logUpdateMandatorySigner(
    mandatory_signer: PublicKey,
    exportJson: boolean = false
  ) {
    const content = `
Arguments:
  mandatory_signer: ${this.formatValue(mandatory_signer)}

Description: Update the mandatory signer for a smart account
`;
    this.logSection("UPDATE_MANDATORY_SIGNER", content);

    if (exportJson) {
      this.exportToJson("UPDATE_MANDATORY_SIGNER", { mandatory_signer });
    }
  }

  /**
   * Log add_signer instruction arguments
   */
  static logAddSigner(
    signer: {
      passkey?: {
        pubkey: number[];
        valid_from: anchor.BN;
        valid_until: anchor.BN;
      };
      solanaKey?: {
        pubkey: string;
        valid_from: anchor.BN;
        valid_until: anchor.BN;
      };
    },
    exportJson: boolean = false
  ) {
    let signerType = "";
    let signerDetails = "";

    if (signer.passkey) {
      signerType = "Passkey";
      signerDetails = `    pubkey: ${this.formatValue(signer.passkey.pubkey)}
    valid_from: ${this.formatValue(signer.passkey.valid_from)}
    valid_until: ${this.formatValue(signer.passkey.valid_until)}`;
    } else if (signer.solanaKey) {
      signerType = "SolanaKey";
      signerDetails = `    pubkey: ${this.formatValue(signer.solanaKey.pubkey)}
    valid_from: ${this.formatValue(signer.solanaKey.valid_from)}
    valid_until: ${this.formatValue(signer.solanaKey.valid_until)}`;
    }

    const content = `
Arguments:
  signer: {
    ${signerType}: {
${signerDetails}
    }
  }

Description: Add a new ${signerType.toLowerCase()} signer to the smart account
`;
    this.logSection("ADD_SIGNER", content);

    if (exportJson) {
      this.exportToJson("ADD_SIGNER", { signer });
    }
  }

  /**
   * Log add_passkey_signer instruction arguments (legacy method for backward compatibility)
   */
  static logAddPasskeySigner(
    passkey: {
      pubkey: number[];
      valid_from: anchor.BN;
      valid_until: anchor.BN;
    },
    exportJson: boolean = false
  ) {
    this.logAddSigner({ passkey }, exportJson);
  }

  /**
   * Log remove_signer instruction arguments
   */
  static logRemoveSigner(
    signerIdentifier: {
      passkey?: number[];
      solanaKey?: string;
    },
    exportJson: boolean = false
  ) {
    let signerType = "";
    let signerValue = "";

    if (signerIdentifier.passkey) {
      signerType = "Passkey";
      signerValue = this.formatValue(signerIdentifier.passkey);
    } else if (signerIdentifier.solanaKey) {
      signerType = "SolanaKey";
      signerValue = this.formatValue(signerIdentifier.solanaKey);
    }

    const content = `
Arguments:
  signer_identifier: {
    ${signerType}: ${signerValue}
  }

Description: Remove a ${signerType.toLowerCase()} signer from the smart account
`;
    this.logSection("REMOVE_SIGNER", content);

    if (exportJson) {
      this.exportToJson("REMOVE_SIGNER", {
        signer_identifier: signerIdentifier,
      });
    }
  }

  /**
   * Log remove_passkey_signer instruction arguments (legacy method for backward compatibility)
   */
  static logRemovePasskeySigner(
    passkey_signer: number[],
    exportJson: boolean = false
  ) {
    this.logRemoveSigner({ passkey: passkey_signer }, exportJson);
  }

  /**
   * Log update_email_ptr instruction arguments
   */
  static logUpdateEmailPtr(email_ptr: number[], exportJson: boolean = false) {
    const content = `
Arguments:
  email_ptr: ${this.formatValue(email_ptr)}

Description: Update the email pointer for the smart account
`;
    this.logSection("UPDATE_EMAIL_PTR", content);

    if (exportJson) {
      this.exportToJson("UPDATE_EMAIL_PTR", { email_ptr });
    }
  }

  /**
   * Log update_zk_verifier_program instruction arguments
   */
  static logUpdateZkVerifierProgram(
    zk_verifier_program: PublicKey,
    exportJson: boolean = false
  ) {
    const content = `
Arguments:
  zk_verifier_program: ${this.formatValue(zk_verifier_program)}

Description: Update the ZK verifier program for the smart account
`;
    this.logSection("UPDATE_ZK_VERIFIER_PROGRAM", content);

    if (exportJson) {
      this.exportToJson("UPDATE_ZK_VERIFIER_PROGRAM", { zk_verifier_program });
    }
  }

  /**
   * Log update_admin instruction arguments
   */
  static logUpdateAdmin(admin: PublicKey, exportJson: boolean = false) {
    const content = `
Arguments:
  admin: ${this.formatValue(admin)}

Description: Update the admin of the global configuration
`;
    this.logSection("UPDATE_ADMIN", content);

    if (exportJson) {
      this.exportToJson("UPDATE_ADMIN", { admin });
    }
  }

  /**
   * Log revoke_admin instruction arguments
   */
  static logRevokeAdmin(exportJson: boolean = false) {
    const content = `
Arguments: None

Description: Revoke admin privileges from the global configuration
`;
    this.logSection("REVOKE_ADMIN", content);

    if (exportJson) {
      this.exportToJson("REVOKE_ADMIN", {});
    }
  }

  /**
   * Log update_creator instruction arguments
   */
  static logUpdateCreator(creator: PublicKey, exportJson: boolean = false) {
    const content = `
Arguments:
  creator: ${this.formatValue(creator)}

Description: Update the creator of the global configuration
`;
    this.logSection("UPDATE_CREATOR", content);

    if (exportJson) {
      this.exportToJson("UPDATE_CREATOR", { creator });
    }
  }

  /**
   * Log add_recovery_signer instruction arguments
   */
  static logAddRecoverySigner(
    recovery_signer: PublicKey[],
    exportJson: boolean = false
  ) {
    const content = `
Arguments:
  recovery_signer: ${this.formatValue(recovery_signer)}

Description: Add recovery signers to the global configuration
`;
    this.logSection("ADD_RECOVERY_SIGNER", content);

    if (exportJson) {
      this.exportToJson("ADD_RECOVERY_SIGNER", { recovery_signer });
    }
  }

  /**
   * Log remove_recovery_signer instruction arguments
   */
  static logRemoveRecoverySigner(
    recovery_signer: PublicKey,
    exportJson: boolean = false
  ) {
    const content = `
Arguments:
  recovery_signer: ${this.formatValue(recovery_signer)}

Description: Remove a recovery signer from the global configuration
`;
    this.logSection("REMOVE_RECOVERY_SIGNER", content);

    if (exportJson) {
      this.exportToJson("REMOVE_RECOVERY_SIGNER", { recovery_signer });
    }
  }

  /**
   * Log close_and_migrate instruction arguments
   */
  static logCloseAndMigrate(ix_data: number[], exportJson: boolean = false) {
    const content = `
Arguments:
  ix_data: ${this.formatValue(ix_data)}

Description: Close and migrate the smart account to a new program
`;
    this.logSection("CLOSE_AND_MIGRATE", content);

    if (exportJson) {
      this.exportToJson("CLOSE_AND_MIGRATE", { ix_data });
    }
  }

  /**
   * Log dummy_third_party_ix instruction arguments
   */
  static logDummyThirdPartyIx(exportJson: boolean = false) {
    const content = `
Arguments: None

Description: Dummy instruction for testing third-party integrations
`;
    this.logSection("DUMMY_THIRD_PARTY_IX", content);

    if (exportJson) {
      this.exportToJson("DUMMY_THIRD_PARTY_IX", {});
    }
  }

  /**
   * Log complete transaction data with instruction arguments
   */
  static logTransaction(
    instructionName: string,
    transactionData: {
      transaction: anchor.web3.Transaction | anchor.web3.VersionedTransaction;
      instructionArgs: any;
      webauthnArgs?: any;
      r1SignatureArgs?: any;
      accounts: {
        [key: string]: {
          address: string;
          isSigner: boolean;
          isWritable: boolean;
          description?: string;
        };
      };
      signers: {
        name: string;
        publicKey: string;
      }[];
      preInstructions?: {
        name: string;
        data: any;
      }[];
      metadata?: {
        recentBlockhash?: string;
        feePayer?: string;
        computeUnits?: number;
        priorityFee?: number;
      };
    },
    exportJson: boolean = true
  ) {
    const serializedTx =
      transactionData.transaction instanceof anchor.web3.VersionedTransaction
        ? transactionData.transaction.serialize()
        : transactionData.transaction.serialize({
            requireAllSignatures: false,
          });

    const content = `
Transaction Details:
  instruction: ${instructionName}
  size: ${serializedTx.length} bytes
  fee_payer: ${transactionData.metadata?.feePayer || "Not set"}
  recent_blockhash: ${transactionData.metadata?.recentBlockhash || "Not set"}
  compute_units: ${transactionData.metadata?.computeUnits || "Default"}
  priority_fee: ${transactionData.metadata?.priorityFee || "None"}

Accounts:
${Object.entries(transactionData.accounts)
  .map(
    ([name, account]) =>
      `  ${name}: ${account.address} (signer: ${account.isSigner}, writable: ${account.isWritable})`
  )
  .join("\n")}

Signers:
${transactionData.signers
  .map((signer) => `  ${signer.name}: ${signer.publicKey}`)
  .join("\n")}

Pre-Instructions:
${
  transactionData.preInstructions
    ?.map((preIx) => `  ${preIx.name}: ${this.formatValue(preIx.data)}`)
    .join("\n") || "  None"
}

Instruction Arguments:
${this.formatValue(transactionData.instructionArgs)}

${
  transactionData.webauthnArgs
    ? `WebAuthn Arguments:
${this.formatValue(transactionData.webauthnArgs)}`
    : ""
}

${
  transactionData.r1SignatureArgs
    ? `R1 Signature Arguments:
${this.formatValue(transactionData.r1SignatureArgs)}`
    : ""
}

Transaction Reconstruction Guide:
  1. Set up accounts with correct signer/writable flags
  2. Add pre-instructions (especially secp256r1)
  3. Call ${instructionName.toLowerCase()}() with provided arguments
  4. Sign with all required signers
  5. Set recent blockhash and fee payer
  6. Submit transaction

Description: Complete transaction data for ${instructionName}
`;

    this.logSection(`TRANSACTION_${instructionName}`, content);

    if (exportJson) {
      const completeTransactionData = {
        instruction: instructionName,
        transaction: {
          serialized: Array.from(serializedTx),
          size: serializedTx.length,
          type:
            transactionData.transaction instanceof
            anchor.web3.VersionedTransaction
              ? "versioned"
              : "legacy",
        },
        accounts: transactionData.accounts,
        signers: transactionData.signers,
        preInstructions: transactionData.preInstructions,
        metadata: transactionData.metadata,
        instructionArgs: transactionData.instructionArgs,
        webauthnArgs: transactionData.webauthnArgs,
        r1SignatureArgs: transactionData.r1SignatureArgs,
        formattedOutput: content.trim(), // Add the formatted console output
        reconstructionSteps: [
          "Load accounts with correct signer/writable flags",
          "Add pre-instructions (secp256r1 signature verification)",
          `Call program.methods.${instructionName.toLowerCase()}() with instructionArgs`,
          "Add accounts using the provided account mapping",
          "Sign with all signers listed in signers array",
          "Set recent blockhash and fee payer from metadata",
          "Submit transaction to network",
        ],
      };

      this.exportToJson(
        `TRANSACTION_${instructionName}`,
        completeTransactionData
      );
    }
  }
}
