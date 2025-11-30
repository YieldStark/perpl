# Order Types - Market, Limit, and TWAP

## Overview

The system supports three order types for opening positions:

1. **Market Order** - Executes immediately at current price
2. **Limit Order** - Executes when trigger price is reached
3. **TWAP Order** - Breaks order into chunks over time using Time Weighted Average Price

---

## 1. Market Order

### Description
Executes immediately at the current oracle price. Best for users who want guaranteed execution.

### Flow
```
User → Router.create_market_order(proof, public_inputs, market_id, is_long, size, collateral)
     → OrderHandler.create_market_order()
     → Oracle.update_price_from_pragma() (fresh price)
     → PositionHandler.open_position() (immediate execution)
     → Position opened at current price
```

### Function Signature
```cairo
fn create_market_order(
    ref self: TContractState,
    proof: Span<felt252>,
    public_inputs: Span<felt252>,
    market_id: felt252,
    is_long: bool,
    size: u256,
    collateral_amount: u256
) -> felt252
```

### Pros
- ✅ Guaranteed execution
- ✅ Immediate
- ✅ Simple

### Cons
- ❌ Slippage risk
- ❌ No price control

### Example
```cairo
// User wants to buy BTC/USD long immediately
router.create_market_order(
    proof,
    public_inputs,
    "BTC/USD",
    true,  // is_long
    10000, // size: $10,000
    1000   // collateral: 1,000 yUSD
);
// Executes immediately at current BTC price
```

---

## 2. Limit Order

### Description
Executes only when the oracle price reaches your target price (or better).

- **Long**: Executes when price ≤ trigger_price (buy at or below)
- **Short**: Executes when price ≥ trigger_price (sell at or above)

### Flow
```
User → Router.create_limit_order(market_id, is_long, size, trigger_price, collateral)
     → OrderHandler.create_limit_order()
     → Order stored (not executed yet)
     
Keeper monitors orders
     → When trigger_price reached:
     → OrderHandler.execute_limit_order(proof, public_inputs, order_commitment)
     → Oracle.update_price_from_pragma() (fresh price)
     → Check trigger price reached
     → PositionHandler.open_position() (execute)
     → Order removed
```

### Function Signatures
```cairo
// Create limit order
fn create_limit_order(
    ref self: TContractState,
    market_id: felt252,
    is_long: bool,
    size: u256,
    trigger_price: u256,
    collateral_amount: u256
) -> felt252

// Execute limit order (keeper calls)
fn execute_limit_order(
    ref self: TContractState,
    proof: Span<felt252>,
    public_inputs: Span<felt252>,
    order_commitment: felt252
)
```

### Pros
- ✅ No slippage (executes at target price)
- ✅ Price control
- ✅ Can set better prices

### Cons
- ❌ Might not fill (if price never reaches trigger)
- ❌ Requires keeper monitoring

### Example
```cairo
// User wants to buy BTC/USD long when price drops to $48,000
let order_commitment = router.create_limit_order(
    "BTC/USD",
    true,      // is_long
    10000,     // size: $10,000
    48000,     // trigger_price: $48,000
    1000       // collateral: 1,000 yUSD
);

// Keeper monitors and executes when BTC price ≤ $48,000
router.execute_limit_order(proof, public_inputs, order_commitment);
```

---

## 3. TWAP Order (Time Weighted Average Price)

### Description
Breaks a large order into small chunks executed over time. Uses Pragma's TWAP feed to get average price over the execution period.

### How It Works
1. User creates TWAP order with:
   - Total size
   - Duration (5 minutes to 24 hours)
   - Chunk interval (minimum 5 minutes)

2. Order is divided into chunks:
   - Number of chunks = duration / chunk_interval
   - Chunk size = total_size / num_chunks

3. Keeper executes chunks periodically:
   - Every `chunk_interval` seconds
   - Uses TWAP price from Pragma
   - Each chunk opens a position

4. Order completes when:
   - All chunks executed, OR
   - Duration expires

### Flow
```
User → Router.create_twap_order(market_id, is_long, total_size, duration, chunk_interval, collateral)
     → OrderHandler.create_twap_order()
     → TWAP order stored
     → Chunk size calculated
     
Keeper executes chunks periodically:
     → Every chunk_interval seconds:
     → OrderHandler.execute_twap_chunk(proof, public_inputs, twap_order_commitment)
     → Oracle.get_twap() (get TWAP price from Pragma)
     → Calculate chunk size and collateral
     → PositionHandler.open_position() (execute chunk)
     → Update executed_size
     → Repeat until complete
```

