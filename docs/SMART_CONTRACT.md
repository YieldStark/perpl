# Smart Contract

## Overview

The Smart Contract layer consists of modular Cairo contracts deployed on Ztarknet (Starknet testnet). The architecture follows a layered approach with clear separation of concerns, enabling privacy-preserving perpetual futures trading.

## Contract Architecture

```mermaid
graph TB
    subgraph "Layer 1: Core Infrastructure"
        RS[RoleStore<br/>Access Control]
        EE[EventEmitter<br/>Event Logging]
        DS[DataStore<br/>State Storage]
        OR[Oracle<br/>Price Feeds]
    end

    subgraph "Layer 2: Handler Contracts"
        PH[PositionHandler<br/>Position Management]
        OH[OrderHandler<br/>Order Execution]
        LH[LiquidationHandler<br/>Liquidation Logic]
        FH[FeeHandler<br/>Fee Collection]
    end

    subgraph "Layer 3: Market Logic"
        FU[Funding<br/>Funding Rates]
        RM[RiskManager<br/>Risk Validation]
    end

    subgraph "Layer 4: Vault"
        CV[CollateralVault<br/>Token Management]
    end

    subgraph "Layer 5: Router"
        PR[PerpRouter<br/>Entry Point]
    end

    subgraph "External"
        VF[Verifier<br/>ZK Proof Verification]
        ERC[yUSD Token<br/>ERC20]
        PRAGMA[Pragma Oracle<br/>Price Data]
    end

    PR --> PH
    PR --> OH
    PR --> LH
    PR --> FH

    PH --> DS
    PH --> OR
    PH --> RM
    PH --> CV
    PH --> EE
    PH --> VF

    OH --> DS
    OH --> OR
    OH --> PH

    LH --> DS
    LH --> OR
    LH --> RM
    LH --> CV
    LH --> EE
    LH --> VF

    FH --> CV

    FU --> DS
    RM --> DS
    RM --> OR

    CV --> ERC
    CV --> RS

    DS --> RS
    OR --> PRAGMA
    OR --> EE

    style PR fill:#e8f5e9
    style PH fill:#e1f5ff
    style OH fill:#e1f5ff
    style LH fill:#e1f5ff
    style DS fill:#fff4e1
    style CV fill:#f3e5f5
    style VF fill:#ffe1e1
```

## Contract Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant PR as PerpRouter
    participant PH as PositionHandler
    participant VF as Verifier
    participant DS as DataStore
    participant OR as Oracle
    participant RM as RiskManager
    participant CV as CollateralVault
    participant EE as EventEmitter

    Note over U,EE: Opening a Position

    U->>PR: open_position(proof, public_inputs)
    PR->>PH: Route to PositionHandler

    PH->>VF: verify_ultra_starknet_zk_honk_proof(proof, public_inputs)
    VF-->>PH: Verification Result

    PH->>DS: get_market_config(market_id)
    DS-->>PH: Market Configuration

    PH->>OR: get_price(market_id)
    OR-->>PH: Current Price

    PH->>RM: validate_margin(market_id, position_data)
    RM-->>PH: Validation Result

    PH->>CV: deposit(market_id, amount)
    CV->>ERC: transfer_from(user, vault, amount)
    ERC-->>CV: Transfer Success
    CV-->>PH: Deposit Confirmed

    PH->>DS: set_position(commitment, position_data)
    PH->>DS: update_open_interest(market_id, delta)
    PH->>EE: emit_position_opened(commitment, ...)

    PH-->>U: Position Opened
```

## Core Contracts

### 1. RoleStore

```mermaid
graph LR
    RS[RoleStore] --> ADMIN[ADMIN Role<br/>System Management]
    RS --> CONTROLLER[CONTROLLER Role<br/>Write to DataStore]
    RS --> KEEPER[KEEPER Role<br/>Execute Orders/Liquidations]

    ADMIN -->|Grant/Revoke| RS
    CONTROLLER -->|Write Access| DS[DataStore]
    KEEPER -->|Execute| OH[OrderHandler]
    KEEPER -->|Liquidate| LH[LiquidationHandler]

    style RS fill:#fff4e1
    style ADMIN fill:#ffe1e1
    style CONTROLLER fill:#e1f5ff
    style KEEPER fill:#f3e5f5
