# Private Perp DEX - Complete Architecture Explanation

## 🏗️ System Overview

This is a **modular, privacy-enabled perpetual futures trading platform** built on Ztarknet (Starknet testnet). The system uses **Zero-Knowledge proofs** to keep position details private while maintaining on-chain verification.

### Core Design Principles

1. **Modular Architecture**: Each component has a single responsibility
2. **Privacy-First**: Position details hidden via ZK proofs, only commitments on-chain
3. **Centralized Data**: All state stored in `DataStore` for gas efficiency
4. **Role-Based Access**: `RoleStore` controls who can do what
5. **Event-Driven**: `EventEmitter` for off-chain indexing
6. **Oracle Integration**: Pragma Oracle for price feeds
7. **Vault-Based**: `CollateralVault` holds all tokens and manages profit/loss

---

## 📦 Contract Architecture

### Layer 1: Core Infrastructure (Foundation)

#### 1. **RoleStore** (`core/role_store.cairo`)
**Purpose**: Role-based access control (RBAC)

**Roles:**
- `ADMIN`: Can grant/revoke roles, configure markets
- `CONTROLLER`: Can write to DataStore (handlers)
- `KEEPER`: Can execute limit orders, liquidations

**How it works:**
```cairo
// Grant role
role_store.grant_role(account, 'CONTROLLER');

// Check role
role_store.has_role(account, 'CONTROLLER'); // true/false

// Assert role (reverts if missing)
role_store.assert_only_role(account, 'CONTROLLER');
```

**Used by:**
- All contracts check roles before critical operations
- `DataStore` uses it to restrict writes
- `CollateralVault` uses it for access control

---

#### 2. **EventEmitter** (`core/event_emitter.cairo`)
**Purpose**: Centralized event emission

**Events:**
- `PositionOpened`: When a position is created
- `PositionClosed`: When a position is closed
- `PositionLiquidated`: When a position is liquidated
- `PriceUpdated`: When oracle price is updated

**How it works:**
```cairo
event_emitter.emit_position_opened(commitment, market_id, is_long, size, margin);
```

**Used by:**
- `PositionHandler`: Emits position events
- `LiquidationHandler`: Emits liquidation events
- `Oracle`: Emits price update events

**Why centralized?**
- Single source of truth for events
- Easier indexing and monitoring
- Consistent event format

---

#### 3. **DataStore** (`core/data_store.cairo`)
**Purpose**: Centralized state storage

**Stores:**
- Positions (by commitment hash)
- Market configurations
- Collateral pools (per market)
- Open interest (long/short per market)
- Generic u256 values

**How it works:**
```cairo
// Write (only CONTROLLER role)
data_store.set_position(commitment, position);

// Read (anyone)
let position = data_store.get_position(commitment);
```

**Access Control:**
- Reads: Public
- Writes: Only `CONTROLLER` role (handlers)

**Why centralized?**
- Gas efficient (single storage contract)
- Consistent state management
- Easy to query all positions

**Used by:**
- All handlers read/write positions
- `RiskManager` reads market configs
- `Funding` reads open interest

---

#### 4. **Oracle** (`core/oracle.cairo`)
**Purpose**: Price feed integration with Pragma Oracle

**Features:**
- Fetches prices from Pragma Oracle
- Caches prices with timestamps
- Validates price freshness
- Supports 7 markets (BTC, ETH, WBTC, LORDS, STRK, EKUBO, DOG)

**How it works:**
```cairo
// Update price from Pragma
oracle.update_price_from_pragma(market_id);

// Get cached price
let price = oracle.get_price(market_id);
// Returns: Price { value: u128, timestamp: u64, decimals: u32, num_sources: u32 }
```

**Price Update Flow:**
1. Keeper calls `update_price_from_pragma(market_id)`
2. Oracle calls Pragma contract: `get_data_median(DataType::SpotEntry(asset_id))`
3. Oracle caches price with current timestamp
4. Emits `PriceUpdated` event

