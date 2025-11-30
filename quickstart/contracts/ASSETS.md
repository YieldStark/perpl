# Supported Assets & Pragma Asset IDs

## Available Markets

| Market | Pragma Asset ID (felt252) | Description |
|--------|---------------------------|-------------|
| BTC/USD | `18669995996566340` | Bitcoin |
| ETH/USD | `19514442401534788` | Ethereum |
| WBTC/USD | `6287680677296296772` | Wrapped Bitcoin |
| LORDS/USD | `1407668255603079598916` | LORDS Token |
| STRK/USD | `6004514686061859652` | Starknet Token |
| EKUBO/USD | `1278253658919688033092` | Ekubo Token |
| DOG/USD | `19227465571717956` | DOG Token |

## Usage in Contracts

```cairo
// In oracle.cairo
const BTC_USD: felt252 = 18669995996566340;
const ETH_USD: felt252 = 19514442401534788;
const WBTC_USD: felt252 = 6287680677296296772;
const LORDS_USD: felt252 = 1407668255603079598916;
const STRK_USD: felt252 = 6004514686061859652;
const EKUBO_USD: felt252 = 1278253658919688033092;
const DOG_USD: felt252 = 19227465571717956;

// Register market
oracle.register_market('BTC/USD', BTC_USD);
```

## Adding New Markets

To add a new market:

1. Get the Pragma asset ID (felt252 conversion of pair string)
2. Register in `MarketRegistry.register_market()`
3. Configure market parameters in `MarketConfig`
























