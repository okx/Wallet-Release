#!/usr/bin/env ts-node
import * as fs from "fs";
import * as path from "path";
import { Keypair } from "@solana/web3.js";
import {
  loadKeyFromEnv,
  displayKeyInfo,
  loadR1KeyFromPem,
} from "../helpers/key-loader";

// Import ec-pem using require syntax
const ecPem = require("ec-pem");

interface GenerateKeysResult {
  skipped?: boolean;
  privateKeyPem?: string;
  mandatorySignerPublicKey?: string;
  mandatorySignerSecretKey?: string;
  marginfiAccountPublicKey?: string;
  marginfiAccountSecretKey?: string;
  raydiumV3UsdcUsdtLpPublicKey?: string;
  raydiumV3UsdcUsdtLpSecretKey?: string;
  r1PublicKeyHex?: string;
  r1PublicKeyBytes?: number[] | null;
}

/**
 * Generate R1 key and mandatory signer keypair for smart account creation
 */
function generateKeys(): GenerateKeysResult {
  console.log("🔑 Checking for existing keys...");

  // Create .env file path
  const envPath = path.join(__dirname, "..", ".env");

  // Read existing .env file if it exists
  let envContent = "";
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, "utf8");
  }

  // Check if keys already exist using multiline flag
  const hasR1Key = /^TEST_R1_PRIVATE_KEY=/m.test(envContent);
  const hasMandatorySigner = /^MANDATORY_SIGNER_SECRET_KEY=/m.test(envContent);
  const hasMarginfiAccount = /^MARGINFI_ACCOUNT_KEY=/m.test(envContent);
  const hasRaydiumV3UsdcUsdtLp = /^RAYDIUM_V3_USDC_USDT_LP_KEY=/m.test(
    envContent
  );

  if (
    hasR1Key &&
    hasMandatorySigner &&
    hasMarginfiAccount &&
    hasRaydiumV3UsdcUsdtLp
  ) {
    console.log("✅ Keys already exist in .env file - skipping generation");
    console.log("\n📋 Existing keys found:");

    try {
      // Use key-loader utility to display existing keys
      const r1KeyInfo = loadKeyFromEnv("TEST_R1_PRIVATE_KEY");
      displayKeyInfo("TEST_R1_PRIVATE_KEY", r1KeyInfo);

      const mandatorySignerInfo = loadKeyFromEnv("MANDATORY_SIGNER_SECRET_KEY");
      displayKeyInfo("MANDATORY_SIGNER_SECRET_KEY", mandatorySignerInfo);

      const marginfiAccountInfo = loadKeyFromEnv("MARGINFI_ACCOUNT_KEY");
      displayKeyInfo("MARGINFI_ACCOUNT_KEY", marginfiAccountInfo);

      const raydiumV3UsdcUsdtLpInfo = loadKeyFromEnv(
        "RAYDIUM_V3_USDC_USDT_LP_KEY"
      );
      displayKeyInfo("RAYDIUM_V3_USDC_USDT_LP_KEY", raydiumV3UsdcUsdtLpInfo);
    } catch (error) {
      console.log("   Keys exist but couldn't be parsed:");
      console.log(
        `   Error: ${error instanceof Error ? error.message : String(error)}`
      );

      // Fallback to manual parsing if key-loader fails
      try {
        const r1KeyMatch = envContent.match(/^TEST_R1_PRIVATE_KEY="([^"]+)"/m);
        if (r1KeyMatch) {
          const r1PrivateKeyPem = r1KeyMatch[1];
          const r1KeyInfo = loadR1KeyFromPem(r1PrivateKeyPem);
          displayKeyInfo("TEST_R1_PRIVATE_KEY", r1KeyInfo);
        }

        const mandatorySignerMatch = envContent.match(
          /^MANDATORY_SIGNER_SECRET_KEY='([^']+)'/m
        );
        if (mandatorySignerMatch) {
          const mandatorySignerSecretKey = JSON.parse(mandatorySignerMatch[1]);
          const mandatorySignerKeypair = Keypair.fromSecretKey(
            Uint8Array.from(mandatorySignerSecretKey)
          );
          console.log("🔐 MANDATORY_SIGNER_SECRET_KEY:");
          console.log(
            `   Public Key: ${mandatorySignerKeypair.publicKey.toBase58()}`
          );
        }

        const marginfiAccountMatch = envContent.match(
          /^MARGINFI_ACCOUNT_KEY='([^']+)'/m
        );
        if (marginfiAccountMatch) {
          const marginfiAccountSecretKey = JSON.parse(marginfiAccountMatch[1]);
          const marginfiAccountKeypair = Keypair.fromSecretKey(
            Uint8Array.from(marginfiAccountSecretKey)
          );
          console.log("🔐 MARGINFI_ACCOUNT_KEY:");
          console.log(
            `   Public Key: ${marginfiAccountKeypair.publicKey.toBase58()}`
          );
        }

        const raydiumV3UsdcUsdtLpMatch = envContent.match(
          /^RAYDIUM_V3_USDC_USDT_LP_KEY='([^']+)'/m
        );
        if (raydiumV3UsdcUsdtLpMatch) {
          const raydiumV3UsdcUsdtLpSecretKey = JSON.parse(
            raydiumV3UsdcUsdtLpMatch[1]
          );
          const raydiumV3UsdcUsdtLpKeypair = Keypair.fromSecretKey(
            Uint8Array.from(raydiumV3UsdcUsdtLpSecretKey)
          );
          console.log("🔐 RAYDIUM_V3_USDC_USDT_LP_KEY:");
          console.log(
            `   Public Key: ${raydiumV3UsdcUsdtLpKeypair.publicKey.toBase58()}`
          );
        }
      } catch (fallbackError) {
        console.log("   TEST_R1_PRIVATE_KEY: Set (unable to parse)");
        console.log("   MANDATORY_SIGNER_SECRET_KEY: Set (unable to parse)");
        console.log("   MARGINFI_ACCOUNT_KEY: Set (unable to parse)");
        console.log("   RAYDIUM_V3_USDC_USDT_LP_KEY: Set (unable to parse)");
      }
    }

    console.log("\n💡 To regenerate keys, remove them from .env file first");
    return { skipped: true };
  }

  console.log("🔑 Generating keys for smart account creation...");

  let r1Keypair: any = null;
  let mandatorySignerKeypair: Keypair | null = null;
  let marginfiAccountKeypair: Keypair | null = null;
  let raydiumV3UsdcUsdtLpKeypair: Keypair | null = null;
  let privateKeyPem: string | null = null;
  let mandatorySignerSecretKey: string | null = null;
  let marginfiAccountSecretKey: string | null = null;
  let raydiumV3UsdcUsdtLpSecretKey: string | null = null;

  // Generate R1 key if missing
  if (!hasR1Key) {
    console.log("🔐 Generating R1 key...");
    r1Keypair = ecPem(null, "prime256v1");
    r1Keypair.generateKeys();
    privateKeyPem = r1Keypair.encodePrivateKey();
  }

  // Generate mandatory signer if missing
  if (!hasMandatorySigner) {
    console.log("🔐 Generating mandatory signer...");
    mandatorySignerKeypair = Keypair.generate();
    mandatorySignerSecretKey = JSON.stringify(
      Array.from(mandatorySignerKeypair.secretKey)
    );
  }

  // Generate MarginFi account if missing
  if (!hasMarginfiAccount) {
    console.log("🔐 Generating MarginFi account...");
    marginfiAccountKeypair = Keypair.generate();
    marginfiAccountSecretKey = JSON.stringify(
      Array.from(marginfiAccountKeypair.secretKey)
    );
  }

  // Generate Raydium V3 USDC/USDT LP key if missing
  if (!hasRaydiumV3UsdcUsdtLp) {
    console.log("🔐 Generating Raydium V3 USDC/USDT LP key...");
    raydiumV3UsdcUsdtLpKeypair = Keypair.generate();
    raydiumV3UsdcUsdtLpSecretKey = JSON.stringify(
      Array.from(raydiumV3UsdcUsdtLpKeypair.secretKey)
    );
  }

  // Function to update or add environment variable
  function updateEnvVar(content: string, key: string, value: string): string {
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      return content.replace(regex, `${key}=${value}`);
    } else {
      return (
        content + (content.endsWith("\n") ? "" : "\n") + `${key}=${value}\n`
      );
    }
  }

  // Update environment variables
  if (!hasR1Key && privateKeyPem) {
    envContent = updateEnvVar(
      envContent,
      "TEST_R1_PRIVATE_KEY",
      `"${privateKeyPem}"`
    );
  }
  if (!hasMandatorySigner && mandatorySignerSecretKey) {
    envContent = updateEnvVar(
      envContent,
      "MANDATORY_SIGNER_SECRET_KEY",
      `'${mandatorySignerSecretKey}'`
    );
  }
  if (!hasMarginfiAccount && marginfiAccountSecretKey) {
    envContent = updateEnvVar(
      envContent,
      "MARGINFI_ACCOUNT_KEY",
      `'${marginfiAccountSecretKey}'`
    );
  }
  if (!hasRaydiumV3UsdcUsdtLp && raydiumV3UsdcUsdtLpSecretKey) {
    envContent = updateEnvVar(
      envContent,
      "RAYDIUM_V3_USDC_USDT_LP_KEY",
      `'${raydiumV3UsdcUsdtLpSecretKey}'`
    );
  }

  // Write to .env file
  fs.writeFileSync(envPath, envContent);

  console.log("🎉 Keys generated successfully!");

  // Display R1 key info if generated
  if (!hasR1Key && r1Keypair && privateKeyPem) {
    try {
      const r1KeyInfo = loadR1KeyFromPem(privateKeyPem);
      displayKeyInfo("TEST_R1_PRIVATE_KEY", r1KeyInfo);
      console.log("   Added to .env as: TEST_R1_PRIVATE_KEY");
    } catch (error) {
      // Fallback to manual display if key-loader fails
      const publicKeyHex = r1Keypair.getPublicKey("hex", "compressed");
      const publicKeyBuffer = Buffer.from(publicKeyHex, "hex");

      console.log("\n🔑 R1 Key Information:");
      console.log(`   Algorithm: secp256r1`);
      console.log(`   Format: PEM`);
      console.log(`   Public Key (hex): ${publicKeyHex}`);
      console.log(
        `   Public Key (33 bytes): [${Array.from(publicKeyBuffer).join(", ")}]`
      );
      console.log(`   Added to .env as: TEST_R1_PRIVATE_KEY`);
    }
  }

  // Display mandatory signer info if generated
  if (!hasMandatorySigner && mandatorySignerKeypair) {
    console.log("\n🔐 Mandatory Signer Information:");
    console.log(
      `   Public Key: ${mandatorySignerKeypair.publicKey.toBase58()}`
    );
    console.log(`   Added to .env as: MANDATORY_SIGNER_SECRET_KEY`);
  }

  // Display MarginFi account info if generated
  if (!hasMarginfiAccount && marginfiAccountKeypair) {
    console.log("\n🔐 MarginFi Account Information:");
    console.log(
      `   Public Key: ${marginfiAccountKeypair.publicKey.toBase58()}`
    );
    console.log(`   Added to .env as: MARGINFI_ACCOUNT_KEY`);
  }

  // Display Raydium V3 USDC/USDT LP key info if generated
  if (!hasRaydiumV3UsdcUsdtLp && raydiumV3UsdcUsdtLpKeypair) {
    console.log("\n🔐 Raydium V3 USDC/USDT LP Information:");
    console.log(
      `   Public Key: ${raydiumV3UsdcUsdtLpKeypair.publicKey.toBase58()}`
    );
    console.log(`   Added to .env as: RAYDIUM_V3_USDC_USDT_LP_KEY`);
  }

  return {
    privateKeyPem,
    mandatorySignerPublicKey: mandatorySignerKeypair?.publicKey.toBase58(),
    mandatorySignerSecretKey,
    marginfiAccountPublicKey: marginfiAccountKeypair?.publicKey.toBase58(),
    marginfiAccountSecretKey,
    raydiumV3UsdcUsdtLpPublicKey:
      raydiumV3UsdcUsdtLpKeypair?.publicKey.toBase58(),
    raydiumV3UsdcUsdtLpSecretKey,
    r1PublicKeyHex: r1Keypair?.getPublicKey("hex", "compressed"),
    r1PublicKeyBytes: r1Keypair
      ? Array.from(
          Buffer.from(r1Keypair.getPublicKey("hex", "compressed"), "hex")
        )
      : null,
  };
}

// Run the function if this script is executed directly
if (require.main === module) {
  try {
    generateKeys();
  } catch (error) {
    console.error(
      "❌ Error generating keys:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

export { generateKeys };
