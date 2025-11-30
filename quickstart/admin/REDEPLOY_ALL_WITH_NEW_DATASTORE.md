# Redeploy All Contracts with New DataStore

**New DataStore Address:** `0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29`

## Step 1: Redeploy PositionHandler

```bash
cd quickstart/contracts

# Declare
sncast declare --contract-name PositionHandler

# Deploy (copy class_hash from above)
sncast deploy \
  --class-hash <POSITION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29 \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

## Step 2: Redeploy OrderHandler

```bash
# OrderHandler is already declared, so deploy directly
sncast deploy \
  --class-hash 0x030e79af3f971b89e2430bbbc91f1f389d561fba4dfa71900c5267f57a23dd65 \
  --constructor-calldata \
    0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29 \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674 \
    <NEW_POSITION_HANDLER_ADDRESS>
```

## Step 3: Redeploy LiquidationHandler

```bash
# Declare
sncast declare --contract-name LiquidationHandler

# Deploy (copy class_hash from above)
sncast deploy \
  --class-hash <LIQUIDATION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29 \
    0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02 \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \
    0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d
```

## Step 4: Redeploy RiskManager

```bash
# Declare
sncast declare --contract-name RiskManager

# Deploy (copy class_hash from above)
sncast deploy \
  --class-hash <RISK_MANAGER_CLASS_HASH> \
  --constructor-calldata \
    0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29 \
    0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674
```

## Step 5: Redeploy PerpRouter

```bash
# PerpRouter is already declared, so deploy directly
sncast deploy \
  --class-hash 0x47cd3c28b8687dbe7ae5fd21ee2069590451841d40a5914501d3aeae92127b1 \
  --constructor-calldata \
    <NEW_POSITION_HANDLER_ADDRESS> \
    <NEW_ORDER_HANDLER_ADDRESS> \
    <NEW_LIQUIDATION_HANDLER_ADDRESS> \
    <NEW_RISK_MANAGER_ADDRESS>
```

## Addresses Reference

- **DataStore (NEW)**: `0x07528b96de355cfeb0358943484132ec60fdbda19ee71ea729c0e68b0dcc3e29`
- **EventEmitter**: `0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02`
- **Verifier**: `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d`
- **YUSD Token**: `0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda`
- **CollateralVault**: `0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d`
- **Oracle**: `0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674`

