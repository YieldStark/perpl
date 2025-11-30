# Market ID Fix Guide

## Problem
Getting `MARKET_DISABLED` error even though the market is enabled in DataStore.

## Root Cause
The market_id format in `public_inputs[0]` must **exactly match** what's stored in DataStore.

## Solution

### 1. Verify Market is Enabled
```bash
npm run debug-market-id
```

This confirms the market is enabled and shows the correct format: `0x4254432f555344`

### 2. Check Browser Console
When submitting an order, check the browser console for:
- `🔍 Market ID Debug (proofService)` - Shows the market_id being used
- `🔍 Public Inputs Debug (usePerpRouter)` - Shows the market_id in public_inputs
- `✅ Final public_inputs` - Shows the final market_id being sent

### 3. Verify Market ID Format
The market_id in `public_inputs[0]` must be:
- **Exact value**: `0x4254432f555344` (lowercase)
- **Type**: String with `0x` prefix
- **Position**: First element of `public_inputs` array

### 4. What Was Fixed

1. **Enhanced `stringToFelt252()` function**:
   - Ensures it always returns hex format with `0x` prefix
   - Handles both hex and decimal formats correctly

2. **Added validation in `proofService.ts`**:
   - Validates market_id matches expected Pragma asset ID
   - Corrects format if mismatch detected
   - Adds comprehensive debug logging

3. **Final validation before sending**:
   - Ensures market_id in public_inputs matches expected format
   - Logs final values for debugging

### 5. Testing

1. Open browser console (F12)
2. Submit an order
3. Check console logs for:
   ```
   🔍 Market ID Debug (proofService): {
     inputMarketId: "BTC/USD",
     marketIdFelt: "0x4254432f555344",
     expectedPragmaId: "0x4254432f555344",
     matches: true
   }
   ```

4. Verify:
   ```
   ✅ Final public_inputs: {
     market_id: "0x4254432f555344",
     market_id_matches_expected: true
   }
   ```

### 6. If Still Getting MARKET_DISABLED

1. **Check the exact market_id in public_inputs**:
   - Look at `🔍 Public Inputs Debug (usePerpRouter)` log
   - Verify `marketIdInPublicInputs` is exactly `0x4254432f555344`

2. **Verify DataStore has the market**:
   ```bash
   npm run verify-market
   ```
   Should show: `Enabled: ✅ YES`

3. **Check for case sensitivity**:
   - Market ID must be lowercase: `0x4254432f555344`
   - NOT uppercase: `0X4254432F555344`

4. **Verify contract addresses**:
   - DataStore: `0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e`
   - PositionHandler: `0x034fefb6137bc137491b2226a362d67a1485496e02e9b261b273f39d7b97aebd`

## Expected Behavior

After the fix:
- Market ID is correctly formatted as `0x4254432f555344`
- Public inputs contain `[market_id, commitment]` in correct format
- Contract successfully looks up market config
- Market is enabled and order succeeds

## Debug Commands

```bash
# Check market status
npm run verify-market

# Debug market_id formats
node debug-market-id.js

# Check actual market_id being used
node check-actual-market-id.js
```