```

**Purpose**: Role-based access control (RBAC)

**Key Functions**:
- `grant_role(account, role)`: Grant role to account
- `revoke_role(account, role)`: Revoke role from account
- `has_role(account, role)`: Check if account has role
- `assert_only_role(account, role)`: Assert account has role (reverts if not)

**Roles**:
- `ADMIN`: System administration, role management
- `CONTROLLER`: Write access to DataStore (handlers)
- `KEEPER`: Execute limit orders and liquidations

### 2. DataStore

```mermaid
graph TB
    DS[DataStore] --> POS[Positions<br/>By Commitment Hash]
    DS --> MC[Market Configs<br/>Per Market ID]
    DS --> CP[Collateral Pools<br/>Per Market]
    DS --> OI[Open Interest<br/>Long/Short per Market]
    DS --> GEN[Generic Storage<br/>u256 Values]

    POS -->|Read/Write| PH[PositionHandler]
    MC -->|Read| RM[RiskManager]
    CP -->|Update| PH
    OI -->|Update| PH
    OI -->|Read| FU[Funding]

    style DS fill:#fff4e1
    style POS fill:#e8f5e9
    style MC fill:#e1f5ff
```

**Purpose**: Centralized state storage

**Key Functions**:
- `set_position(commitment, position)`: Store position (CONTROLLER only)
- `get_position(commitment)`: Retrieve position (public)
- `set_market_config(market_id, config)`: Configure market (ADMIN only)
- `get_market_config(market_id)`: Get market config (public)
- `update_open_interest(market_id, long_delta, short_delta)`: Update OI (CONTROLLER only)

**Access Control**:
- Reads: Public
- Writes: Only `CONTROLLER` role

### 3. Oracle

```mermaid
graph LR
    OR[Oracle] --> PRAGMA[Pragma Oracle<br/>External Contract]
    OR --> CACHE[Price Cache<br/>Value + Timestamp]
    OR --> VAL[Price Validation<br/>Freshness Check]

    PRAGMA -->|get_data_median| OR
    OR -->|Cache| CACHE
    CACHE -->|Validate| VAL
    VAL -->|Return| PH[PositionHandler]

    style OR fill:#fff4e1
    style PRAGMA fill:#e1f5ff
    style CACHE fill:#e8f5e9
```

**Purpose**: Price feed integration with Pragma Oracle

**Key Functions**:
- `update_price_from_pragma(market_id)`: Fetch and cache price (KEEPER)
- `get_price(market_id)`: Get cached price (public)
- `validate_price_freshness(timestamp)`: Check price age

**Supported Markets**: BTC, ETH, WBTC, LORDS, STRK, EKUBO, DOG

**Price Structure**:
```cairo
struct Price {
    value: u128,
    timestamp: u64,
    decimals: u32,
    num_sources: u32
}
```

### 4. PositionHandler

```mermaid
graph TB
    PH[PositionHandler] --> OPEN[open_position<br/>Create New Position]
    PH --> CLOSE[close_position<br/>Close Existing Position]

    OPEN --> VF[Verify ZK Proof]
    OPEN --> DS[Get Market Config]
    OPEN --> OR[Get Price]
    OPEN --> RM[Validate Risk]
    OPEN --> CV[Deposit Collateral]
    OPEN --> DS2[Store Position]
    OPEN --> EE[Emit Event]

    CLOSE --> DS3[Get Position]
    CLOSE --> OR2[Update Price]
    CLOSE --> PNL[Calculate PnL]
    CLOSE --> FEES[Calculate Fees]
    CLOSE --> CV2[Distribute Funds]
    CLOSE --> DS4[Update Position]
    CLOSE --> EE2[Emit Event]

    style PH fill:#e1f5ff
    style OPEN fill:#e8f5e9
    style CLOSE fill:#e8f5e9
