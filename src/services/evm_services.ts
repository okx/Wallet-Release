import { ethers, Contract } from 'ethers';
import evmExecuteABI from '../evmExecuteABI.json';
import { 
  createTokenAddressRow, 
  getNativeTokenSymbol 
} from '../template-renderer';
import { BASE_RPC_URL, BNB_CHAIN_RPC_URL, XLAYER_RPC_URL } from '../consts';
import { 
  validateEvmTransactionInput, 
  validateEnvironmentVariable,
  validateEvmPrivateKey,
  ValidationError
} from '../helpers/validation';

export type SupportedChain = 'Base' | 'BNB_Chain' | 'xLayer';

const DEFAULT_RPCS: Record<SupportedChain, string> = {
  Base: BASE_RPC_URL,
  BNB_Chain: BNB_CHAIN_RPC_URL,
  xLayer: XLAYER_RPC_URL,
};

// ----- helper functions -----
const createProvider = (chain: SupportedChain) =>
  new ethers.JsonRpcProvider(new ethers.FetchRequest(DEFAULT_RPCS[chain]));

const createWallet = (privateKey: string, provider: ethers.JsonRpcProvider) =>
  new ethers.Wallet(privateKey, provider);

const ERC20_IFACE = new ethers.Interface([
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to,uint256 amount) external returns (bool)',
  'function decimals() view returns (uint8)'
]);

const getTokenDecimals = async (tokenContract: Contract): Promise<number> => {
  try {
    return await tokenContract.decimals();
  } catch {
    return 18;
  }
};

// ----- user input state -----
interface EvmTransactionState {
  chain: string;
  assetType: string;
  tokenAddress?: string;
  recipient: string;
  amount: string;
  amountStr: string;
}

// ----- main functions -----
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

  
  //2. Get AA wallet, provider, wallet (keypair)
  const EVM_DEXTRADING_ADDRESS = validateEnvironmentVariable('EVM_DEXTRADING_ADDRESS', process.env.EVM_DEXTRADING_ADDRESS);
  const provider = createProvider(validatedInput.chain as SupportedChain);
  const EVM_EOA_PRIVATE_KEY = validateEvmPrivateKey(process.env.EVM_EOA_PRIVATE_KEY ?? '');
  const wallet = createWallet(EVM_EOA_PRIVATE_KEY, provider);

  //3. Check if AA has enough balance, update balanceInfo
  let balanceInfo = '';
  let estimatedFee = '';

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
    const tokenContract = new Contract(validatedInput.tokenAddress!, ERC20_IFACE, wallet);
    
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

  //4. Estimate gas fee, update estimatedFee
  try {
    const SmartAccountContract = new Contract(EVM_DEXTRADING_ADDRESS, evmExecuteABI, wallet);
    let calls: Array<{ target: string; value: bigint; data: string }> = [];
    
    if (validatedInput.assetType === 'Native Token') {
      console.log("amount: ", validatedInput.amount.toString());
      const value = ethers.parseEther(validatedInput.amount.toString());
      calls = [{ target: validatedInput.recipient, value, data: '0x' }];
    } else {
      const tokenContract = new Contract(validatedInput.tokenAddress!, ERC20_IFACE, wallet);
      const decimals = await getTokenDecimals(tokenContract);
      
      let amtInBaseUnits: bigint;
      try {
        amtInBaseUnits = ethers.parseUnits(validatedInput.amount.toString(), decimals);
      } catch {
        throw new ValidationError('Invalid amount for token decimals', 'amount');
      }
      const data = ERC20_IFACE.encodeFunctionData('transfer', [validatedInput.recipient, amtInBaseUnits]);
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
  //1. Get AA wallet, provider, wallet (keypair)
  const AAWalletAddress = validateEnvironmentVariable('EVM_DEXTRADING_ADDRESS', process.env.EVM_DEXTRADING_ADDRESS);
  const provider = createProvider(state.chain as SupportedChain);
  const EOA_KEY = validateEvmPrivateKey(process.env.EVM_EOA_PRIVATE_KEY ?? '');
  const wallet = createWallet(EOA_KEY, provider);

  // 2. Form EVM calldata to transfer Native Token or ERC20 Token
  let calls: Array<{ target: string; value: bigint; data: string }> = [];

  if (state.assetType === 'Native Token') {
    const value = ethers.parseEther(state.amountStr);
    calls = [{ target: state.recipient, value, data: '0x' }];
  } else {
    // ERC20 Token
    const tokenContract = new Contract(state.tokenAddress!, ERC20_IFACE, wallet);
    const decimals = await getTokenDecimals(tokenContract);
    
      let amtInBaseUnits: bigint;
    try {
      amtInBaseUnits = ethers.parseUnits(state.amountStr, decimals);
    } catch {
      throw new ValidationError('Invalid amount for token decimals', 'amount');
    }
    const data = ERC20_IFACE.encodeFunctionData('transfer', [state.recipient, amtInBaseUnits]);
    calls = [{ target: state.tokenAddress!, value: 0n, data }];
  }

  // 3. Execute transaction
  const SmartAccountContract = new Contract(AAWalletAddress, evmExecuteABI, wallet);
  try {
    const tx = await SmartAccountContract.execute(calls);
    return tx.hash;
  } catch (err) {
    throw new ValidationError('Transaction failed : ' + err['shortMessage'], 'transaction');
  }
}