**Price Validation:**
- Checks price is not stale (max 5 minutes old)
- Validates price > 0
- Uses median from multiple sources

**Used by:**
- `PositionHandler`: Gets price for PnL calculation
- `LiquidationHandler`: Gets price for liquidation check
- `RiskManager`: Gets price for margin validation

---

### Layer 2: Handler Contracts (Business Logic)

#### 5. **PositionHandler** (`handlers/position_handler.cairo`)
**Purpose**: Open and close positions

**Functions:**
- `open_position()`: Create new position
- `close_position()`: Close existing position

**Open Position Flow:**
```
1. User calls router.open_position(proof, public_inputs, market_id, collateral)
2. Router → PositionHandler.open_position()
3. PositionHandler:
   a. Verifies ZK proof (TODO: integrate verifier)
   b. Gets fresh price from Oracle
   c. Validates market config from DataStore
   d. Calculates position size (collateral * leverage)
   e. Calculates price impact
   f. Transfers collateral from user to Vault
   g. Creates Position struct (with account address)
   h. Stores position in DataStore
   i. Updates collateral pool
   j. Updates open interest
   k. Emits PositionOpened event
```

**Close Position Flow:**
```
1. User calls router.close_position(proof, public_inputs, commitment, closing_size)
2. Router → PositionHandler.close_position()
3. PositionHandler:
   a. Gets position from DataStore
   b. Updates price from Pragma (fresh price)
   c. Calculates PnL (entry_price vs current_price)
   d. Calculates fees (trading + funding)
   e. Calculates payout:
      - If profit: collateral + profit - fees
      - If loss: collateral - loss - fees
   f. Updates position (partial close support)
   g. Handles profit/loss via Vault:
      - Profit: vault.withdraw_profit(market_id, position.account, payout)
      - Loss: vault.absorb_loss(market_id, loss_amount) + withdraw remaining
   h. Updates collateral pool
   i. Emits PositionClosed event
```

**Key Points:**
- Always transfers to `position.account` (depositing address)
- Updates price from Pragma before close
- Handles partial closes
- Accrues fees to vault

**Dependencies:**
- `DataStore`: Read/write positions
- `Oracle`: Get prices
- `CollateralVault`: Deposit/withdraw tokens
- `EventEmitter`: Emit events
- Utility libraries: PnL, fees, price impact

---

#### 6. **OrderHandler** (`handlers/order_handler.cairo`)
**Purpose**: Create and execute market/limit orders

**Functions:**
- `create_market_order()`: Execute immediately at oracle price
- `create_limit_order()`: Store order, execute when trigger price reached
- `execute_order()`: Execute limit order (keeper calls)

**Market Order Flow:**
```
1. User calls router.create_market_order(...)
2. Router → OrderHandler.create_market_order()
3. OrderHandler:
   a. Gets current price from Oracle
   b. Calculates execution price (with price impact)
   c. Calls PositionHandler.open_position() or close_position()
```

**Limit Order Flow:**
```
1. User calls router.create_limit_order(market_id, is_long, size, trigger_price)
2. Router → OrderHandler.create_limit_order()
3. OrderHandler:
   a. Creates Order struct
   b. Stores order in DataStore (TODO: add order storage)
   c. Returns order commitment

4. Keeper monitors orders
5. When trigger_price reached:
   a. Keeper calls OrderHandler.execute_order(order_commitment)
   b. OrderHandler:
      - Gets current price from Oracle
      - Validates trigger price met
      - Calls PositionHandler to execute
```

**Dependencies:**
- `DataStore`: Store orders
- `Oracle`: Get prices
- `PositionHandler`: Execute positions

---

#### 7. **LiquidationHandler** (`handlers/liquidation_handler.cairo`)
**Purpose**: Liquidate undercollateralized positions

**Functions:**
- `liquidate_position()`: Liquidate a position

