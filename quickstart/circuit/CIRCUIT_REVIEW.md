# Noir Circuit Review

## Current Status

### ✅ Implemented Functions (6)

1. **open_position_market** - Complete
   - Validates price freshness
   - Validates execution price
   - Validates slippage
   - Validates margin and leverage
   - Generates commitment

2. **open_position_limit** - Complete
   - Same as market + trigger price validation
   - Validates trigger reached

3. **close_position** - Complete
   - Validates price freshness
   - Calculates PnL
   - Calculates fees
   - Validates collateral
   - Generates commitment

4. **close_position_take_profit** - Complete
   - Same as close + TP validation

5. **close_position_stop_loss** - Complete
   - Same as close + SL validation

6. **check_liquidation** - Complete
   - Validates price freshness
   - Calculates PnL
   - Checks if liquidatable
   - Generates commitment

### ❌ Missing Functions

1. **open_position_twap** - NOT IMPLEMENTED
   - Need to add TWAP order opening logic
   - Should validate TWAP price from oracle
   - Should validate chunk execution timing

### ⚠️ Issues Found

1. **Main function** - Missing TWAP action routing
   - Action 6 should be for TWAP orders
   - Need to add routing logic

2. **Commitment generation** - Should include account address
   - Contracts store `position.account` (depositing address)
   - Circuit should include this in commitment

3. **Public inputs structure** - Need to align with contract expectations
   - Contracts expect specific public input format
   - Need to ensure consistency

## What Needs to Be Done

1. Add `open_position_twap` function
2. Update main function to route TWAP orders
3. Add account address to commitments (if needed)
4. Add more comprehensive tests
5. Ensure public inputs match contract expectations
























