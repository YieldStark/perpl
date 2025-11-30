# Redeploy DataStore with Role Checks Bypassed

## Step 1: Rebuild Contracts

```bash
cd quickstart/contracts
scarb build
```

## Step 2: Declare & Deploy DataStore

### Declare
```bash
cd quickstart/contracts
sncast declare --contract-name DataStore
```

### Deploy
```bash
sncast deploy \
  --class-hash <DATA_STORE_CLASS_HASH> \
  --constructor-calldata \
    0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819
```

**Constructor Parameter:**
- RoleStore: `0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819`

## Step 3: Redeploy Dependent Contracts

After DataStore is redeployed, you'll get a NEW DataStore address. Update and redeploy:

### 3.1 PositionHandler
```bash
sncast declare --contract-name PositionHandler
sncast deploy \
  --class-hash <POSITION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <NEW_DATA_STORE_ADDRESS> \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

### 3.2 OrderHandler
```bash
sncast deploy \
  --class-hash 0x030e79af3f971b89e2430bbbc91f1f389d561fba4dfa71900c5267f57a23dd65 \
  --constructor-calldata \
    <NEW_DATA_STORE_ADDRESS> \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674 \
    <NEW_POSITION_HANDLER_ADDRESS>
```

### 3.3 LiquidationHandler
```bash
sncast declare --contract-name LiquidationHandler
sncast deploy \
  --class-hash <LIQUIDATION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <NEW_DATA_STORE_ADDRESS> \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

### 3.4 RiskManager
```bash
sncast declare --contract-name RiskManager
sncast deploy \
  --class-hash <RISK_MANAGER_CLASS_HASH> \
  --constructor-calldata \
    <NEW_DATA_STORE_ADDRESS> \
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674
```

### 3.5 PerpRouter
```bash
sncast deploy \
  --class-hash 0x47cd3c28b8687dbe7ae5fd21ee2069590451841d40a5914501d3aeae92127b1 \
  --constructor-calldata \
    <NEW_POSITION_HANDLER_ADDRESS> \
    <NEW_ORDER_HANDLER_ADDRESS> \
    <NEW_LIQUIDATION_HANDLER_ADDRESS> \
    <NEW_RISK_MANAGER_ADDRESS>
```

## Step 4: Update Frontend Config

Update `quickstart/app/src/config/contracts.ts` with all new addresses.

## What Changed

- **DataStore**: Role checks bypassed in `set_position()` and `remove_position()`
- All contracts will be redeployed with new DataStore address
- This ensures transactions go through without role permission issues

