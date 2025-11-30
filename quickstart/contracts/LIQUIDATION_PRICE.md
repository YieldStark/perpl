# Liquidation Price Calculation

## Overview

The `calculate_liquidation_price()` function allows users to see the liquidation price **before** opening a position. This helps users understand their risk and make informed trading decisions.

## Function Signature

```cairo
fn calculate_liquidation_price(
    self: @ContractState,
    market_id: felt252,
    collateral_amount: u256,
    position_size_usd: u256,
    entry_price: u256,
    is_long: bool
) -> u256
```

## Parameters

- `market_id`: Market identifier (e.g., BTC/USD)
- `collateral_amount`: Amount of collateral (margin) in yUSD
- `position_size_usd`: Position size in USD
- `entry_price`: Entry price for the position
- `is_long`: `true` for long position, `false` for short position

## Returns

- `liquidation_price`: The price at which the position will be liquidated

## How It Works

### Formula

**For Long Positions:**
```
Liquidation happens when:
  remaining_collateral < position_size * liquidation_threshold / 10000

Where:
  remaining_collateral = margin + PnL
  PnL = (liquidation_price - entry_price) * size / entry_price

Solving for liquidation_price:
  liquidation_price = entry_price - (max_loss * entry_price / size)
  
Where:
  max_loss = margin - (position_size * threshold / 10000)
```

**For Short Positions:**
```
Similar but opposite:
  liquidation_price = entry_price + (max_loss * entry_price / size)
```

### Liquidation Threshold

- **Current Threshold**: 3% (300 BPS)
- This means liquidation occurs when remaining collateral falls below 3% of position size

## Example Calculation

### Long Position Example

**Input:**
- Market: BTC/USD
- Entry Price: $50,000
- Collateral: 1,000 yUSD
- Position Size: $10,000 (10x leverage)
- Is Long: `true`
- Liquidation Threshold: 3% (300 BPS)

**Calculation:**
```
1. Required margin at liquidation = $10,000 * 300 / 10000 = $300
2. Max loss = $1,000 - $300 = $700
3. Price decrease = $700 * $50,000 / $10,000 = $3,500
4. Liquidation Price = $50,000 - $3,500 = $46,500
```

**Result:** Position will be liquidated if BTC price drops to **$46,500**

### Short Position Example

**Input:**
- Market: BTC/USD
- Entry Price: $50,000
- Collateral: 1,000 yUSD
- Position Size: $10,000 (10x leverage)
- Is Long: `false`
- Liquidation Threshold: 3% (300 BPS)

**Calculation:**
```
1. Required margin at liquidation = $10,000 * 300 / 10000 = $300
2. Max loss = $1,000 - $300 = $700
3. Price increase = $700 * $50,000 / $10,000 = $3,500
4. Liquidation Price = $50,000 + $3,500 = $53,500
```

**Result:** Position will be liquidated if BTC price rises to **$53,500**

## Frontend Integration

### TypeScript Example

```typescript
// Get RiskManager contract
const riskManager = await getContractAt("IRiskManager", riskManagerAddress);

// Calculate liquidation price before opening position
const liquidationPrice = await riskManager.calculate_liquidation_price(
  marketId,           // e.g., "BTC/USD"
  collateralAmount,   // e.g., 1000 * 10^18 (1000 yUSD)
  positionSize,       // e.g., 10000 * 10^18 ($10,000)
  entryPrice,         // e.g., 50000 * 10^18 ($50,000)
  isLong              // true for long, false for short
);

// Get current price
const currentPrice = await oracle.get_price(marketId);

// Calculate distance to liquidation
const priceDiff = isLong 
  ? currentPrice - liquidationPrice  // For long: how much price can drop
  : liquidationPrice - currentPrice; // For short: how much price can rise

const distancePercent = (priceDiff / currentPrice) * 100;

// Display to user
console.log(`Entry Price: $${entryPrice / 1e18}`);
console.log(`Current Price: $${currentPrice / 1e18}`);
console.log(`Liquidation Price: $${liquidationPrice / 1e18}`);
console.log(`Distance to Liquidation: ${distancePercent.toFixed(2)}%`);
```

### React Component Example

