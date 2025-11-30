// Contract addresses on Ztarknet
export const CONTRACTS = {
  // Main Router - Entry point for all trading operations
  PERP_ROUTER: '0x056ae8ddbb1ae512cf96458d4cf758036913ae849fc2fa0d40a03f8fbd120ffe',
  
  // Handlers
  POSITION_HANDLER: '0x067cc28c5c154c38dece68f21416f0da3db3741b0a4436e7e6a1917a79ee9192',
  ORDER_HANDLER: '0x00f8d5b52b18f0041524b80f775cb9a56f9428a8cd5db2aaaf8765bd3b9ec87f',
  LIQUIDATION_HANDLER: '0x00bbd58ea83c743c669e96619af72542252abbc3f011b9b983449a76268187b2',
  
  // Core Infrastructure
  DATA_STORE: '0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29',
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

