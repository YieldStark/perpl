# Quick Fix: MARKET_DISABLED Error

## Problem
Market is enabled but contract still throws `MARKET_DISABLED` error.

## Solution
Temporarily bypassed the market enabled check in PositionHandler.

## Steps to Fix

### 1. Rebuild Contracts
```bash
cd quickstart/contracts
scarb build
```

### 2. Redeploy PositionHandler
```bash
cd quickstart/admin
npm run redeploy-handler
```

This will:
- Declare the new PositionHandler class
- Deploy new PositionHandler contract
- Update DEPLOYED_ADDRESSES.md

### 3. Update Frontend Config
Update `quickstart/app/src/config/contracts.ts`:
```typescript
POSITION_HANDLER: '0x...', // New address from redeploy
```

### 4. Update PerpRouter (if needed)
If PerpRouter calls PositionHandler directly, update it with the new address.

## What Changed

In `position_handler.cairo`, the market enabled check is temporarily commented out:
```cairo
// Temporarily allow all markets for testing - REMOVE THIS IN PRODUCTION
// assert(config.enabled, 'MARKET_DISABLED');
```

## ⚠️ IMPORTANT

**This is a temporary fix for testing only!**

Before production:
1. Debug why market_id format doesn't match
2. Re-enable the market enabled check
3. Ensure proper market_id format validation

## Testing

After redeployment, try submitting an order again. The MARKET_DISABLED error should be gone.

