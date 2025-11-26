# Perpetual Contracts Deployment Guide

## Overview

This guide shows you exactly which contracts need the verifier address, how to deploy them, and how the verifier integration works.

---

## 🔍 Which Contracts Need Verifier Address?

**Only 2 contracts need the verifier address:**

1. **`PositionHandler`** - Verifies proofs when opening/closing positions
2. **`LiquidationHandler`** - Verifies proofs when liquidating positions

**All other contracts do NOT need the verifier address.**

---

## 📋 Deployment Order

### Step 1: Deploy Core Contracts (Independent - No Dependencies)

These contracts have no dependencies on other contracts:

```bash
cd quickstart/contracts

# 1. RoleStore (needs admin address) ✅ DONE
sncast declare --contract-name RoleStore
sncast deploy \
  --class-hash <ROLE_STORE_CLASS_HASH> \
  --constructor-calldata <YOUR_ADMIN_ADDRESS>

# 2. EventEmitter (no constructor params) ✅ DONE
sncast declare --contract-name EventEmitter
sncast deploy --class-hash <EVENT_EMITTER_CLASS_HASH>

# 3. DataStore (needs RoleStore address) ✅ DONE
sncast declare --contract-name DataStore
sncast deploy \
  --class-hash <DATA_STORE_CLASS_HASH> \
  --constructor-calldata <ROLE_STORE_ADDRESS>

# 4. Oracle (needs Pragma address, EventEmitter, max_price_age)
sncast declare --contract-name mocks::mock_oracle::MockOracle DONE
sncast deploy \
  --class-hash <ORACLE_CLASS_HASH> \
  --constructor-calldata \
    <PRAGMA_ORACLE_ADDRESS> \  # ← Use mock oracle address until Pragma ships Ztarknet feed
    <EVENT_EMITTER_ADDRESS> \
    3600  # max_price_age (1 hour in seconds)

# 5. CollateralVault (needs yUSD token address, RoleStore) ✅ DONE
sncast declare --contract-name CollateralVault
sncast deploy \
  --class-hash <COLLATERAL_VAULT_CLASS_HASH> \
  --constructor-calldata \
    0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda \  # yUSD token
    <ROLE_STORE_ADDRESS>
```

**Save all addresses!** You'll need them for the next steps.

---

## 🧪 Interim Mock Oracle (while waiting for Pragma on Ztarknet)

Pragma hasn’t shipped a Ztarknet feed yet, so we added `mocks::mock_oracle::MockOracle` to keep the deployment pipeline moving.

1. **Create a dedicated admin account** (already done: `oracle_admin`, address `0x05be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e`).
2. **Declare & deploy the mock oracle:** ✅ DONE
   ```bash
   # Declare
   sncast declare \
     --package private_perp \
     --contract-name MockOracle

   # Deploy (constructor = admin)
   sncast deploy \
     --class-hash 0x5d1a434c58398d466f07fdda8f4857fdd6c4860af63f23ae86bd5e466c87f69 \
     --constructor-calldata 0x05be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e
   ```
3. **Push prices for testing** (use the oracle admin profile so only you can update):
   ```bash
   sncast invoke \
     --profile oracle_admin \
     --contract-address <MOCK_ORACLE_ADDRESS> \
     --function set_price \
     --calldata <MARKET_ID_FELT> <PRICE_U128> <DECIMALS> <NUM_SOURCES>
   ```
4. **Use the mock address** as `<PRAGMA_ORACLE_ADDRESS>` when deploying the real `Oracle`. ✅ DONE (Oracle deployed at `0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674`)

When Pragma deploys an official feed, redeploy the production `Oracle` with the new address and retire the mock.

---

### Step 2: Deploy Handler Contracts (Need Verifier Address)

#### 2.1 PositionHandler

**Constructor Parameters:**
1. `data_store_address`
2. `event_emitter_address`
3. `verifier_address` ⭐ **YOUR VERIFIER ADDRESS**
4. `yusd_token_address`
5. `collateral_vault_address`

```bash
sncast declare --contract-name PositionHandler
sncast deploy \
  --class-hash <POSITION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <DATA_STORE_ADDRESS> \
    <EVENT_EMITTER_ADDRESS> \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \  # ⭐ VERIFIER
    <YUSD_TOKEN_ADDRESS> \
    <COLLATERAL_VAULT_ADDRESS>
```

#### 2.2 LiquidationHandler

**Constructor Parameters:**
1. `data_store_address`
2. `event_emitter_address`
3. `verifier_address` ⭐ **YOUR VERIFIER ADDRESS**
4. `collateral_vault_address`

```bash
sncast declare --contract-name LiquidationHandler
sncast deploy \
  --class-hash <LIQUIDATION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <DATA_STORE_ADDRESS> \
    <EVENT_EMITTER_ADDRESS> \
    0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d \  # ⭐ VERIFIER
    <COLLATERAL_VAULT_ADDRESS>
```

#### 2.3 OrderHandler (No Verifier Needed)

**Constructor Parameters:**
1. `data_store_address`
2. `event_emitter_address`
3. `oracle_address`
4. `position_handler_address`

```bash
sncast declare --contract-name OrderHandler
sncast deploy \
  --class-hash <ORDER_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <DATA_STORE_ADDRESS> \
    <EVENT_EMITTER_ADDRESS> \
    <ORACLE_ADDRESS> \
    <POSITION_HANDLER_ADDRESS>
```