### Function Signatures
```cairo
// Create TWAP order
fn create_twap_order(
    ref self: TContractState,
    market_id: felt252,
    is_long: bool,
    total_size: u256,
    duration: u64,           // Total duration in seconds (300-86400)
    chunk_interval: u64,     // Interval between chunks in seconds (min 300)
    collateral_amount: u256
) -> felt252

// Execute next chunk (keeper calls periodically)
fn execute_twap_chunk(
    ref self: TContractState,
    proof: Span<felt252>,
    public_inputs: Span<felt252>,
    twap_order_commitment: felt252
)

// Cancel TWAP order (if not fully executed)
fn cancel_twap_order(
    ref self: TContractState,
    twap_order_commitment: felt252
)
```

### TWAP Price Calculation
Uses Pragma's Summary Stats contract:
```cairo
let (twap_price, decimals) = oracle.get_twap(
    market_id,
    duration,      // Time period for TWAP
    start_time     // Start timestamp
);
```

### Constraints
- **Duration**: 300 seconds (5 min) to 86400 seconds (24 hours)
- **Chunk Interval**: Minimum 300 seconds (5 minutes)
- **Chunk Interval**: Must be ≤ duration

### Pros
- ✅ Reduces market impact
- ✅ Gets average price over time
- ✅ Better for large orders
- ✅ Less slippage

### Cons
- ❌ Takes time to complete
- ❌ Requires keeper execution
- ❌ Multiple gas costs (one per chunk)

### Example
```cairo
// User wants to buy $100,000 BTC/USD over 30 minutes
// Chunks every 5 minutes = 6 chunks of ~$16,667 each

let twap_commitment = router.create_twap_order(
    "BTC/USD",
    true,      // is_long
    100000,    // total_size: $100,000
    1800,      // duration: 30 minutes (1800 seconds)
    300,       // chunk_interval: 5 minutes (300 seconds)
    10000      // collateral: 10,000 yUSD
);

// Keeper executes chunks:
// - At 0:00 → Execute chunk 1 (~$16,667)
// - At 5:00 → Execute chunk 2 (~$16,667)
// - At 10:00 → Execute chunk 3 (~$16,667)
// - At 15:00 → Execute chunk 4 (~$16,667)
// - At 20:00 → Execute chunk 5 (~$16,667)
// - At 25:00 → Execute chunk 6 (~$16,667)
// - Order complete!
```

### TWAP Order Structure
```cairo
pub struct TWAPOrder {
    pub commitment: felt252,
    pub market_id: felt252,
    pub is_long: bool,
    pub total_size: u256,
    pub chunk_size: u256,           // Size per chunk
    pub duration: u64,               // Total duration in seconds
    pub chunk_interval: u64,         // Interval between chunks
    pub start_time: u64,
    pub end_time: u64,
    pub executed_size: u256,         // Total size executed so far
    pub last_execution_time: u64,    // Last chunk execution timestamp
    pub total_collateral: u256,      // Total collateral
    pub executed_collateral: u256,   // Collateral used so far
    pub is_active: bool,
    pub created_at: u64,
}
```

---

## Oracle Integration

### Market & Limit Orders
- Use `Oracle.update_price_from_pragma()` → `Oracle.get_price()`
- Gets current spot price from Pragma

### TWAP Orders
- Use `Oracle.get_twap()` → Calls Pragma Summary Stats
- Gets Time Weighted Average Price over specified period
- Uses Pragma's checkpoint system (checkpoints every 5 minutes)

### Pragma Integration
```cairo
// For Market/Limit: Spot price
oracle.update_price_from_pragma(market_id);
let price = oracle.get_price(market_id);

// For TWAP: Average price
let (twap_price, decimals) = oracle.get_twap(
    market_id,
    duration,
    start_time
);
```

---

## Keeper Requirements

### Limit Orders
- Monitor all limit orders
- Check if current price has reached trigger price
- Execute when trigger reached

### TWAP Orders
- Monitor all active TWAP orders
- Check if `chunk_interval` has passed since last execution
- Execute next chunk using TWAP price
- Continue until order complete or expired

---

## Events

### Market Order
- `MarketOrderExecuted`: When market order executes

### Limit Order
- `LimitOrderCreated`: When limit order is created
- `LimitOrderExecuted`: When limit order executes

### TWAP Order
- `TWAPOrderCreated`: When TWAP order is created
- `TWAPChunkExecuted`: When each chunk executes
- `TWAPOrderCancelled`: When TWAP order is cancelled

---

## Summary

| Order Type | Execution | Price Source | Keeper Required | Use Case |
|------------|-----------|--------------|-----------------|----------|
| **Market** | Immediate | Current spot price | No | Quick execution |
| **Limit** | When trigger reached | Current spot price | Yes | Price control |
| **TWAP** | Over time (chunks) | TWAP price | Yes | Large orders, reduce impact |

All order types:
- ✅ Support long and short positions
- ✅ Require ZK proofs for privacy
- ✅ Use Pragma Oracle for price feeds
- ✅ Integrate with PositionHandler for execution
- ✅ Emit events for off-chain indexing
























