#!/usr/bin/env bash

# Simple one-click launcher for macOS
# ‑ Checks for the Emergency-Escape repo in the current directory.
# ‑ Clones it if it doesn’t exist.
# ‑ Installs dependencies, ensures a .env file exists, then starts the web server.
#
# Place this file **outside** the repo or alongside it. Double-click in Finder and Terminal will run it.

set -euo pipefail

REPO_NAME="Emergency-Escape"
GIT_URL="https://github.com/okx/Emergency-Escape.git"   # Change if your fork lives elsewhere

# Go where this script lives so all relative paths work
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

IS_FIRST_RUN=false
if [[ ! -d "$REPO_NAME" ]]; then
  echo "🛠  Cloning $REPO_NAME …"
  git clone --branch dev "$GIT_URL"
  IS_FIRST_RUN=true
fi

cd "$REPO_NAME"

echo "📦  Installing dependencies …"
npm install


# Ensure .env exists so the app doesn’t crash on missing file
if [[ ! -f .env ]]; then
  cat > .env << 'EOF'
# Default RPC urls
DEFAULT_SOLANA_RPC_URL=https://api.mainnet.solana.com
DEFAULT_BASE_RPC_URL=https://mainnet.base.org
DEFAULT_BSC_RPC_URL=https://bsc-dataseed.binance.org/
DEFAULT_XLAYER_RPC_URL=https://mainnet.xlayer-rpc.com

# Default Solana Values
LOOKUP_TABLE_ADDRESS=
RPC_URL=https://api.mainnet.solana.com

# EVM - Fill in your private key and AA wallet address
EVM_EOA_PRIVATE_KEY=
AA_WALLET_ADDRESS=

# Solana - Fill in your SA ID, wallet secret key, and mandatory signer secret key
SA_ID=
WALLET_SECRET_KEY=
MANDATORY_SIGNER_SECRET_KEY=
EOF
fi

if [[ $IS_FIRST_RUN != true ]]; then
  echo "🚀  Starting web server (npm run web) …"
  npm run web
  else
  echo "Set up completed, the next run will start the web server"
fi
# Keep the window open after the server stops so users can read any messages
read -n 1 -s -r -p "\nPress any key to close this window…"