```

**Purpose**: Handle position opening and closing

**Key Functions**:
- `open_position(proof, public_inputs)`: Open new position
- `close_position(proof, public_inputs, commitment)`: Close position

**Dependencies**:
- `DataStore`: Read/write positions
- `Oracle`: Get prices
- `CollateralVault`: Deposit/withdraw tokens
- `EventEmitter`: Emit events
- `Verifier`: Verify ZK proofs

### 5. OrderHandler

```mermaid
graph TB
    OH[OrderHandler] --> MO[Market Order<br/>Execute Immediately]
    OH --> LO[Limit Order<br/>Store & Execute Later]
    OH --> TO[TWAP Order<br/>Time-Weighted Average]

    MO --> OR[Get Price]
    MO --> PH[Execute via PositionHandler]

    LO --> DS[Store Order]
    LO --> MON[Monitor Price]
    MON --> EX[Execute When Triggered]
    EX --> PH

    TO --> DS2[Store TWAP Order]
    TO --> CHUNK[Execute Chunks]
    CHUNK --> PH

    style OH fill:#e1f5ff
    style MO fill:#e8f5e9
    style LO fill:#f3e5f5
    style TO fill:#fff4e1
```

**Purpose**: Create and execute market/limit/TWAP orders

**Key Functions**:
- `create_market_order(...)`: Execute immediately
- `create_limit_order(...)`: Store for later execution
- `create_twap_order(...)`: Create TWAP order
- `execute_limit_order(...)`: Execute limit order (KEEPER)
- `execute_twap_chunk(...)`: Execute TWAP chunk (KEEPER)

### 6. LiquidationHandler

```mermaid
graph TB
    LH[LiquidationHandler] --> DETECT[Detect Liquidatable<br/>Off-Chain Monitoring]
    LH --> VERIFY[Verify ZK Proof<br/>Includes Liquidation Check]
    LH --> VALIDATE[Validate Position<br/>Check Margin Ratio]
    LH --> CALC[Calculate Loss<br/>PnL + Fees]
    LH --> REWARD[Calculate Reward<br/>50% of Fee]
    LH --> CLOSE[Close Position<br/>Remove from DataStore]
    LH --> ABSORB[Absorb Loss<br/>Vault Takes Loss]
    LH --> PAY[Pay Reward<br/>To Liquidator]

    DETECT -->|Keeper| LH
    VERIFY --> VF[Verifier]
    VALIDATE --> RM[RiskManager]
    ABSORB --> CV[CollateralVault]
    PAY --> CV

    style LH fill:#ffe1e1
    style DETECT fill:#f3e5f5
    style ABSORB fill:#fff4e1
```

**Purpose**: Liquidate undercollateralized positions

**Key Functions**:
- `liquidate_position(proof, public_inputs, commitment)`: Liquidate position

**Liquidation Process**:
1. Verify ZK proof (includes liquidation validation)
2. Validate position is liquidatable
3. Calculate PnL and fees
4. Calculate liquidator reward (50% of liquidation fee)
5. Close position
6. Absorb loss into vault
7. Pay reward to liquidator

### 7. CollateralVault

```mermaid
graph TB
    CV[CollateralVault] --> DEP[Deposit<br/>User Deposits yUSD]
    CV --> WIT[Withdraw<br/>User Withdraws yUSD]
    CV --> PROF[Profit Distribution<br/>Pay Profits to Users]
    CV --> LOSS[Loss Absorption<br/>Absorb Losses]
    CV --> FEE[Fee Accrual<br/>Collect Trading/Funding Fees]

    DEP --> ERC[ERC20 Transfer]
    WIT --> ERC
    PROF --> ERC
    LOSS --> BAL[Update Balances]
    FEE --> ACC[Accrued Fees]

    style CV fill:#f3e5f5
    style DEP fill:#e8f5e9
    style PROF fill:#e8f5e9
    style LOSS fill:#ffe1e1
    style FEE fill:#fff4e1