#### 2.4 RiskManager (No Verifier Needed)

**Constructor Parameters:**
1. `data_store_address`
2. `oracle_address`

```bash
sncast declare --contract-name RiskManager
sncast deploy \
  --class-hash <RISK_MANAGER_CLASS_HASH> \
  --constructor-calldata \
    <DATA_STORE_ADDRESS> \
    <ORACLE_ADDRESS>
```

---

### Step 3: Deploy Router Contract

**PerpRouter** - The main entry point for users

**Constructor Parameters:**
1. `position_handler_address`
2. `order_handler_address`
3. `liquidation_handler_address`
4. `risk_manager_address`

```bash
sncast declare --contract-name PerpRouter
sncast deploy \
  --class-hash <PERP_ROUTER_CLASS_HASH> \
  --constructor-calldata \
    <POSITION_HANDLER_ADDRESS> \
    <ORDER_HANDLER_ADDRESS> \
    <LIQUIDATION_HANDLER_ADDRESS> \
    <RISK_MANAGER_ADDRESS>
```

---

### Step 4: Deploy MarketRegistry (Optional - For Market Setup)

**Constructor Parameters:**
1. `oracle_address`
2. `data_store_address`

```bash
sncast declare --contract-name MarketRegistry
sncast deploy \
  --class-hash <MARKET_REGISTRY_CLASS_HASH> \
  --constructor-calldata \
    <ORACLE_ADDRESS> \
    <DATA_STORE_ADDRESS>
```

---

## 🔧 How Verifier Integration Works

### In PositionHandler

When a user calls `open_position()` or `close_position()`:

1. **User sends proof** (generated from Noir circuit)
2. **PositionHandler calls verifier:**
   ```cairo
   let verifier = IVerifierDispatcher { 
       contract_address: self.verifier_address.read() 
   };
   let verified_outputs_opt: Option<Span<u256>> = 
       verifier.verify_ultra_starknet_zk_honk_proof(proof);
   ```
3. **Verifier validates proof** and returns public outputs (commitment hash)
4. **PositionHandler extracts commitment** from public outputs
5. **PositionHandler stores only commitment** (privacy maintained!)

### In LiquidationHandler

When a liquidator calls `liquidate_position()`:

1. **Liquidator sends proof** (proving position is liquidatable)
2. **LiquidationHandler calls verifier** (same process as above)
3. **Verifier validates proof** and returns commitment
4. **LiquidationHandler verifies commitment matches position**
5. **Liquidation proceeds** (loss absorbed by vault)

---

## 📝 Complete Deployment Checklist

### Phase 1: Core Contracts
- [x] RoleStore ✅ `0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819`
- [x] EventEmitter ✅ `0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02`
- [x] DataStore ✅ `0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e`
- [x] Oracle ✅ `0x055cdd0a72d3043de27149d71b842060af32934612718c2225aa215f9e825674`
- [x] CollateralVault ✅ `0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d`

### Phase 2: Handler Contracts
- [ ] PositionHandler ⭐ (needs verifier)
- [ ] LiquidationHandler ⭐ (needs verifier)
- [ ] OrderHandler
- [ ] RiskManager

### Phase 3: Router
- [ ] PerpRouter

### Phase 4: Optional
- [ ] MarketRegistry

---

## 🎯 Your Verifier Address

**Deployed Verifier:** `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d`

Use this address in:
- `PositionHandler` constructor (3rd parameter)
- `LiquidationHandler` constructor (3rd parameter)

---

## 💡 Important Notes

1. **Verifier Must Be Deployed First** - The verifier contract must exist before deploying handlers that reference it.

2. **Only 2 Contracts Use Verifier** - PositionHandler and LiquidationHandler are the only contracts that verify proofs.

3. **OrderHandler Doesn't Need Verifier** - It calls PositionHandler, which handles verification.

4. **Router Doesn't Need Verifier** - It just routes calls to handlers.

5. **Privacy Model** - The verifier returns only the commitment hash. All financial details (size, collateral, direction) remain private.

---

## 🚀 Quick Reference: Constructor Signatures

```cairo
// PositionHandler
constructor(
    data_store_address: ContractAddress,
    event_emitter_address: ContractAddress,
    verifier_address: ContractAddress,  // ⭐
    yusd_token_address: ContractAddress,
    collateral_vault_address: ContractAddress
)

// LiquidationHandler
constructor(
    data_store_address: ContractAddress,
    event_emitter_address: ContractAddress,
    verifier_address: ContractAddress,  // ⭐
    collateral_vault_address: ContractAddress
)

// OrderHandler
constructor(
    data_store_address: ContractAddress,
    event_emitter_address: ContractAddress,
    oracle_address: ContractAddress,
    position_handler_address: ContractAddress
)

// RiskManager
constructor(
    data_store_address: ContractAddress,
    oracle_address: ContractAddress
)

// PerpRouter
constructor(
    position_handler_address: ContractAddress,
    order_handler_address: ContractAddress,
    liquidation_handler_address: ContractAddress,
    risk_manager_address: ContractAddress
)
```

---

**Ready to deploy!** Start with Phase 1 (Core Contracts) and work your way through. 🎉