**Liquidation Flow:**
```
1. Keeper detects liquidatable position (off-chain)
2. Keeper calls router.liquidate_position(proof, public_inputs, commitment)
3. Router → LiquidationHandler.liquidate_position()
4. LiquidationHandler:
   a. Gets position from DataStore
   b. Gets current price from Oracle
   c. Verifies ZK proof (includes liquidation check)
   d. Validates position is liquidatable
   e. Calculates PnL
   f. Calculates liquidation fee
   g. Calculates liquidator reward (50% of fee)
   h. Closes position (removes from DataStore)
   i. Updates collateral pool
   j. Transfers reward to liquidator
   k. Absorbs loss into Vault
   l. Emits PositionLiquidated event
```

**Dependencies:**
- `DataStore`: Read positions
- `Oracle`: Get prices
- `CollateralVault`: Absorb losses, pay rewards
- `EventEmitter`: Emit events

---

#### 8. **FeeHandler** (`handlers/fee_handler.cairo`)
**Purpose**: Claim accrued fees

**Functions:**
- `claim_fees()`: Claim fees for a market (admin only)

**Fee Accrual:**
- Trading fees accrued to `CollateralVault` when positions close
- Funding fees accrued to `CollateralVault` when positions close
- Fees stored per market in vault

**Claim Flow:**
```
1. Admin calls fee_handler.claim_fees(market_id, recipient)
2. FeeHandler:
   a. Gets accrued fees from Vault
   b. Transfers fees to recipient
   c. Resets accrued fees
```

**Dependencies:**
- `CollateralVault`: Get/claim fees

---

### Layer 3: Market & Risk Management

#### 9. **Funding** (`market/funding.cairo`)
**Purpose**: Real-time funding rate calculation

**How it works:**
```
1. Keeper calls funding.update_funding_rate(market_id) periodically
2. Funding:
   a. Gets long/short open interest from DataStore
   b. Calculates imbalance: |long_oi - short_oi|
   c. Calculates funding rate: (imbalance / total_oi) * max_rate
   d. Updates cumulative funding factors
   e. Emits FundingRateUpdated event

3. When position closes:
   a. PositionHandler calls funding.get_funding_fee_for_position(...)
   b. Funding calculates fee based on factor difference
   c. Fee deducted from payout
```

**Funding Rate Formula:**
```
rate_per_second = (imbalance / total_oi) * MAX_FUNDING_RATE_PER_SECOND

If longs > shorts:
  - Longs pay shorts (positive rate for shorts)
  - Funding factor increases for longs, decreases for shorts

If shorts > longs:
  - Shorts pay longs (positive rate for longs)
  - Funding factor increases for shorts, decreases for longs
```

**Dependencies:**
- `DataStore`: Read open interest
- `EventEmitter`: Emit events

---

#### 10. **RiskManager** (`risk/risk_manager.cairo`)
**Purpose**: Margin validation, open interest limits, liquidation checks

**Functions:**
- `validate_margin()`: Check if collateral is sufficient
- `validate_open_interest()`: Check if OI limit not exceeded
- `check_liquidation_threshold()`: Check if position is liquidatable
- `get_max_position_size()`: Calculate max position size
- `get_required_margin()`: Calculate required margin

**Margin Validation:**
```
required_margin = position_size * 10000 / leverage (in BPS)
collateral >= required_margin
```

**Liquidation Check:**
```
1. Calculate PnL
2. Calculate remaining_collateral = collateral ± PnL - fees
3. Calculate margin_ratio = (remaining_collateral / position_size) * 10000
4. If margin_ratio < LIQUIDATION_THRESHOLD_BPS (3%):
   → Position is liquidatable
```

**Dependencies:**
- `DataStore`: Read market configs, open interest
- `Oracle`: Get prices

---

### Layer 4: Vault & Token Management

#### 11. **CollateralVault** (`vault/collateral_vault.cairo`)
**Purpose**: Centralized token storage, profit/loss distribution, fee accrual

