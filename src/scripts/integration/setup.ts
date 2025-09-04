#!/usr/bin/env tsx

import { spawn } from "child_process";

interface ScriptResult {
  success: boolean;
  script: string;
  error?: string;
}

async function runScript(scriptPath: string): Promise<ScriptResult> {
  return new Promise((resolve) => {
    console.log(`\n🚀 Running: ${scriptPath}`);
    console.log("=".repeat(50));

    const child = spawn("npx", ["tsx", scriptPath], {
      stdio: "inherit",
      shell: true,
    });

    child.on("close", (code) => {
      if (code === 0) {
        console.log(`✅ ${scriptPath} completed successfully`);
        resolve({ success: true, script: scriptPath });
      } else {
        console.log(`❌ ${scriptPath} failed with exit code ${code}`);
        resolve({
          success: false,
          script: scriptPath,
          error: `Exit code: ${code}`,
        });
      }
    });

    child.on("error", (error) => {
      console.log(`❌ ${scriptPath} failed with error: ${error.message}`);
      resolve({
        success: false,
        script: scriptPath,
        error: error.message,
      });
    });
  });
}

async function main() {
  console.log("🔧 Smart Account Setup Script");
  console.log("This script will run the following in order:");
  console.log("1. Initialize configuration");
  console.log("2. Transfer initial funds to smart account");
  console.log("3. Create smart account");
  console.log("=".repeat(60));

  const scripts = [
    "scripts/initialize-config.ts",
    "scripts/create-general-sa.ts",
    "scripts/integration/setup-lookup-table.ts",
    "scripts/integration/transfer-initial-to-sa.ts",
  ];

  const results: ScriptResult[] = [];

  for (const script of scripts) {
    const result = await runScript(script);
    results.push(result);

    if (!result.success) {
      console.log(`\n❌ Setup failed at: ${script}`);
      console.log("Stopping execution due to failure.");
      break;
    }

    console.log(`\n⏳ Waiting 0.5 seconds before next script...`);
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📋 SETUP SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  console.log(`✅ Successful: ${successful}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📊 Total: ${results.length}`);

  if (failed === 0) {
    console.log("\n🎉 All scripts completed successfully!");
    console.log("Your smart account setup is complete.");
  } else {
    console.log("\n⚠️  Some scripts failed. Please check the errors above.");
    console.log("You may need to run the failed scripts manually.");
  }

  // Detailed results
  console.log("\n📝 Detailed Results:");
  results.forEach((result, index) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${index + 1}. ${status} ${result.script}`);
    if (result.error) {
      console.log(`   Error: ${result.error}`);
    }
  });
}

main().catch(console.error);
