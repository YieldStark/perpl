# Guide: Removing Role-Based Access Control

This guide explains how to remove RoleStore dependencies from the contracts to simplify deployment and remove role management complexity.

## Overview

Currently, contracts use `RoleStore` for access control. To remove this:

1. **Remove role checks** from contract functions
2. **Remove RoleStore dependency** from constructors
3. **Update deployment** to not deploy RoleStore

## Contracts That Need Changes

### 1. DataStore (`core/data_store.cairo`)

**Current:**
```cairo
use private_perp::core::role_store::{IRoleStoreDispatcher, IRoleStoreDispatcherTrait};

#[storage]
struct Storage {
    role_store: ContractAddress,
    // ...
}

fn constructor(ref self: ContractState, role_store_address: ContractAddress) {
    self.role_store.write(role_store_address);
}

fn set_market_config(ref self: ContractState, market_id: felt252, config: MarketConfig) {
    let caller = get_caller_address();
    get_role_store(@self).assert_only_role(caller, 'ADMIN');
    self.market_configs.write(market_id, config);
}
```

**Modified (No Roles):**
```cairo
// Remove: use private_perp::core::role_store::{IRoleStoreDispatcher, IRoleStoreDispatcherTrait};

#[storage]
struct Storage {
    // Remove: role_store: ContractAddress,
    // ...
}

fn constructor(ref self: ContractState) {
    // Remove role_store parameter
}

fn set_market_config(ref self: ContractState, market_id: felt252, config: MarketConfig) {
    // Remove: let caller = get_caller_address();
    // Remove: get_role_store(@self).assert_only_role(caller, 'ADMIN');
    self.market_configs.write(market_id, config);
}
```

**All functions to update in DataStore:**
- `set_position` - Remove `CONTROLLER` check
- `remove_position` - Remove `CONTROLLER` check
- `set_market_config` - Remove `ADMIN` check
- `set_u256` - Remove `CONTROLLER` check
- `set_collateral_pool` - Remove `CONTROLLER` check
- `set_long_open_interest` - Remove `CONTROLLER` check
- `set_short_open_interest` - Remove `CONTROLLER` check

### 2. CollateralVault (`vault/collateral_vault.cairo`)

**Current:**
```cairo
use private_perp::core::role_store::{IRoleStoreDispatcher, IRoleStoreDispatcherTrait};

#[storage]
struct Storage {
    role_store: IRoleStoreDispatcher,
    // ...
}

fn constructor(ref self: ContractState, yusd_token: ContractAddress, role_store_address: ContractAddress) {
    self.role_store.write(IRoleStoreDispatcher { contract_address: role_store_address });
}

fn deposit(ref self: ContractState, amount: u256) {
    let caller = get_caller_address();
    self.role_store.read().assert_only_role(caller, 'POSITION_HANDLER');
    // ...
}
```

**Modified (No Roles):**
```cairo
// Remove: use private_perp::core::role_store::{IRoleStoreDispatcher, IRoleStoreDispatcherTrait};

#[storage]
struct Storage {
    // Remove: role_store: IRoleStoreDispatcher,
    // ...
}

fn constructor(ref self: ContractState, yusd_token: ContractAddress) {
    // Remove role_store parameter
}

fn deposit(ref self: ContractState, amount: u256) {
    // Remove: let caller = get_caller_address();
    // Remove: self.role_store.read().assert_only_role(caller, 'POSITION_HANDLER');
    // ...
}
```

**All functions to update in CollateralVault:**
- `deposit` - Remove `POSITION_HANDLER` check
- `withdraw` - Remove `POSITION_HANDLER` check
- `transfer_quote` - Remove `QUOTE_HANDLER` check
- `liquidate` - Remove `LIQUIDATION_HANDLER` check
- `collect_fees` - Remove `FEE_HANDLER` check
- `set_max_collateral` - Remove `ADMIN` check
- `set_max_withdrawal` - Remove `ADMIN` check
- `increase_position_collateral` - Remove `POSITION_HANDLER` check
- `decrease_position_collateral` - Remove `POSITION_HANDLER` check

## Step-by-Step Process

### Step 1: Modify DataStore

1. Open `quickstart/contracts/src/core/data_store.cairo`
2. Remove the `use` statement for `role_store`
3. Remove `role_store: ContractAddress` from Storage
4. Remove `role_store_address` parameter from constructor
5. Remove `get_role_store()` helper function
6. Remove all `assert_only_role()` calls from functions

### Step 2: Modify CollateralVault

1. Open `quickstart/contracts/src/vault/collateral_vault.cairo`
2. Remove the `use` statement for `role_store`
3. Remove `role_store: IRoleStoreDispatcher` from Storage
4. Remove `role_store_address` parameter from constructor
5. Remove all `assert_only_role()` calls from functions

### Step 3: Update Deployment Scripts

Update `deploy-all-starknetjs.js`:

```javascript
// Remove RoleStore deployment
// const roleStore = await deployContract('RoleStore', ...);

// Update DataStore deployment (no role_store parameter)
const dataStoreAddress = await deployContract('DataStore', dataStoreClassHash, [], account);

// Update CollateralVault deployment (no role_store parameter)
const collateralVaultAddress = await deployContract('CollateralVault', collateralVaultClassHash, [YUSD_TOKEN_ADDRESS], account);

// Remove all role granting steps
// await grantRole(...);
```

### Step 4: Rebuild Contracts

```bash
cd quickstart/contracts
scarb build
```

### Step 5: Redeploy

```bash
cd quickstart/admin
npm run deploy-all-js
```

## Security Considerations

⚠️ **WARNING**: Removing role checks means:

1. **Anyone can call admin functions** - No protection on `set_market_config`, `set_max_collateral`, etc.
2. **No access control** - All functions are public
3. **Security risk** - Only use this for testing/development

## Alternative: Keep Roles but Simplify

If you want to keep some security but simplify:

1. **Use a single admin address** - Hardcode one admin address in contracts
2. **Remove RoleStore** - Check `caller == admin_address` directly
3. **Simpler deployment** - No role granting needed

Example:
```cairo
#[storage]
struct Storage {
    admin: ContractAddress,
    // ...
}

fn constructor(ref self: ContractState, admin_address: ContractAddress) {
    self.admin.write(admin_address);
}

fn set_market_config(ref self: ContractState, market_id: felt252, config: MarketConfig) {
    let caller = get_caller_address();
    assert(caller == self.admin.read(), 'NOT_ADMIN');
    self.market_configs.write(market_id, config);
}
```

This gives you:
- ✅ Simple deployment (just pass admin address)
- ✅ Some security (only admin can call admin functions)
- ✅ No RoleStore needed

## Next Steps

1. Choose approach: Remove all roles OR use simple admin check
2. Modify contract source files
3. Rebuild contracts
4. Update deployment scripts
5. Redeploy contracts



