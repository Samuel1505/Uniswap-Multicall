import { useState } from "react";
import { ethers } from "ethers";

// These are Uniswap V2 pair and ERC20 interfaces
const UNISWAP_PAIR_ABI = [
  "function token0() view returns (address)",
  "function token1() view returns (address)",
  "function getReserves() view returns (uint112, uint112, uint32)",
  "function totalSupply() view returns (uint256)"
];
const ERC20_ABI = [
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)"
];

// Multicall contract interface
const MULTICALL_ABI = [
  "function aggregate(tuple(address target, bytes callData)[] calls) view returns (uint256 blockNumber, bytes[] returnData)"
];
const MULTICALL_ADDRESS = "0x5BA1e12693Dc8F9c48aAD8770482f4739bEeD696"; // Ethereum Mainnet Multicall2

// Example Uniswap V2 pair: WETH-USDT
const DEFAULT_PAIR = "0x0d4a11d5EEaaC28EC3F61d100daF4d40471f1852";

export default function UniswapPairInfo() {
  const [pairAddress, setPairAddress] = useState("");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchPairInfo = async () => {
    // Use the input address or default to a known working pair
    const targetAddress = pairAddress || DEFAULT_PAIR;
    
    if (!ethers.isAddress(targetAddress)) {
      setError("Invalid address format");
      return;
    }
    
    setLoading(true);
    setError("");
    
    try {
      // Using Infura's public endpoint
      const provider = new ethers.JsonRpcProvider("https://mainnet.infura.io/v3/84842078b09946638c03157f83405213");
      
      // Create contract instances
      const pairContract = new ethers.Contract(targetAddress, UNISWAP_PAIR_ABI, provider);
      const multicallContract = new ethers.Contract(MULTICALL_ADDRESS, MULTICALL_ABI, provider);
      
      // Prepare initial calls to get token addresses and reserves
      const initialCalls = [
        {
          target: targetAddress,
          callData: pairContract.interface.encodeFunctionData("token0")
        },
        {
          target: targetAddress,
          callData: pairContract.interface.encodeFunctionData("token1")
        },
        {
          target: targetAddress,
          callData: pairContract.interface.encodeFunctionData("getReserves")
        },
        {
          target: targetAddress,
          callData: pairContract.interface.encodeFunctionData("totalSupply")
        }
      ];
      
      // Execute the multicall
      const [, initialResults] = await multicallContract.aggregate(initialCalls);
      
      // Decode results
      const token0 = pairContract.interface.decodeFunctionResult("token0", initialResults[0])[0];
      const token1 = pairContract.interface.decodeFunctionResult("token1", initialResults[1])[0];
      const reserves = pairContract.interface.decodeFunctionResult("getReserves", initialResults[2]);
      const totalSupply = pairContract.interface.decodeFunctionResult("totalSupply", initialResults[3])[0];
      
      // Create ERC20 contract interfaces
      const erc20Interface = new ethers.Interface(ERC20_ABI);
      
      // Prepare token detail calls
      const tokenDetailCalls = [
        {
          target: token0,
          callData: erc20Interface.encodeFunctionData("name")
        },
        {
          target: token0,
          callData: erc20Interface.encodeFunctionData("symbol")
        },
        {
          target: token0,
          callData: erc20Interface.encodeFunctionData("decimals")
        },
        {
          target: token1,
          callData: erc20Interface.encodeFunctionData("name")
        },
        {
          target: token1,
          callData: erc20Interface.encodeFunctionData("symbol")
        },
        {
          target: token1,
          callData: erc20Interface.encodeFunctionData("decimals")
        }
      ];
      
      // Execute the token details multicall
      const [, tokenDetailResults] = await multicallContract.aggregate(tokenDetailCalls);
      
      // Decode token details
      const token0Name = erc20Interface.decodeFunctionResult("name", tokenDetailResults[0])[0];
      const token0Symbol = erc20Interface.decodeFunctionResult("symbol", tokenDetailResults[1])[0];
      const token0Decimals = erc20Interface.decodeFunctionResult("decimals", tokenDetailResults[2])[0];
      const token1Name = erc20Interface.decodeFunctionResult("name", tokenDetailResults[3])[0];
      const token1Symbol = erc20Interface.decodeFunctionResult("symbol", tokenDetailResults[4])[0];
      const token1Decimals = erc20Interface.decodeFunctionResult("decimals", tokenDetailResults[5])[0];
      
      setData({
        pairAddress: targetAddress,
        token0: { address: token0, name: token0Name, symbol: token0Symbol, decimals: token0Decimals },
        token1: { address: token1, name: token1Name, symbol: token1Symbol, decimals: token1Decimals },
        reserves: { 
          reserve0: ethers.formatUnits(reserves[0], token0Decimals), 
          reserve1: ethers.formatUnits(reserves[1], token1Decimals) 
        },
        totalSupply: ethers.formatEther(totalSupply)
      });
    } catch (error) {
      console.error(error);
      setError("Error fetching data: " + error.message);
    }
    setLoading(false);
  };

  // Function to truncate addresses
  const truncateAddress = (address) => {
    return address.slice(0, 6) + '...' + address.slice(-4);
  };

  return (
    <div className="app-container">
      <div className="app-content">
        {/* Header */}
        <div className="header">
          <h1 className="title">Uniswap V2 Pair </h1>
          <p className="subtitle">Analyze liquidity pairs and token data from Uniswap V2</p>
        </div>
        
        {/* Search Box */}
        <div className="search-container">
          <input
            type="text"
            placeholder="Enter Uniswap V2 Pair Address (e.g. 0x0d4a11d5...)"
            className="address-input"
            value={pairAddress}
            onChange={(e) => setPairAddress(e.target.value)}
          />
          <button
            className={`fetch-button ${loading ? 'loading' : ''}`}
            onClick={fetchPairInfo}
            disabled={loading}
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              "Fetch Pair Info"
            )}
          </button>
          
          {error && <div className="error-message">{error}</div>}
        </div>
        
        {/* Results */}
        {data && (
          <div className="results-container">
            <div className="pair-header">
              <h2 className="pair-title">Pair Information</h2>
              <div className="pair-address">
                <span className="label">Address:</span> 
                <span className="value">{truncateAddress(data.pairAddress)}</span>
              </div>
            </div>
            
            <div className="token-containers">
              <div className="token-card token0">
                <h3 className="token-title">Token 0</h3>
                <div className="token-symbol">{data.token0.symbol}</div>
                <div className="token-name">{data.token0.name}</div>
                <div className="token-detail">
                  <span className="label">Address:</span> 
                  <span className="value">{truncateAddress(data.token0.address)}</span>
                </div>
                <div className="token-detail">
                  <span className="label">Decimals:</span> 
                  <span className="value">{data.token0.decimals}</span>
                </div>
                <div className="token-detail">
                  <span className="label">Reserve:</span> 
                  <span className="value">{parseFloat(data.reserves.reserve0).toLocaleString()}</span>
                </div>
              </div>
              
              <div className="token-card token1">
                <h3 className="token-title">Token 1</h3>
                <div className="token-symbol">{data.token1.symbol}</div>
                <div className="token-name">{data.token1.name}</div>
                <div className="token-detail">
                  <span className="label">Address:</span> 
                  <span className="value">{truncateAddress(data.token1.address)}</span>
                </div>
                <div className="token-detail">
                  <span className="label">Decimals:</span> 
                  <span className="value">{data.token1.decimals}</span>
                </div>
                <div className="token-detail">
                  <span className="label">Reserve:</span> 
                  <span className="value">{parseFloat(data.reserves.reserve1).toLocaleString()}</span>
                </div>
              </div>
            </div>
            
            <div className="pool-info">
              <h3 className="pool-title">Pool Information</h3>
              <div className="pool-detail">
                <span className="label">Total Supply:</span> 
                <span className="value">{parseFloat(data.totalSupply).toLocaleString()} LP Tokens</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}