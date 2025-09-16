#!/usr/bin/env bash

# Change to the script's directory
cd "$(dirname "$0")" || {
    echo "❌ Failed to change to script directory"
    exit 1
}

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed on this system."
    echo "📥 Please install Node.js from https://nodejs.org/en/download/"
    echo "🚪 Exiting script. Please run again after installing Node.js."
    exit 1
fi

# Install dependencies if node_modules doesn't exist
if [[ ! -d node_modules ]]; then
    echo "📦 Installing dependencies..."
    npm install
fi

if [[ ! -f .env ]]; then
  #create .env file if it doesn't exist
  echo "📄 Creating default .env file..."
  cat > .env << 'EOF'
# Default RPC URLs
DEFAULT_SOLANA_RPC_URL=https://api.mainnet.solana.com
DEFAULT_BASE_RPC_URL=https://mainnet.base.org
DEFAULT_BSC_RPC_URL=https://bsc-dataseed.binance.org/
DEFAULT_XLAYER_RPC_URL=https://mainnet.xlayer-rpc.com

# Default Solana Values
LOOKUP_TABLE_ADDRESS=
RPC_URL=https://api.mainnet.solana.com

# EVM - Fill in your private key and AA wallet address
EVM_EOA_PRIVATE_KEY=
EVM_AA_ADDRESS=

# Solana - Fill in your SA ID, wallet secret key, and mandatory signer secret key
SA_ID=
WALLET_SECRET_KEY=
MANDATORY_SIGNER_SECRET_KEY=
EOF
else 
  # Start the web server unless this is the first run
  echo "🚀 Starting web server (npm run web)..."
  npm run web
fi

# Keep the window open after the server stops so users can read any messages
echo
read -n 1 -s -r -p "Press any key to close this window..."