**Key Features:**
1. **Deposit/Withdraw**: Users deposit/withdraw yUSD
2. **Balance Tracking**: Per-user, per-market balances
3. **Profit Distribution**: Pays profits to users
4. **Loss Absorption**: Absorbs losses from losing positions
5. **Fee Accrual**: Collects trading/funding fees
6. **Exposure Management**: Tracks vault exposure per market
7. **Liquidation Protection**: Daily liquidation budgets
8. **Quoting Logic**: Market making capabilities

**Deposit Flow:**
```
1. User calls vault.deposit(market_id, amount)
2. User transfers yUSD to vault (ERC20 transfer_from)
3. Vault:
   a. Receives tokens
   b. Updates user_balances[user][market_id]
   c. Updates market_balances[market_id]
   d. Updates last_token_balance (for reconciliation)
```

**Withdraw Flow:**
```
1. User calls vault.withdraw(market_id, amount)
2. Vault:
   a. Checks user_balance >= amount
   b. Checks market_balance >= amount
   c. Transfers yUSD to user
   d. Updates balances
```

**Profit Distribution:**
```
1. PositionHandler calls vault.withdraw_profit(market_id, recipient, amount)
2. Vault:
   a. Checks market_balance >= amount
   b. Transfers yUSD to recipient
   c. Decreases market_balance
   d. Updates last_token_balance
```

**Loss Absorption:**
```
1. PositionHandler calls vault.absorb_loss(market_id, loss_amount)
2. Vault:
   a. Checks can_absorb_loss() (within daily budget)
   b. Records loss in daily_liquidation_records
   c. Decreases market_balance (tokens stay in vault)
   d. Updates last_token_balance
```

**Fee Accrual:**
```
1. PositionHandler calls vault.accrue_fees(market_id, fee_amount)
2. Vault:
   a. Increases accrued_fees[market_id]
   b. Increases total_accrued_fees
   c. Fees can be claimed by admin via FeeHandler
```

**Dependencies:**
- `RoleStore`: Access control (only handlers can call profit/loss functions)
- ERC20 yUSD token: Token transfers

---

### Layer 5: Router (Entry Point)

#### 12. **PerpRouter** (`router/perp_router.cairo`)
**Purpose**: Single entry point for all user operations

**Functions:**
- `open_position()`: Route to PositionHandler
- `close_position()`: Route to PositionHandler
- `liquidate_position()`: Route to LiquidationHandler
- `create_limit_order()`: Route to OrderHandler

**Why Router?**
- Single contract address for users
- Easier integration (one ABI)
- Can add middleware (fees, validation)
- Cleaner architecture

**Flow:**
```
User → PerpRouter → Handler → Core Contracts → Vault
```

---

## 🔄 Complete Interaction Flow

### Example: User Opens Long Position

```
1. User generates ZK proof (off-chain)
   - Private: account, market_id, is_long, size, margin
   - Public: commitment hash, market_id

2. User calls:
   router.open_position(proof, public_inputs, market_id, collateral_amount)

3. PerpRouter:
   → Calls position_handler.open_position(...)

4. PositionHandler:
   a. Gets market config from data_store
   b. Gets price from oracle
   c. Validates with risk_manager (margin, OI limits)
   d. Transfers collateral: user → vault (via ERC20)
   e. Creates Position struct
   f. Stores position in data_store
   g. Updates open interest in data_store
   h. Emits event via event_emitter

5. Result:
   - Position stored in DataStore
   - Collateral in Vault
   - Open interest updated
   - Event emitted
```

### Example: User Closes Position (Profit)

