import { ethers, Contract } from 'ethers';
import evmExecuteABI from '../evmExecuteABI.json';
import { 
  createTokenAddressRow, 
  getNativeTokenSymbol 
} from '../template-renderer';
import { BASE_RPC_URL, BSC_RPC_URL, XLAYER_RPC_URL } from '../consts';
import { 
  validateEvmTransactionInput, 
  validateEnvironmentVariable,
  validateEvmPrivateKey,
  ValidationError
} from '../helpers/validation';

type SupportedChain = 'Base' | 'BSC' | 'xLayer';

const DEFAULT_RPCS: Record<SupportedChain, string> = {
  Base: BASE_RPC_URL,
  BSC: BSC_RPC_URL,
  xLayer: XLAYER_RPC_URL,
};

interface EvmTransactionState {
  chain: string;
  assetType: string;
  tokenAddress?: string;
  recipient: string;
  amount: string;
  amountStr: string;
}

export async function processEvmTransaction(
  chain: string,
  assetType: string,
  tokenAddress: string,
  recipient: string,
  amount: string
): Promise<{
  balanceInfo: string;
  estimatedFee: string;
  templateData: any;
}> {
  //1. Validate inputs & environment variables
  const validatedInput = validateEvmTransactionInput({
    chain,
    assetType,
    tokenAddress,
    recipient,
    amount
  });

  const EVM_DEXTRADING_ADDRESS = validateEnvironmentVariable('EVM_DEXTRADING_ADDRESS', process.env.EVM_DEXTRADING_ADDRESS);
  const EVM_EOA_PRIVATE_KEY = validateEvmPrivateKey(process.env.EVM_EOA_PRIVATE_KEY ?? '');

  //2. Get wallet and provider
  const rpcUrl = DEFAULT_RPCS[validatedInput.chain];
  const fetchReq = new ethers.FetchRequest(rpcUrl);
  const provider = new ethers.JsonRpcProvider(fetchReq);

  const wallet = new ethers.Wallet(EVM_EOA_PRIVATE_KEY, provider);

  let balanceInfo = '';
  let estimatedFee = '';

  
  //3. Check balance
  const nativeTokenSymbol = getNativeTokenSymbol(validatedInput.chain);
  const unit = validatedInput.assetType === 'Native Token' ? nativeTokenSymbol : 'tokens';
  
  if (validatedInput.assetType === 'Native Token') {
    const balance = await provider.getBalance(EVM_DEXTRADING_ADDRESS);
    const formattedBalance = ethers.formatEther(balance);
    const requiredAmount = ethers.parseEther(validatedInput.amount.toString());
    
    balanceInfo = `Current Balance: ${formattedBalance} ${unit}`;
    
    if (balance < requiredAmount) {
      throw new ValidationError(`Insufficient balance! Need ${validatedInput.amount}, have ${formattedBalance}`, 'balance');
    }
  } else {
    // ERC20 Token
    const erc20BalanceIface = new ethers.Interface([
      'function balanceOf(address owner) view returns (uint256)',
      'function decimals() view returns (uint8)'
    ]);
    const tokenContract = new Contract(validatedInput.tokenAddress!, erc20BalanceIface, wallet);
    
    try {
      const [balance, decimals] = await Promise.all([
        tokenContract.balanceOf(EVM_DEXTRADING_ADDRESS),
        tokenContract.decimals()
      ]);
      const tokenBalance = ethers.formatUnits(balance, decimals);
      balanceInfo = `Current Token Balance: ${tokenBalance} tokens`;
      
      if (Number(tokenBalance) < validatedInput.amount) {
        throw new ValidationError(`Insufficient token balance! Need ${validatedInput.amount}, have ${tokenBalance}`, 'balance');
      }
    } catch (err) {
      balanceInfo = 'Could not fetch token balance';
      console.warn('Token balance check failed:', err);
    }
  }

  //4. Estimate gas fee
  try {
    const SmartAccountContract = new Contract(EVM_DEXTRADING_ADDRESS, evmExecuteABI, wallet);
    let calls: Array<{ target: string; value: bigint; data: string }> = [];
    
    if (validatedInput.assetType === 'Native Token') {
      const value = ethers.parseEther(validatedInput.amount.toString());
      calls = [{ target: validatedInput.recipient, value, data: '0x' }];
    } else {
      const erc20Iface = new ethers.Interface([
        'function transfer(address to,uint256 amount) external returns (bool)',
        'function decimals() view returns (uint8)'
      ]);
      const tokenContract = new Contract(validatedInput.tokenAddress!, erc20Iface, wallet);
      
      let decimals = 18;
      try {
        decimals = await tokenContract.decimals();
      } catch {}
      
      let amtInBaseUnits: bigint;
      try {
        amtInBaseUnits = ethers.parseUnits(validatedInput.amount.toString(), decimals);
      } catch {
        throw new ValidationError('Invalid amount for token decimals', 'amount');
      }
      const data = erc20Iface.encodeFunctionData('transfer', [validatedInput.recipient, amtInBaseUnits]);
      calls = [{ target: validatedInput.tokenAddress!, value: 0n, data }];
    }

    const gasEstimate: bigint = await (SmartAccountContract.execute as any).estimateGas(calls);
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas;
    if (gasPrice) {
      const estimatedFeeWei = gasEstimate * gasPrice;
      estimatedFee = `${ethers.formatEther(estimatedFeeWei)} ${unit} (gas: ${gasEstimate})`;
    }
  } catch (err) {
    estimatedFee = 'Could not estimate';
  }
  
  const templateData = {
    BLOCKCHAIN: validatedInput.chain,
    ASSET_TYPE: validatedInput.assetType,
    TOKEN_ADDRESS_ROW: createTokenAddressRow(validatedInput.tokenAddress),
    RECIPIENT: validatedInput.recipient,
    AMOUNT: validatedInput.amount.toString(),
    UNIT: unit,
    BALANCE_INFO: balanceInfo,
    ESTIMATED_FEE: estimatedFee,
    EXECUTE_ENDPOINT: '/execute-evm'
  };

  return { balanceInfo, estimatedFee, templateData };
}

