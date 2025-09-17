#!/usr/bin/env bash

# Change to the script's directory
cd "$(dirname "$0")"

# Check if Node.js is installed
if ! command -v node >/dev/null 2>&1; then
    echo "❌ Node.js is not installed on this system."
    echo "📥 Please install Node.js from https://nodejs.org/en/download/"
    echo "🚪 Exiting script. Please run again after installing Node.js."
    exit 1
    else
    echo "✅ Node.js is installed on this system."
fi

# Install dependencies if node_modules doesn't exist
if [[ ! -d node_modules ]]; then
    echo "📦 Installing dependencies..."
    npm install
    else
    echo "✅ Dependencies already installed."
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
  echo "✅ Setup completed! The next run will start the web server."
else 
  # Check if port 3000 is already in use
  if lsof -i :3000 -sTCP:LISTEN -t >/dev/null ; then
      echo "❌ Port 3000 is already in use. Please terminate the process using it and try again."
      exit 1
  fi
  # Start the web server unless this is the first run
  echo "🚀 Starting web server (npm run web)..."
  npm run web
fi

# Keep the window open after the server stops so users can read any messages
echo
read -n 1 -s -r -p "Press any key to close this window..."