```

**Purpose**: Centralized token storage and profit/loss management

**Key Functions**:
- `deposit(market_id, amount)`: User deposits yUSD
- `withdraw(market_id, amount)`: User withdraws yUSD
- `withdraw_profit(market_id, recipient, amount)`: Pay profits (CONTROLLER only)
- `absorb_loss(market_id, loss_amount)`: Absorb losses (CONTROLLER only)
- `accrue_fees(market_id, fee_amount)`: Accrue fees (CONTROLLER only)

**Balance Tracking**:
- Per-user, per-market balances
- Market-level balances
- Accrued fees per market

### 8. PerpRouter

```mermaid
graph TB
    PR[PerpRouter] --> OP[open_position]
    PR --> CP[close_position]
    PR --> LP[liquidate_position]
    PR --> MO[create_market_order]
    PR --> LO[create_limit_order]
    PR --> TO[create_twap_order]
    PR --> EO[execute_limit_order]
    PR --> ET[execute_twap_chunk]

    OP --> PH[PositionHandler]
    CP --> PH
    LP --> LH[LiquidationHandler]
    MO --> OH[OrderHandler]
    LO --> OH
    TO --> OH
    EO --> OH
    ET --> OH

    style PR fill:#e8f5e9
    style PH fill:#e1f5ff
    style OH fill:#e1f5ff
    style LH fill:#ffe1e1
```

**Purpose**: Single entry point for all user operations

**Key Functions**:
- Routes all operations to appropriate handlers
- Provides unified interface for users
- Can add middleware (validation, fees) in future

## Data Structures

### Position Record

```cairo
struct PositionRecord {
    account: ContractAddress,      // User account (private in ZK)
    market_id: felt252,             // Market identifier
    commitment: felt252,            // Commitment hash (public)
    // Private fields (in ZK proof):
    // - is_long: bool
    // - size: u256
    // - margin: u256
    // - entry_price: u256
}
```

### Market Config

```cairo
struct MarketConfig {
    max_leverage: u256,
    min_margin_ratio_bps: u256,     // e.g., 500 = 5%
    max_position_size: u256,
    trading_fee_bps: u256,          // e.g., 10 = 0.1%
    liquidation_fee_bps: u256,
    is_active: bool
}
```

## Deployment Order

```mermaid
graph TD
    START([Start Deployment]) --> L1[1. RoleStore]
    L1 --> L2[2. EventEmitter]
    L2 --> L3[3. DataStore]
    L3 --> L4[4. Oracle]
    L4 --> L5[5. Verifier]
    L5 --> L6[6. CollateralVault]
    L6 --> L7[7. Funding]
    L7 --> L8[8. RiskManager]
    L8 --> L9[9. PositionHandler]
    L9 --> L10[10. OrderHandler]
    L10 --> L11[11. LiquidationHandler]
    L11 --> L12[12. FeeHandler]
    L12 --> L13[13. PerpRouter]
    L13 --> CONFIG[14. Configure System]
    CONFIG --> ROLES[Grant Roles]
    ROLES --> MARKETS[Configure Markets]
    MARKETS --> END([System Ready])

    style START fill:#e8f5e9
    style END fill:#e8f5e9
    style L1 fill:#fff4e1
    style L9 fill:#e1f5ff
    style L13 fill:#e8f5e9
```

## Security Features

1. **Role-Based Access Control**: Fine-grained permissions
2. **ZK Proof Verification**: Privacy-preserving validation
3. **Price Validation**: Freshness and source checks
4. **Risk Management**: Margin and position size limits
5. **Liquidation Protection**: Automatic liquidation of risky positions

## Summary

The Smart Contract architecture provides:
- ✅ **Modularity**: Clear separation of concerns
- ✅ **Security**: Role-based access, ZK verification
- ✅ **Efficiency**: Centralized storage, minimal on-chain data
- ✅ **Privacy**: Position details hidden via commitments
- ✅ **Flexibility**: Easy to extend and upgrade

All contracts work together through well-defined interfaces, enabling a secure and efficient perpetual futures trading platform.

