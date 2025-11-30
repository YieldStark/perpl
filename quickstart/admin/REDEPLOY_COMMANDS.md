# Quick Redeploy PositionHandler with sncast

## Step 1: Rebuild Contracts
```bash
cd quickstart/contracts
scarb build
```

## Step 2: Declare & Deploy

### Option A: Manual (2 steps)

**Step 2a: Declare**
```bash
cd quickstart/contracts
sncast declare --contract-name PositionHandler
```

**Step 2b: Deploy** (copy the class_hash from above)
```bash
sncast deploy \
  --class-hash <POSITION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

### Option B: One-liner (if sncast outputs class_hash)
```bash
cd quickstart/contracts
CLASS_HASH=$(sncast declare --contract-name PositionHandler 2>&1 | grep -oP 'class_hash: \K0x[a-fA-F0-9]+' || sncast declare --contract-name PositionHandler 2>&1 | tail -1)
sncast deploy --class-hash $CLASS_HASH --constructor-calldata \
  0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e \
  0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
  0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
  0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \
  0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

## Step 3: Update Frontend Config

After deployment, update `quickstart/app/src/config/contracts.ts`:
```typescript
POSITION_HANDLER: '0x...', // New address from deployment
```

## Constructor Parameters Explained

1. `0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e` - DataStore
2. `0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02` - EventEmitter
3. `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d` - Verifier
4. `0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda` - YUSD Token
5. `0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d` - CollateralVault

## What Changed

The PositionHandler now has the MARKET_DISABLED check temporarily bypassed for testing.

