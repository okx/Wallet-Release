@echo off
setlocal

:: Change to script directory
cd /d "%~dp0"

:: Check if Node.js is installed
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js is not installed on this system.
    echo Please install Node.js from https://nodejs.org/en/download/
    echo Exiting script. Please run again after installing Node.js.
    pause
    exit /b 1
)else (
    echo Node.js is installed on this system.
)

if not exist "node_modules" (
    echo Installing dependencies...
    npm install
)else (
    echo Dependencies already installed.
)

:: Create .env file if it doesn't exist
if not exist ".env" (
    echo Creating default .env file...
    (
        echo # Default RPC URLs
        echo DEFAULT_SOLANA_RPC_URL=https://api.mainnet.solana.com
        echo DEFAULT_BASE_RPC_URL=https://mainnet.base.org
        echo DEFAULT_BSC_RPC_URL=https://bsc-dataseed.binance.org/
        echo DEFAULT_XLAYER_RPC_URL=https://mainnet.xlayer-rpc.com
        echo.
        echo # Default Solana Values
        echo LOOKUP_TABLE_ADDRESS=
        echo RPC_URL=https://api.mainnet.solana.com
        echo.
        echo # EVM - Fill in your private key and AA wallet address
        echo EVM_EOA_PRIVATE_KEY=
        echo EVM_AA_ADDRESS=
        echo.
        echo # Solana - Fill in your SA ID, wallet secret key, and mandatory signer secret key
        echo SA_ID=
        echo WALLET_SECRET_KEY=
        echo MANDATORY_SIGNER_SECRET_KEY=
    ) > .env
    echo Setup completed! The next run will start the web server.
    goto end
)

:: Check if port 3000 is already in use before launching the web server
for /f "tokens=5" %%i in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    echo Port 3000 is already in use by process ID %%i.
    echo Please terminate the process using it and try again.
    pause
    exit /b 1
)

:: Start web server
echo Starting web server (npm run web)...
npm run web

:end
:: Keep window open
echo.
echo Press any key to close this window...
pause >nul