# Private Logic

## Overview

The Private Logic layer consists of Zero-Knowledge (ZK) circuits written in Noir that validate trading operations while keeping position details private. All financial information (position size, direction, margin, PnL) is hidden from public view, with only commitment hashes stored on-chain.

## Privacy Model

```mermaid
graph TB
    subgraph "Private (Off-Chain)"
        PD[Private Data<br/>- Account Address<br/>- Direction Long/Short<br/>- Position Size<br/>- Entry Price<br/>- Margin Amount<br/>- Trader Secret]
        ZK[ZK Circuit<br/>Noir]
        PRF[Proof Generation<br/>Off-Chain]
    end

    subgraph "Public (On-Chain)"
        CM[Commitment Hash<br/>Pedersen Hash]
        PI[Public Inputs<br/>- Market ID<br/>- Oracle Price<br/>- Timestamp]
        DS[DataStore<br/>Stores Commitments Only]
    end

    PD -->|Input| ZK
    ZK -->|Validate| PRF
    PRF -->|Output| CM
    CM -->|Store| DS
    PI -->|Verify| DS

    style PD fill:#ffe1e1
    style ZK fill:#f3e5f5
    style PRF fill:#f3e5f5
    style CM fill:#e8f5e9
    style DS fill:#e8f5e9
```

## Circuit Architecture

```mermaid
graph TB
    subgraph "Main Circuit (main.nr)"
        MAIN[main Function<br/>Action Router]
    end

    subgraph "Perp Module (perp.nr)"
        OM[open_position_market<br/>Market Order]
        OL[open_position_limit<br/>Limit Order]
        OT[open_position_twap<br/>TWAP Order]
        CP[close_position<br/>Regular Close]
        TP[close_position_take_profit<br/>Take Profit]
        SL[close_position_stop_loss<br/>Stop Loss]
        LI[check_liquidation<br/>Liquidation Check]
    end

    MAIN -->|action = 0| OM
    MAIN -->|action = 1| OL
    MAIN -->|action = 2| OT
    MAIN -->|action = 3| CP
    MAIN -->|action = 4| TP
    MAIN -->|action = 5| SL
    MAIN -->|action = 6| LI

    style MAIN fill:#e8f5e9
    style OM fill:#e1f5ff
    style CP fill:#e1f5ff
    style LI fill:#ffe1e1
```

## Circuit Flow

```mermaid
sequenceDiagram
    participant U as User
    participant CLIENT as Client App
    participant NOIR as Noir Circuit
    participant PROOF as Proof Generator
    participant VERIFIER as On-Chain Verifier

    Note over U,VERIFIER: Complete ZK Proof Flow

    U->>CLIENT: 1. Input Trading Parameters
    CLIENT->>CLIENT: Prepare Private Inputs<br/>(margin, size, direction, secret)

    CLIENT->>NOIR: 2. Execute Circuit
    NOIR->>NOIR: Validate Inputs
    NOIR->>NOIR: Calculate Commitment
    NOIR->>NOIR: Perform Validations
    NOIR-->>CLIENT: Commitment Hash

    CLIENT->>PROOF: 3. Generate ZK Proof
    PROOF->>PROOF: Create Witness
    PROOF->>PROOF: Generate Proof
    PROOF-->>CLIENT: Proof + Public Inputs

    CLIENT->>VERIFIER: 4. Submit to Contract
    VERIFIER->>VERIFIER: Verify Proof
    VERIFIER->>VERIFIER: Validate Public Inputs
    VERIFIER-->>CLIENT: Verification Result

    Note over U,VERIFIER: If Valid: Position Created/Updated
```

## Action Types

```mermaid
graph LR
    A[Action Type] --> A0[0: Open Market]
    A --> A1[1: Open Limit]
    A --> A2[2: Open TWAP]
    A --> A3[3: Close Position]
    A --> A4[4: Close Take Profit]
    A --> A5[5: Close Stop Loss]
    A --> A6[6: Check Liquidation]

    A0 -->|Immediate Execution| OM[Market Order]
    A1 -->|Trigger Price| OL[Limit Order]
    A2 -->|Time-Weighted| OT[TWAP Order]
    A3 -->|Manual Close| CP[Close Position]
    A4 -->|Profit Target| TP[Take Profit]
    A5 -->|Loss Limit| SL[Stop Loss]
    A6 -->|Margin Check| LI[Liquidation]

    style A fill:#e8f5e9
    style A0 fill:#e1f5ff
    style A3 fill:#e1f5ff
    style A6 fill:#ffe1e1
```

