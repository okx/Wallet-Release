@echo off
setlocal enabledelayedexpansion

cd /d "%~dp0"

for %%A in (node.exe) do if "%%~$PATH:A"=="" (
    echo Node.js not found in PATH. Install from https://nodejs.org/en/download/
    pause
    exit /b 1
) else (
    echo Node.js found: %%~$PATH:A
)
for %%A in (npm.cmd) do if "%%~$PATH:A"=="" (
    echo npm not found in PATH. Re-install Node.js or add npm to PATH.
    pause
    exit /b 1
)

if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
) else (
    echo Dependencies already installed.
)

if not exist ".env" (
    echo Creating default .env file...
    > .env (
        echo # EVM
        echo EVM_EOA_PRIVATE_KEY=
        echo EVM_DEXTRADING_ADDRESS=
        echo.
        echo # Solana
        echo SOL_EOA_PRIVATE_KEY=
        echo SOL_DEXTRADING_ADDRESS=
    )
    echo Setup completed! Launch this script again to start the web server.
    goto :END
)

set "PID="
for /f "skip=4 tokens=1,2,3,4,5" %%a in ('netstat -ano ^| find ":3000"') do (
    if "%%e"=="" (set PID=%%d) else (set PID=%%e)
)
if defined PID (
    echo Port 3000 is already in use by process ID %PID%.
    echo Terminate the process or change the port, then try again.
    pause
    exit /b 1
)

echo Starting web server...
call npm run web

:END
:: Keep window open so users can read output
echo.
echo Press any key to close this window...
pause >nul