# Emergency Escape - Multi-Chain Asset Off-Boarding Tool

A CLI tool for transferring assets from Smart Account vaults across multiple blockchains (Solana, Base, BSC, xLayer).

## Quick Start

### Prerequisites
- Node.js 18+
- TypeScript

### Installation
```bash
git clone https://github.com/your-org/Emergency-Escape.git
cd Emergency-Escape
npm install
```

### Environment Setup
Create `.env` file:
```env
# Solana
WALLET_SECRET_KEY=[64-byte-array-or-base58]
SA_ID=<smart_account_address>
DEFAULT_SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# EVM Chains
EVM_EOA_PRIVATE_KEY=0xabc123...
DEFAULT_BASE_RPC_URL=https://mainnet.base.org
DEFAULT_BSC_RPC_URL=https://bsc-dataseed.binance.org
DEFAULT_XLAYER_RPC_URL=https://xlayer-rpc-url
```

### Usage
```bash
#1. Install dependencies
npm install
#2. Run the script src/off_boarding.ts
npm run start
```

**Flow:**
1. Choose chain (Solana/Base/BSC/xLayer)
2. Select asset type (Native Token/Fungible Token)
3. For fungible tokens, input token contract address
4. Input recipient address & amount
5. Review estimated gas fee
6. Confirm transaction (Y/N)
7. Get transaction hash for verification

## Supported Chains
- **Solana** (Native SOL + SPL tokens)
- **Base** (Native ETH + ERC-20)
- **BSC** (Native BNB + BEP-20)
- **xLayer** (Native OKB + ERC-20)

## Security
- Private keys are loaded from environment variables
- Consider using hardware wallets for production
- Memory cleanup patterns implemented for sensitive data


