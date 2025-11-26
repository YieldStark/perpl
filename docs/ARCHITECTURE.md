# Architecture

## System Overview

The Private Perpetual DEX is a **modular, privacy-enabled perpetual futures trading platform** built on Ztarknet (Starknet testnet). The system uses **Zero-Knowledge proofs** to keep position details private while maintaining on-chain verification.

## Core Design Principles

1. **Modular Architecture**: Each component has a single responsibility
2. **Privacy-First**: Position details hidden via ZK proofs, only commitments on-chain
3. **Centralized Data**: All state stored in `DataStore` for gas efficiency
4. **Role-Based Access**: `RoleStore` controls who can do what
5. **Event-Driven**: `EventEmitter` for off-chain indexing
6. **Oracle Integration**: Pragma Oracle for price feeds
7. **Vault-Based**: `CollateralVault` holds all tokens and manages profit/loss

## System Architecture Flow

```mermaid
graph TB
    subgraph "User Layer"
        U[User/Trader]
        K[Keeper]
        A[Admin]
    end

    subgraph "Entry Point"
        PR[PerpRouter<br/>Main Entry Point]
    end

    subgraph "Handler Layer"
        PH[PositionHandler<br/>Open/Close Positions]
        OH[OrderHandler<br/>Market/Limit/TWAP Orders]
        LH[LiquidationHandler<br/>Liquidate Positions]
        FH[FeeHandler<br/>Claim Fees]
    end

    subgraph "Core Infrastructure"
        DS[DataStore<br/>Centralized Storage]
        RS[RoleStore<br/>Access Control]
        EE[EventEmitter<br/>Event Logging]
        OR[Oracle<br/>Price Feeds]
    end

    subgraph "Market & Risk"
        RM[RiskManager<br/>Margin Validation]
        FU[Funding<br/>Funding Rates]
    end

    subgraph "Vault Layer"
        CV[CollateralVault<br/>Token Management]
        ERC[yUSD Token<br/>ERC20]
    end

    subgraph "Privacy Layer"
        ZK[ZK Circuit<br/>Noir Proof Generation]
        VF[Verifier<br/>Proof Verification]
    end

    U -->|1. Generate ZK Proof| ZK
    U -->|2. Submit Transaction| PR
    K -->|Monitor & Execute| PR
    A -->|Manage System| PR

    PR -->|Route Operations| PH
    PR -->|Route Orders| OH
    PR -->|Route Liquidations| LH
    PR -->|Route Fee Claims| FH

    PH -->|Read/Write| DS
    PH -->|Get Prices| OR
    PH -->|Validate Risk| RM
    PH -->|Deposit/Withdraw| CV
    PH -->|Emit Events| EE

    OH -->|Store Orders| DS
    OH -->|Get Prices| OR
    OH -->|Execute via| PH

    LH -->|Read Positions| DS
    LH -->|Get Prices| OR
    LH -->|Validate Risk| RM
    LH -->|Absorb Losses| CV
    LH -->|Emit Events| EE

    FH -->|Claim Fees| CV

    CV -->|Transfer Tokens| ERC

    ZK -->|3. Verify Proof| VF
    VF -->|4. Validate| PH
    VF -->|4. Validate| LH

    DS -->|Check Roles| RS
    CV -->|Check Roles| RS

    style U fill:#e1f5ff
    style K fill:#fff4e1
    style A fill:#ffe1e1
    style PR fill:#e8f5e9
    style ZK fill:#f3e5f5
    style VF fill:#f3e5f5
```

## Component Interaction Flow