## Open Position Flow

```mermaid
graph TB
    START([User Inputs]) --> VAL1[Validate Price Freshness<br/>Check timestamp]
    VAL1 --> VAL2[Validate Sources<br/>num_sources >= min_sources]
    VAL2 --> VAL3[Validate Price<br/>oracle_price > 0]
    VAL3 --> CALC1[Calculate Execution Price<br/>oracle ± price_impact]
    CALC1 --> VAL4[Validate Execution Price<br/>Matches provided]
    VAL4 --> VAL5[Validate Slippage<br/>price_impact <= acceptable]
    VAL5 --> VAL6[Validate Margin<br/>margin >= required]
    VAL6 --> VAL7[Validate Position Size<br/>size <= max_position_size]
    VAL7 --> VAL8[Validate Margin Ratio<br/>margin_ratio >= min_ratio]
    VAL8 --> HASH[Generate Commitment<br/>Pedersen Hash]
    HASH --> RETURN([Return Commitment])

    style START fill:#e8f5e9
    style VAL1 fill:#fff4e1
    style CALC1 fill:#e1f5ff
    style HASH fill:#f3e5f5
    style RETURN fill:#e8f5e9
```

### Open Position (Market Order)

**Private Inputs**:
- `private_margin`: Collateral amount
- `private_position_size`: Position size
- `private_trader_secret`: Unique secret for commitment
- `is_long`: Direction (1 = long, 0 = short)

**Public Inputs**:
- `market_id`: Market identifier
- `oracle_price`: Current oracle price
- `execution_price`: Calculated execution price
- `price_impact`: Price impact amount
- `acceptable_slippage`: Max slippage (BPS)
- `leverage`: Leverage multiplier
- `min_margin_ratio`: Minimum margin ratio (BPS)
- `max_position_size`: Maximum position size
- `current_time`: Block timestamp
- `price_timestamp`: Price timestamp
- `num_sources`: Number of price sources
- `min_sources`: Minimum required sources
- `max_price_age`: Maximum price age (seconds)

**Validations**:
1. Price freshness: `current_time - price_timestamp <= max_price_age`
2. Sufficient sources: `num_sources >= min_sources`
3. Execution price: `execution_price = oracle_price ± price_impact`
4. Slippage: `(price_impact * 10000) / oracle_price <= acceptable_slippage`
5. Margin: `private_margin >= (private_position_size * 100) / leverage`
6. Position size: `private_position_size <= max_position_size`
7. Margin ratio: `(private_margin * 100) / private_position_size >= min_margin_ratio`

**Output**: Commitment hash (Pedersen hash of private data)

## Close Position Flow

```mermaid
graph TB
    START([Position Data]) --> VAL1[Validate Price Freshness]
    VAL1 --> VAL2[Validate Sources]
    VAL2 --> VAL3[Validate Closing Size<br/>closing_size <= position_size]
    VAL3 --> CALC1[Calculate PnL<br/>Based on direction]
    CALC1 --> CALC2[Calculate Trading Fee<br/>size * fee_bps / 10000]
    CALC2 --> CALC3[Calculate Remaining Collateral<br/>margin + pnl - fee]
    CALC3 --> CALC4[Calculate Collateral Released<br/>Proportional to closing size]
    CALC4 --> VAL4[Validate Collateral<br/>Should be positive]
    VAL4 --> HASH[Generate Commitment<br/>Include all private data]
    HASH --> RETURN([Return Commitment])

    style START fill:#e8f5e9
    style CALC1 fill:#e1f5ff
    style CALC2 fill:#fff4e1
    style CALC3 fill:#f3e5f5
    style HASH fill:#f3e5f5
    style RETURN fill:#e8f5e9
```

### Close Position

**Private Inputs**:
- `private_margin`: Original margin
- `private_position_size`: Full position size
- `private_entry_price`: Entry price
- `private_trader_secret`: Trader secret
- `is_long`: Direction

**Public Inputs**:
- `market_id`: Market identifier
- `current_price`: Current oracle price
- `closing_size`: Amount to close (partial close support)
- `trading_fee_bps`: Trading fee in basis points
- `current_time`: Block timestamp
- `price_timestamp`: Price timestamp
- `num_sources`: Number of price sources
- `min_sources`: Minimum required sources
- `max_price_age`: Maximum price age