export async function executeEvmTransaction(state: EvmTransactionState): Promise<string> {
  // Validate state and environment variables
  const AAWalletAddress = validateEnvironmentVariable('EVM_DEXTRADING_ADDRESS', process.env.EVM_DEXTRADING_ADDRESS);
  
  // Execute EVM transaction
  const EOA_KEY = validateEvmPrivateKey(process.env.EVM_EOA_PRIVATE_KEY ?? '');
  const rpcUrl = DEFAULT_RPCS[state.chain as SupportedChain];
  const fetchReq = new ethers.FetchRequest(rpcUrl);
  const provider = new ethers.JsonRpcProvider(fetchReq);

  const wallet = new ethers.Wallet(EOA_KEY, provider);

  let calls: Array<{ target: string; value: bigint; data: string }> = [];

  if (state.assetType === 'Native Token') {
    const value = ethers.parseEther(state.amountStr);
    calls = [{ target: state.recipient, value, data: '0x' }];
  } else {
    // ERC20 Token
    const erc20Iface = new ethers.Interface([
      'function transfer(address to,uint256 amount) external returns (bool)',
      'function decimals() view returns (uint8)'
    ]);

    const tokenContract = new Contract(state.tokenAddress!, erc20Iface, wallet);
    
    let decimals = 18;
    try {
      decimals = await tokenContract.decimals();
    } catch {}
    
      let amtInBaseUnits: bigint;
    try {
      amtInBaseUnits = ethers.parseUnits(state.amountStr, decimals);
    } catch {
      throw new ValidationError('Invalid amount for token decimals', 'amount');
    }
    const data = erc20Iface.encodeFunctionData('transfer', [state.recipient, amtInBaseUnits]);
    calls = [{ target: state.tokenAddress!, value: 0n, data }];
  }

  const SmartAccountContract = new Contract(AAWalletAddress, evmExecuteABI, wallet);
  try {
    const tx = await SmartAccountContract.execute(calls);
    return tx.hash;
  } catch (err) {
    throw new ValidationError('Transaction failed : ' + err['shortMessage'], 'transaction');
  }
}