```mermaid
sequenceDiagram
    participant U as User
    participant ZK as ZK Circuit
    participant PR as PerpRouter
    participant PH as PositionHandler
    participant DS as DataStore
    participant OR as Oracle
    participant RM as RiskManager
    participant CV as CollateralVault
    participant EE as EventEmitter

    Note over U,EE: Opening a Position Flow

    U->>ZK: 1. Generate Proof<br/>(Private: margin, size, direction)
    ZK->>ZK: Validate inputs<br/>Calculate commitment
    ZK-->>U: Return commitment hash

    U->>PR: 2. open_position(proof, public_inputs)
    PR->>PH: Route to PositionHandler

    PH->>DS: 3. Get market config
    DS-->>PH: Market parameters

    PH->>OR: 4. Get current price
    OR-->>PH: Price data

    PH->>RM: 5. Validate margin & risk
    RM-->>PH: Validation result

    PH->>CV: 6. Deposit collateral
    CV->>CV: Transfer yUSD from user
    CV-->>PH: Deposit confirmed

    PH->>DS: 7. Store position (commitment)
    PH->>DS: 8. Update open interest
    PH->>EE: 9. Emit PositionOpened event

    PH-->>U: Position opened successfully
```

## Data Flow Architecture

```mermaid
graph LR
    subgraph "Private (Off-Chain)"
        PD[Position Details<br/>- Account Address<br/>- Direction Long/Short<br/>- Position Size<br/>- Entry Price<br/>- Margin Amount]
        ZK[ZK Circuit<br/>Noir]
        PRF[Proof Generation]
    end

    subgraph "Public (On-Chain)"
        CM[Commitment Hash<br/>Pedersen Hash of<br/>Private Data]
        DS[DataStore<br/>Stores Commitments]
        EV[Events<br/>PositionOpened/Closed]
    end

    PD -->|Input| ZK
    ZK -->|Validate| PRF
    PRF -->|Output| CM
    CM -->|Store| DS
    DS -->|Emit| EV

    style PD fill:#ffe1e1
    style ZK fill:#f3e5f5
    style PRF fill:#f3e5f5
    style CM fill:#e8f5e9
    style DS fill:#e8f5e9
    style EV fill:#e8f5e9
```

## Layer Architecture

```mermaid
graph TD
    subgraph "Layer 1: Core Infrastructure"
        L1A[RoleStore]
        L1B[EventEmitter]
        L1C[DataStore]
        L1D[Oracle]
    end

    subgraph "Layer 2: Handler Contracts"
        L2A[PositionHandler]
        L2B[OrderHandler]
        L2C[LiquidationHandler]
        L2D[FeeHandler]
    end

    subgraph "Layer 3: Market & Risk"
        L3A[Funding]
        L3B[RiskManager]
    end

    subgraph "Layer 4: Vault & Tokens"
        L4A[CollateralVault]
        L4B[yUSD Token]
    end

    subgraph "Layer 5: Router"
        L5A[PerpRouter]
    end

    L5A --> L2A
    L5A --> L2B
    L5A --> L2C
    L5A --> L2D

    L2A --> L1C
    L2A --> L1D
    L2A --> L3B
    L2A --> L4A
    L2A --> L1B

    L2B --> L1C
    L2B --> L1D
    L2B --> L2A

    L2C --> L1C
    L2C --> L1D
    L2C --> L3B
    L2C --> L4A
    L2C --> L1B

    L2D --> L4A

    L3A --> L1C
    L3B --> L1C
    L3B --> L1D

    L4A --> L4B
    L4A --> L1A

    L1C --> L1A
    L1B --> L1A

    style L5A fill:#e8f5e9
    style L2A fill:#e1f5ff
    style L2B fill:#e1f5ff
    style L2C fill:#e1f5ff
    style L2D fill:#e1f5ff
    style L1C fill:#fff4e1
    style L1D fill:#fff4e1
    style L4A fill:#f3e5f5
```

## Key Architectural Decisions

### 1. Centralized DataStore
- **Why**: Gas efficiency, single storage contract
- **Benefit**: Consistent state, easy querying
- **Trade-off**: Single point of access control

### 2. Vault-Based Token Management
- **Why**: Security, centralized profit/loss distribution
- **Benefit**: Easy fee accrual, loss absorption
- **Trade-off**: Requires trust in vault contract

