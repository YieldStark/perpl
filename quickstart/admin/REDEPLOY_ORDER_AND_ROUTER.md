# Redeploy OrderHandler and PerpRouter

Since PositionHandler was redeployed, we need to redeploy:
1. **OrderHandler** (depends on PositionHandler)
2. **PerpRouter** (depends on OrderHandler and PositionHandler)

## Step 1: Redeploy OrderHandler

### Declare OrderHandler
```bash
cd quickstart/contracts
sncast declare --contract-name OrderHandler
```

### Deploy OrderHandler
```bash
sncast deploy \
  --class-hash <ORDER_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e \  # DataStore
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \  # EventEmitter
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674 \  # Oracle
    0x016735ce3ca6a4491853a669630615c4bc9dfabe47e8d5e92789363770a8644a   # ⭐ NEW PositionHandler
```

## Step 2: Redeploy PerpRouter

### Declare PerpRouter
```bash
cd quickstart/contracts
sncast declare --contract-name PerpRouter
```

### Deploy PerpRouter
```bash
sncast deploy \
  --class-hash <PERP_ROUTER_CLASS_HASH> \
  --constructor-calldata \
    0x016735ce3ca6a4491853a669630615c4bc9dfabe47e8d5e92789363770a8644a \  # ⭐ NEW PositionHandler
    <NEW_ORDER_HANDLER_ADDRESS> \                                          # From Step 1
    0x0099200e8b478e108418620ba6bebc8ad0afd51d74f310c7969fe6517f2a9803 \  # LiquidationHandler
    0x01265e715530e1b0cdc0cff1ef92130772bd02d48fc56c3937194b88e5d3ddb8   # RiskManager
```

## Step 3: Update Frontend Config

After deployment, update `quickstart/app/src/config/contracts.ts`:

```typescript
export const CONTRACTS = {
  PERP_ROUTER: '0x...', // ⭐ NEW PerpRouter address
  POSITION_HANDLER: '0x016735ce3ca6a4491853a669630615c4bc9dfabe47e8d5e92789363770a8644a', // ✅ Already updated
  ORDER_HANDLER: '0x...', // ⭐ NEW OrderHandler address
  // ... rest of addresses
}
```

## Addresses Reference

- **DataStore**: `0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e`
- **EventEmitter**: `0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02`
- **Oracle**: `0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674`
- **PositionHandler** (NEW): `0x016735ce3ca6a4491853a669630615c4bc9dfabe47e8d5e92789363770a8644a`
- **LiquidationHandler**: `0x0099200e8b478e108418620ba6bebc8ad0afd51d74f310c7969fe6517f2a9803`
- **RiskManager**: `0x01265e715530e1b0cdc0cff1ef92130772bd02d48fc56c3937194b88e5d3ddb8`