```
1. User generates ZK proof (off-chain)

2. User calls:
   router.close_position(proof, public_inputs, commitment, closing_size)

3. PerpRouter:
   → Calls position_handler.close_position(...)

4. PositionHandler:
   a. Gets position from data_store
   b. Updates price from oracle (fresh from Pragma)
   c. Calculates PnL (profit)
   d. Calculates fees (trading + funding)
   e. Calculates payout = margin + profit - fees
   f. Updates position in data_store (partial close)
   g. Calls vault.withdraw_profit(market_id, position.account, payout)
   h. Calls vault.accrue_fees(market_id, trading_fee)
   i. Updates collateral pool in data_store
   j. Emits event via event_emitter

5. Vault:
   a. Transfers payout yUSD to position.account
   b. Accrues fees

6. Result:
   - User receives payout (collateral + profit - fees)
   - Fees accrued to vault
   - Position updated/removed
   - Event emitted
```

### Example: Position Liquidated

```
1. Keeper detects liquidatable position (off-chain)

2. Keeper calls:
   router.liquidate_position(proof, public_inputs, commitment)

3. PerpRouter:
   → Calls liquidation_handler.liquidate_position(...)

4. LiquidationHandler:
   a. Gets position from data_store
   b. Gets price from oracle
   c. Verifies ZK proof (includes liquidation check)
   d. Validates with risk_manager.check_liquidation_threshold()
   e. Calculates PnL (loss)
   f. Calculates liquidation fee
   g. Calculates liquidator reward (50% of fee)
   h. Removes position from data_store
   i. Calls vault.absorb_loss(market_id, loss_amount)
   j. Calls vault.withdraw_profit(market_id, liquidator, reward)
   k. Updates collateral pool in data_store
   l. Emits event via event_emitter

5. Vault:
   a. Absorbs loss (decreases market_balance)
   b. Transfers reward to liquidator

6. Result:
   - Position removed
   - Loss absorbed by vault
   - Liquidator rewarded
   - Event emitted
```

---

## 🔐 Privacy Model

### What's Private (Off-Chain)
- User account address
- Position direction (long/short)
- Position size
- Entry price
- Margin amount

### What's Public (On-Chain)
- Position commitment hash (hash of private data)
- Market ID
- Public inputs (for ZK proof verification)

### ZK Proof Flow
```
1. User generates proof (off-chain):
   - Private inputs: account, market_id, is_long, size, margin, entry_price
   - Public inputs: commitment, market_id, action_type
   - Circuit validates: position exists, margin sufficient, etc.

2. User submits:
   - proof: Span<felt252>
   - public_inputs: Span<felt252>

3. Contract verifies:
   - Calls verifier.verify_ultra_starknet_zk_honk_proof(proof, public_inputs)
   - Verifier validates proof is correct
   - Contract proceeds if valid
```

---

## 📊 Data Flow Diagram

```
┌─────────────┐
│    User     │
└──────┬──────┘
       │
       │ 1. open_position(proof, ...)
       ▼
┌─────────────┐
│ PerpRouter  │
└──────┬──────┘
       │
       │ 2. Route to handler
       ▼
┌──────────────────┐
│ PositionHandler  │
└──────┬───────────┘
       │
       ├─→ 3. DataStore.get_market_config()
       │
       ├─→ 4. Oracle.get_price()
       │
       ├─→ 5. RiskManager.validate_margin()
       │
       ├─→ 6. CollateralVault.deposit()
       │         └─→ ERC20.transfer_from(user → vault)
       │
       ├─→ 7. DataStore.set_position()
       │
       ├─→ 8. DataStore.set_collateral_pool()
       │
       └─→ 9. EventEmitter.emit_position_opened()
```

---

## 🎯 Key Design Decisions

### 1. Why Centralized DataStore?
- **Gas Efficiency**: Single storage contract vs multiple
- **Consistency**: All state in one place
- **Queryability**: Easy to query all positions
- **Access Control**: Single point for role checks

### 2. Why Vault for Tokens?
- **Security**: All tokens in one place
- **Profit/Loss**: Easy to distribute profits, absorb losses
- **Fee Accrual**: Centralized fee collection
- **Balance Reconciliation**: Can verify on-chain balance matches

### 3. Why Router?
- **User Experience**: Single entry point
- **Integration**: One contract address, one ABI
- **Middleware**: Can add validation, fees, etc.
- **Upgradeability**: Can swap handlers without user changes