**Calculations**:

1. **PnL Calculation**:
   ```noir
   // Long position
   if is_long == 1 {
       pnl = (current_price - entry_price) * closing_size / entry_price
   }
   // Short position
   else {
       pnl = (entry_price - current_price) * closing_size / entry_price
   }
   ```

2. **Trading Fee**:
   ```noir
   trading_fee = (closing_size * trading_fee_bps) / 10000
   ```

3. **Remaining Collateral**:
   ```noir
   remaining_collateral = private_margin + pnl - trading_fee
   ```

4. **Collateral Released**:
   ```noir
   if closing_size == private_position_size {
       collateral_released = remaining_collateral  // Full close
   } else {
       collateral_released = (remaining_collateral * closing_size) / private_position_size  // Partial close
   }
   ```

**Output**: Commitment hash

## Liquidation Check Flow

```mermaid
graph TB
    START([Position Data]) --> VAL1[Validate Price Freshness]
    VAL1 --> VAL2[Validate Sources]
    VAL2 --> CALC1[Calculate PnL<br/>Current vs Entry]
    CALC1 --> CALC2[Calculate Remaining Collateral<br/>margin + pnl]
    CALC2 --> CALC3[Calculate Required Margin<br/>size * min_ratio / 100]
    CALC3 --> VAL3[Check Liquidation<br/>remaining < required]
    VAL3 --> CALC4[Calculate Liquidation Fee<br/>size * 50 bps]
    CALC4 --> CALC5[Calculate Reward<br/>size * 5%]
    CALC5 --> CALC6[Calculate Loss to Vault<br/>Negative PnL]
    CALC6 --> HASH[Generate Commitment]
    HASH --> RETURN([Return Commitment])

    style START fill:#e8f5e9
    style CALC1 fill:#e1f5ff
    style VAL3 fill:#ffe1e1
    style CALC4 fill:#fff4e1
    style CALC5 fill:#f3e5f5
    style HASH fill:#f3e5f5
    style RETURN fill:#e8f5e9
```

### Check Liquidation

**Private Inputs**:
- `private_margin`: Original margin
- `private_position_size`: Position size
- `private_entry_price`: Entry price
- `private_trader_secret`: Trader secret
- `is_long`: Direction

**Public Inputs**:
- `market_id`: Market identifier
- `current_price`: Current oracle price
- `min_margin_ratio`: Minimum margin ratio (BPS)
- `current_time`: Block timestamp
- `price_timestamp`: Price timestamp
- `num_sources`: Number of price sources
- `min_sources`: Minimum required sources
- `max_price_age`: Maximum price age

**Calculations**:

1. **PnL Calculation**: Same as close position
2. **Remaining Collateral**: `private_margin + pnl`
3. **Required Margin**: `(private_position_size * min_margin_ratio) / 100`
4. **Liquidation Check**: `remaining_collateral < required_margin`
5. **Liquidation Fee**: `(closed_size * 50) / 10000` (0.5%)
6. **Liquidator Reward**: `(closed_size * 500) / 10000` (5%)

**Output**: Commitment hash (validates liquidation eligibility)

## Commitment Generation

```mermaid
graph LR
    PD[Private Data] --> HASH[Pedersen Hash]
    HASH --> CM[Commitment Hash]
    CM --> STORE[Store On-Chain]

    PD -->|Inputs| HASH
    HASH -->|Output| CM
    CM -->|Public| STORE

    style PD fill:#ffe1e1
    style HASH fill:#f3e5f5
    style CM fill:#e8f5e9
    style STORE fill:#e1f5ff
```

### Commitment Hash Components

For **Open Position**:
```noir
commitment = pedersen_hash([
    private_margin,
    private_position_size,
    private_trader_secret,
    market_id,
    execution_price,
    is_long
])
```

For **Close Position**:
```noir
commitment = pedersen_hash([
    private_margin,
    private_position_size,
    private_entry_price,
    private_trader_secret,
    market_id,
    current_price,
    closing_size,
    pnl,
    is_long
])
```

For **Liquidation**:
```noir
commitment = pedersen_hash([
    private_margin,
    private_position_size,
    private_entry_price,
    private_trader_secret,
    market_id,
    current_price,
    remaining_collateral,
    required_margin,
    is_long
])
```

## Privacy Guarantees

