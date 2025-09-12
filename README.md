# Emergency Escape - Multi-Chain Asset Off-Boarding Tool

A comprehensive tool for transferring assets from Smart Account vaults across multiple blockchains (Solana, Base, BSC, xLayer).

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

```
# Default RPC urls
DEFAULT_SOLANA_RPC_URL=https://api.mainnet.solana.com
DEFAULT_BASE_RPC_URL=https://mainnet.base.org
DEFAULT_BSC_RPC_URL=https://bsc-dataseed.binance.org/
DEFAULT_XLAYER_RPC_URL=https://mainnet.xlayer-rpc.com

# Default Solana Values
LOOKUP_TABLE_ADDRESS=Gjj1dX4UR6HcXGDm48wJHCZjompq5SJ6eKse1Trfq6Qe
RPC_URL=https://api.mainnet.solana.com

# EVM
EVM_EOA_PRIVATE_KEY= <your secret key>
EVM_AA_ADDRESS= <your AA address>

# Solana
SA_ID= <your AA ID>
WALLET_SECRET_KEY= <your secret key>
MANDATORY_SIGNER_SECRET_KEY= <your secret key>
```

Notice: the solana secret key have to be in 64-byte-array format to suit Uint8Array type eg. [1,2,3, ...]

### Usage

#### 🌐 Web Interface (Recommended)
```bash
# Start the web server
npm run web
```
Then open your browser to `http://localhost:3000`

**Common Flow (Both Interfaces):**
1. Choose chain (Solana/Base/BSC/xLayer)
2. Select asset type (Native Token/Fungible Token)
3. For fungible tokens, input token contract address
4. Input recipient address & amount
5. Review estimated gas fee and balance
6. Confirm transaction
7. Get transaction hash for verification

## Supported Chains
- **Solana** (Native SOL + SPL tokens)
- **Base** (Native ETH + ERC-20)
- **BSC** (Native BNB + BEP-20)
- **xLayer** (Native OKB + ERC-20)

## 🔐 Security
- Private keys are loaded from environment variables
- Memory cleanup patterns implemented for sensitive data
- Both interfaces use identical security practices
- Consider using hardware wallets for production
- Web interface runs on localhost only

## ❓ Troubleshooting

### Web Interface Issues
- **Port already in use**: kill process on port 3000

### Common Issues
- **"Invalid private key"**: Ensure Solana keys are in correct 64-byte array format
- **"SA_ID not set"**: Check your `.env` file has all required variables
- **"Insufficient balance"**: Verify you have enough tokens/native currency
- **"Too many decimals"**: Check token decimal precision matches your input

### Environment Variables
All chains require their respective private keys and addresses to be set in `.env`:
- **Solana**: `WALLET_SECRET_KEY`, `SA_ID`
- **EVM chains**: `EVM_EOA_PRIVATE_KEY`, `AA_WALLET_ADDRESS`