### 3. Router Pattern
- **Why**: Single entry point for users
- **Benefit**: Easier integration, middleware support
- **Trade-off**: Additional contract layer

### 4. Role-Based Access Control
- **Why**: Fine-grained permissions
- **Benefit**: Security, flexibility
- **Trade-off**: Requires role management

### 5. ZK Proof Privacy
- **Why**: Hide position details from public
- **Benefit**: Privacy-preserving trading
- **Trade-off**: Off-chain proof generation overhead

## System Initialization Flow

```mermaid
graph TD
    Start([System Deployment]) --> L1[Deploy Core Infrastructure]
    L1 --> L1A[1. RoleStore]
    L1A --> L1B[2. EventEmitter]
    L1B --> L1C[3. DataStore]
    L1C --> L1D[4. Oracle]
    L1D --> L2[Deploy Vault]
    L2 --> L2A[5. CollateralVault]
    L2A --> L3[Deploy Market Logic]
    L3 --> L3A[6. Funding]
    L3A --> L3B[7. RiskManager]
    L3B --> L4[Deploy Handlers]
    L4 --> L4A[8. PositionHandler]
    L4A --> L4B[9. OrderHandler]
    L4B --> L4C[10. LiquidationHandler]
    L4C --> L4D[11. FeeHandler]
    L4D --> L5[Deploy Router]
    L5 --> L5A[12. PerpRouter]
    L5A --> L6[Configure System]
    L6 --> L6A[13. Grant Roles]
    L6A --> L6B[14. Configure Markets]
    L6B --> End([System Ready])

    style Start fill:#e8f5e9
    style End fill:#e8f5e9
    style L1 fill:#e1f5ff
    style L2 fill:#fff4e1
    style L3 fill:#f3e5f5
    style L4 fill:#ffe1e1
    style L5 fill:#e8f5e9
    style L6 fill:#e8f5e9
```

## Operational Flow

```mermaid
stateDiagram-v2
    [*] --> Idle: System Ready

    Idle --> PriceUpdate: Keeper Updates Price
    Idle --> FundingUpdate: Keeper Updates Funding
    Idle --> UserAction: User Action

    PriceUpdate --> Oracle: Update from Pragma
    Oracle --> Idle: Price Cached

    FundingUpdate --> Funding: Calculate Rate
    Funding --> Idle: Rate Updated

    UserAction --> OpenPosition: Open Position
    UserAction --> ClosePosition: Close Position
    UserAction --> CreateOrder: Create Order

    OpenPosition --> VerifyProof: Verify ZK Proof
    VerifyProof --> ValidateRisk: Check Margin
    ValidateRisk --> DepositCollateral: Transfer Tokens
    DepositCollateral --> StorePosition: Save to DataStore
    StorePosition --> EmitEvent: Emit Event
    EmitEvent --> Idle

    ClosePosition --> GetPosition: Load from DataStore
    GetPosition --> CalculatePnL: Calculate Profit/Loss
    CalculatePnL --> DistributeFunds: Handle Payout/Loss
    DistributeFunds --> UpdatePosition: Update/Remove
    UpdatePosition --> EmitEvent

    CreateOrder --> StoreOrder: Save Order
    StoreOrder --> Idle

    Idle --> Liquidation: Keeper Detects Liquidatable
    Liquidation --> VerifyLiquidation: Verify Proof
    VerifyLiquidation --> Liquidate: Close Position
    Liquidate --> RewardLiquidator: Pay Reward
    RewardLiquidator --> AbsorbLoss: Vault Absorbs Loss
    AbsorbLoss --> EmitEvent
```

## Summary

This architecture provides:
- ✅ **Privacy**: ZK proofs hide position details
- ✅ **Security**: Role-based access, vault for tokens
- ✅ **Efficiency**: Centralized storage, minimal on-chain data
- ✅ **Flexibility**: Modular design, easy to extend
- ✅ **Reliability**: Risk management, liquidation, fees
- ✅ **Usability**: Single router entry point

All components work together seamlessly through well-defined interfaces and clear responsibilities.

