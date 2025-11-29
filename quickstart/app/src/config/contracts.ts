// Contract addresses on Ztarknet
export const CONTRACTS = {
  // Main Router - Entry point for all trading operations
  PERP_ROUTER: '0x06cdd1311b7bf1bba7032410c5e49d68201c74bae2d40ac15007cc68d381e35e',
  
  // Handlers
  POSITION_HANDLER: '0x034fefb6137bc137491b2226a362d67a1485496e02e9b261b273f39d7b97aebd',
  ORDER_HANDLER: '0x06a3de8fe9c30b50189838625d904b9519597c0288de03b1bc652266c8b37836',
  LIQUIDATION_HANDLER: '0x0099200e8b478e108418620ba6bebc8ad0afd51d74f310c7969fe6517f2a9803',
  
  // Core Infrastructure
  DATA_STORE: '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e',
  ORACLE: '0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674',
  COLLATERAL_VAULT: '0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d',
  EVENT_EMITTER: '0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02',
  
  // Verifier
  VERIFIER: '0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d',
  
  // Tokens
  YUSD_TOKEN: '0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda',
} as const;

// Network Configuration
export const NETWORK = {
  RPC_URL: 'https://ztarknet-madara.d.karnot.xyz',
  EXPLORER_URL: 'https://explorer-zstarknet.d.karnot.xyz',
  CHAIN_ID: '0x534e5f4d41494e', // SN_MAIN (adjust if needed)
} as const;

// Market IDs for Ztarknet (used in contracts)
// Contracts expect the string format directly (e.g., "BTC/USD") as felt252
export const MARKETS = {
  BTC_USD: 'BTC/USD', // String format as felt252
  ETH_USD: 'ETH/USD', // String format as felt252
  LORDS_USD: 'LORDS/USD',
  STRK_USD: 'STRK/USD',
  EKUBO_USD: 'EKUBO/USD',
  DOG_USD: 'DOG/USD',
  BROTHER_USDPLUS: 'BROTHER/USD+',
} as const;

// Market display info
export const MARKET_INFO = {
  [MARKETS.BTC_USD]: { symbol: 'BTC/USD', name: 'Bitcoin', decimals: 8 },
  [MARKETS.ETH_USD]: { symbol: 'ETH/USD', name: 'Ethereum', decimals: 8 },
  [MARKETS.LORDS_USD]: { symbol: 'LORDS/USD', name: 'Lords', decimals: 8 },
  [MARKETS.STRK_USD]: { symbol: 'STRK/USD', name: 'Starknet', decimals: 8 },
  [MARKETS.EKUBO_USD]: { symbol: 'EKUBO/USD', name: 'Ekubo', decimals: 8 },
  [MARKETS.DOG_USD]: { symbol: 'DOG/USD', name: 'Dog', decimals: 8 },
  [MARKETS.BROTHER_USDPLUS]: { symbol: 'BROTHER/USD+', name: 'Brother', decimals: 18 },
} as const;

// Pragma Mainnet Oracle (for frontend price display)
export const PRAGMA_MAINNET = {
  ADDRESS: '0x2a85bd616f912537c50a49a4076db02c00b29b2cdc8a197ce92ed1837fa875b',
  RPC_URL: 'https://starknet.drpc.org',
} as const;