```mermaid
graph TB
    subgraph "What's Private"
        P1[Account Address]
        P2[Position Direction]
        P3[Position Size]
        P4[Entry Price]
        P5[Margin Amount]
        P6[PnL Amount]
        P7[Trading Fees]
    end

    subgraph "What's Public"
        PUB1[Commitment Hash]
        PUB2[Market ID]
        PUB3[Oracle Price]
        PUB4[Timestamp]
    end

    P1 --> CM[Commitment]
    P2 --> CM
    P3 --> CM
    P4 --> CM
    P5 --> CM
    P6 --> CM
    P7 --> CM

    CM --> PUB1
    PUB2 --> DS[DataStore]
    PUB3 --> DS
    PUB4 --> DS

    style P1 fill:#ffe1e1
    style P2 fill:#ffe1e1
    style P3 fill:#ffe1e1
    style CM fill:#f3e5f5
    style PUB1 fill:#e8f5e9
    style DS fill:#e1f5ff
```

## Proof Verification Flow

```mermaid
sequenceDiagram
    participant CIRCUIT as Noir Circuit
    participant PROOF as Proof Generator
    participant CONTRACT as Smart Contract
    participant VERIFIER as Verifier Contract

    Note over CIRCUIT,VERIFIER: Proof Verification Process

    CIRCUIT->>PROOF: Generate Witness
    PROOF->>PROOF: Create Proof<br/>(UltraHonk)
    PROOF-->>CONTRACT: Submit Proof + Public Inputs

    CONTRACT->>VERIFIER: verify_ultra_starknet_zk_honk_proof()
    VERIFIER->>VERIFIER: Verify Proof Validity
    VERIFIER->>VERIFIER: Check Public Inputs
    VERIFIER-->>CONTRACT: Verification Result

    alt Proof Valid
        CONTRACT->>CONTRACT: Execute Operation
        CONTRACT-->>PROOF: Success
    else Proof Invalid
        CONTRACT->>CONTRACT: Revert Transaction
        CONTRACT-->>PROOF: Error
    end
```

## Special Order Types

### Limit Order

```mermaid
graph LR
    LO[Limit Order] --> TRIGGER[Trigger Price Check]
    TRIGGER -->|Long: price >= trigger| EXEC[Execute]
    TRIGGER -->|Short: price <= trigger| EXEC
    EXEC --> OM[Open Market Logic]

    style LO fill:#e1f5ff
    style TRIGGER fill:#fff4e1
    style EXEC fill:#e8f5e9
```

**Additional Validation**:
- For long: `oracle_price <= trigger_price` (buy when price drops)
- For short: `oracle_price >= trigger_price` (sell when price rises)

### TWAP Order

```mermaid
graph LR
    TWAP[TWAP Order] --> CHUNK[Chunk Execution]
    CHUNK --> VAL[Validate Chunk Index]
    VAL --> TWAP_PRICE[Use TWAP Price]
    TWAP_PRICE --> OM[Open Market Logic]

    style TWAP fill:#f3e5f5
    style CHUNK fill:#e1f5ff
    style TWAP_PRICE fill:#fff4e1
```

**Additional Validations**:
- TWAP duration: 5 minutes to 24 hours
- Chunk index: `chunk_index < total_chunks`
- Uses TWAP price instead of spot price

### Take Profit / Stop Loss

```mermaid
graph TB
    TP[Take Profit] --> CHECK1[Check Price Reached]
    SL[Stop Loss] --> CHECK2[Check Price Hit]

    CHECK1 -->|Long: price >= target| EXEC1[Execute Close]
    CHECK1 -->|Short: price <= target| EXEC1

    CHECK2 -->|Long: price <= stop| EXEC2[Execute Close]
    CHECK2 -->|Short: price >= stop| EXEC2

    EXEC1 --> CP[Close Position Logic]
    EXEC2 --> CP

    style TP fill:#e8f5e9
    style SL fill:#ffe1e1
    style EXEC1 fill:#e8f5e9
    style EXEC2 fill:#ffe1e1
```

## Summary

The Private Logic layer provides:
- ✅ **Privacy**: All position details hidden via ZK proofs
- ✅ **Security**: Cryptographic validation of all operations
- ✅ **Flexibility**: Support for multiple order types
- ✅ **Efficiency**: Minimal on-chain data (only commitments)
- ✅ **Verifiability**: On-chain proof verification

The circuit ensures that:
- Position details remain private
- All validations are cryptographically proven
- Only commitment hashes are stored on-chain
- Users maintain full privacy while trading