```tsx
import { useContractRead } from '@starknet-react/hooks';

function LiquidationPriceDisplay({ 
  marketId, 
  collateral, 
  positionSize, 
  entryPrice, 
  isLong 
}) {
  const { data: liquidationPrice } = useContractRead({
    functionName: 'calculate_liquidation_price',
    args: [marketId, collateral, positionSize, entryPrice, isLong],
    abi: RiskManagerABI,
    address: riskManagerAddress,
  });

  const { data: currentPrice } = useContractRead({
    functionName: 'get_price',
    args: [marketId],
    abi: OracleABI,
    address: oracleAddress,
  });

  if (!liquidationPrice || !currentPrice) return null;

  const distance = isLong
    ? ((currentPrice - liquidationPrice) / currentPrice) * 100
    : ((liquidationPrice - currentPrice) / currentPrice) * 100;

  return (
    <div className="liquidation-info">
      <h3>Liquidation Price</h3>
      <p className="price">${liquidationPrice / 1e18}</p>
      <p className="distance">
        {distance > 0 
          ? `${distance.toFixed(2)}% away from liquidation`
          : 'Position would be liquidated at current price'
        }
      </p>
      <div className="warning">
        ⚠️ If price reaches ${liquidationPrice / 1e18}, your position will be liquidated
      </div>
    </div>
  );
}
```

## UI Display Suggestions

### Before Opening Position

Show liquidation price prominently:
```
┌─────────────────────────────────────┐
│  Position Preview                   │
├─────────────────────────────────────┤
│  Entry Price:        $50,000        │
│  Position Size:      $10,000        │
│  Leverage:           10x            │
│  Collateral:         1,000 yUSD     │
│                                     │
│  ⚠️ Liquidation Price: $46,500      │
│  Distance:            7.0%          │
│                                     │
│  [Confirm] [Cancel]                │
└─────────────────────────────────────┘
```

### Real-time Monitoring

For open positions, show:
- Current price
- Liquidation price
- Distance to liquidation (percentage)
- Visual indicator (green/yellow/red based on distance)

## Important Notes

1. **Funding Fees**: The current calculation doesn't include funding fees. In production, you may want to add an estimated funding fee to make the calculation more accurate.

2. **Price Impact**: Large positions may have price impact, which could affect the actual liquidation price.

3. **Oracle Updates**: Liquidation price is calculated based on the entry price. If the oracle price updates, the actual liquidation may occur at a slightly different price.

4. **Dynamic Threshold**: The liquidation threshold (3%) is currently a constant. If you plan to make it configurable per market, update the function accordingly.

## Testing

### Test Cases

1. **Long Position - Normal Case**
   - Entry: $50,000
   - Collateral: $1,000
   - Size: $10,000
   - Expected: ~$46,500

2. **Short Position - Normal Case**
   - Entry: $50,000
   - Collateral: $1,000
   - Size: $10,000
   - Expected: ~$53,500

3. **High Leverage**
   - Entry: $50,000
   - Collateral: $500
   - Size: $10,000 (20x leverage)
   - Expected: Closer to entry price

4. **Low Leverage**
   - Entry: $50,000
   - Collateral: $5,000
   - Size: $10,000 (2x leverage)
   - Expected: Much further from entry price

5. **Edge Case - Already Below Threshold**
   - If collateral < required_margin_at_liquidation
   - Returns entry_price (position would be liquidated immediately)

## Integration with Position Opening Flow

```typescript
async function openPositionWithLiquidationPreview(
  marketId: string,
  collateral: bigint,
  leverage: number,
  entryPrice: bigint,
  isLong: boolean
) {
  // 1. Calculate position size
  const positionSize = (collateral * BigInt(leverage)) / 100n;
  
  // 2. Get liquidation price
  const liquidationPrice = await riskManager.calculate_liquidation_price(
    marketId,
    collateral,
    positionSize,
    entryPrice,
    isLong
  );
  
  // 3. Get current price
  const currentPrice = await oracle.get_price(marketId);
  
  // 4. Show preview to user
  const preview = {
    entryPrice,
    currentPrice,
    liquidationPrice,
    distance: calculateDistance(currentPrice, liquidationPrice, isLong),
  };
  
  // 5. User confirms
  const confirmed = await showPreviewDialog(preview);
  
  if (confirmed) {
    // 6. Open position
    await openPosition(...);
  }
}
```

## Summary

The `calculate_liquidation_price()` function provides users with critical risk information before opening a position. This transparency helps users:

- ✅ Understand their risk exposure
- ✅ Make informed trading decisions
- ✅ Avoid unexpected liquidations
- ✅ Plan their position management strategy

Always display this information prominently in your UI before users commit to opening a position!
