### 4. Why Role-Based Access?
- **Security**: Fine-grained permissions
- **Flexibility**: Can grant/revoke roles
- **Separation**: Handlers have CONTROLLER, keepers have KEEPER

### 5. Why EventEmitter?
- **Indexing**: Single source for events
- **Monitoring**: Easy to track all events
- **Consistency**: Same event format everywhere

---

## 🔧 Utility Libraries

### Position Utils (`position/position_utils.cairo`)
- `calculate_pnl()`: Calculate profit/loss
- `calculate_remaining_collateral()`: Calculate remaining margin
- `validate_position()`: Validate position data

### Fee Utils (`fee/fee_utils.cairo`)
- `calculate_trading_fee()`: Calculate trading fee
- `calculate_liquidation_fee()`: Calculate liquidation fee

### Pricing Utils (`pricing/pricing_utils.cairo`)
- `calculate_price_impact()`: Calculate price impact
- `calculate_execution_price()`: Calculate execution price

### Precision Utils (`utils/precision.cairo`)
- Fixed-point arithmetic
- BPS calculations
- Rounding functions

---

## 🚀 How It All Works Together

### System Initialization
```
1. Deploy RoleStore (with admin)
2. Deploy EventEmitter
3. Deploy DataStore (with RoleStore address)
4. Deploy Oracle (with Pragma address, EventEmitter)
5. Deploy CollateralVault (with RoleStore, yUSD token)
6. Deploy Funding (with DataStore, EventEmitter)
7. Deploy RiskManager (with DataStore, Oracle)
8. Deploy PositionHandler (with DataStore, Oracle, Vault, EventEmitter)
9. Deploy OrderHandler (with DataStore, Oracle, PositionHandler)
10. Deploy LiquidationHandler (with DataStore, Oracle, Vault, EventEmitter)
11. Deploy FeeHandler (with Vault)
12. Deploy PerpRouter (with all handlers)

13. Grant roles:
    - Grant CONTROLLER to PositionHandler, OrderHandler, LiquidationHandler
    - Grant KEEPER to keeper addresses
    - Grant ADMIN to admin address

14. Configure markets:
    - Set market configs in DataStore
    - Register markets in Oracle
```

### Normal Operation
```
1. Keepers update prices: Oracle.update_price_from_pragma()
2. Keepers update funding: Funding.update_funding_rate()
3. Users open/close positions: PerpRouter → PositionHandler
4. Keepers execute limit orders: PerpRouter → OrderHandler
5. Keepers liquidate positions: PerpRouter → LiquidationHandler
6. Admin claims fees: FeeHandler.claim_fees()
```

---

## ✅ Why This Architecture Works Perfectly

### 1. **Modularity**
- Each contract has single responsibility
- Easy to test, upgrade, replace
- Clear separation of concerns

### 2. **Security**
- Role-based access control
- ZK proofs for privacy
- Centralized vault for tokens
- Oracle price validation

### 3. **Gas Efficiency**
- Centralized storage (DataStore)
- Single vault for all tokens
- Minimal on-chain data (only commitments)

### 4. **Scalability**
- Can add new markets easily
- Can add new handlers
- Can upgrade individual components

### 5. **Privacy**
- Position details hidden via ZK
- Only commitments on-chain
- User addresses private

### 6. **Reliability**
- Oracle price validation
- Risk management checks
- Liquidation protection
- Fee accrual

---

## 📝 Summary

This architecture provides:
- ✅ **Privacy**: ZK proofs hide position details
- ✅ **Security**: Role-based access, vault for tokens
- ✅ **Efficiency**: Centralized storage, minimal on-chain data
- ✅ **Flexibility**: Modular design, easy to extend
- ✅ **Reliability**: Risk management, liquidation, fees
- ✅ **Usability**: Single router entry point

All contracts work together seamlessly through well-defined interfaces and clear responsibilities.
























