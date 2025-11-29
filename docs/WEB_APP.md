# Web App (Future Frontend Configuration)

## Overview

The Web App is a React/TypeScript frontend application that provides a user interface for interacting with the Private Perpetual DEX. It handles ZK proof generation, wallet connection, and transaction submission to the Starknet network.

## Application Architecture

```mermaid
graph TB
    subgraph "User Interface Layer"
        UI[React Components]
        APP[App.tsx<br/>Main Component]
        FC[Faucet Component<br/>Token Faucet]
    end

    subgraph "Proof Generation Layer"
        NOIR[Noir.js<br/>Circuit Execution]
        HONK[UltraHonkBackend<br/>Proof Generation]
        GARAGA[Garaga SDK<br/>Calldata Preparation]
    end

    subgraph "Wallet Integration"
        STARKNET[Starknet.js<br/>RPC Provider]
        WALLET[Wallet Connection<br/>ArgentX/Braavos]
    end

    subgraph "Circuit Assets"
        CIRCUIT[circuit.json<br/>Compiled Circuit]
        VERIFIER[verifier.json<br/>Verifier ABI]
        VK[vk.bin<br/>Verifying Key]
    end

    subgraph "Backend Services"
        RPC[RPC Provider<br/>Ztarknet Network]
        CONTRACT[Verifier Contract<br/>On-Chain]
    end

    UI --> APP
    APP --> FC
    APP --> NOIR

    NOIR --> CIRCUIT
    NOIR --> HONK
    HONK --> GARAGA
    GARAGA --> VK

    APP --> STARKNET
    STARKNET --> WALLET
    STARKNET --> RPC
    RPC --> CONTRACT

    GARAGA --> STARKNET

    style APP fill:#e8f5e9
    style NOIR fill:#f3e5f5
    style HONK fill:#f3e5f5
    style STARKNET fill:#e1f5ff
    style CONTRACT fill:#fff4e1
```

## Proof Generation Flow

```mermaid
sequenceDiagram
    participant U as User
    participant UI as React UI
    participant NOIR as Noir.js
    participant HONK as UltraHonkBackend
    participant GARAGA as Garaga SDK
    participant STARKNET as Starknet.js
    participant CONTRACT as Verifier Contract

    Note over U,CONTRACT: Complete Proof Generation & Verification Flow

    U->>UI: 1. Enter Input Values
    UI->>UI: Update State (inputX, inputY)

    U->>UI: 2. Click "Start" Button
    UI->>UI: State: GeneratingWitness

    UI->>NOIR: 3. Execute Circuit
    NOIR->>NOIR: Load circuit.json
    NOIR->>NOIR: Generate Witness
    NOIR-->>UI: Witness Data

    UI->>UI: State: GeneratingProof

    UI->>HONK: 4. Generate Proof
    HONK->>HONK: Load bytecode
    HONK->>HONK: Generate ZK Proof
    HONK-->>UI: Proof + Public Inputs

    UI->>UI: State: PreparingCalldata

    UI->>GARAGA: 5. Prepare Calldata
    GARAGA->>GARAGA: Load vk.bin
    GARAGA->>GARAGA: Serialize Proof
    GARAGA-->>UI: Calldata Array

    UI->>UI: State: ConnectingWallet

    UI->>STARKNET: 6. Connect to Network
    STARKNET->>RPC: Connect to Ztarknet
    STARKNET-->>UI: Provider Ready

    UI->>UI: State: SendingTransaction

    UI->>CONTRACT: 7. Call Verifier
    CONTRACT->>CONTRACT: Verify Proof
    CONTRACT-->>UI: Verification Result

    UI->>UI: State: ProofVerified
    UI-->>U: Success Message
```

## Component Structure

```mermaid
graph TD
    subgraph "App.tsx - Main Component"
        STATE[State Management<br/>useState, useRef]
        PROOF[Proof Generation Logic]
        UI[UI Rendering]
    end

    subgraph "Faucet.tsx - Token Faucet"
        FAUCET_STATE[Faucet State]
        MINT[Mint Function]
        BALANCE[Balance Display]
    end

    subgraph "helpers/proof.ts"
        FLATTEN[flattenFieldsAsArray<br/>Utility Function]
    end

    subgraph "types/index.ts"
        PROOF_STATE[ProofState Enum]
        PROOF_DATA[ProofStateData Interface]
    end

    STATE --> PROOF
    PROOF --> UI
    UI --> FAUCET_STATE
    FAUCET_STATE --> MINT
    FAUCET_STATE --> BALANCE
    PROOF --> FLATTEN
    PROOF --> PROOF_STATE
    PROOF --> PROOF_DATA

    style STATE fill:#e8f5e9
    style PROOF fill:#f3e5f5
    style FAUCET_STATE fill:#e1f5ff
```

## State Machine

```mermaid
stateDiagram-v2
    [*] --> Initial: App Loaded

    Initial --> GeneratingWitness: User Clicks Start
    GeneratingWitness --> GeneratingProof: Witness Generated
    GeneratingProof --> PreparingCalldata: Proof Generated
    PreparingCalldata --> ConnectingWallet: Calldata Ready
    ConnectingWallet --> SendingTransaction: Wallet Connected
    SendingTransaction --> ProofVerified: Transaction Success

    GeneratingWitness --> Error: Witness Generation Failed
    GeneratingProof --> Error: Proof Generation Failed
    PreparingCalldata --> Error: Calldata Preparation Failed
    ConnectingWallet --> Error: Wallet Connection Failed
    SendingTransaction --> Error: Transaction Failed

    Error --> Initial: User Clicks Reset
    ProofVerified --> Initial: User Clicks Reset

    note right of Initial
        User can input values
        and start the process
    end note

    note right of Error
        Error message displayed
        User can reset and retry
    end note

    note right of ProofVerified
        Proof successfully verified
        on-chain
    end note
```

## File Structure

```mermaid
graph LR
    subgraph "app/"
        A[src/]
        B[public/]
        C[package.json]
    end

    subgraph "src/"
        D[App.tsx<br/>Main Component]
        E[main.tsx<br/>Entry Point]
        F[components/]
        G[helpers/]
        H[types/]
        I[assets/]
    end

    subgraph "components/"
        J[Faucet.tsx<br/>Token Faucet UI]
        K[Faucet.css<br/>Styles]
    end

    subgraph "helpers/"
        L[proof.ts<br/>Proof Utilities]
    end

    subgraph "types/"
        M[index.ts<br/>TypeScript Types]
    end

    subgraph "assets/"
        N[circuit.json<br/>Compiled Circuit]
        O[verifier.json<br/>Verifier ABI]
        P[vk.bin<br/>Verifying Key]
    end

    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    A --> I

    F --> J
    F --> K
    G --> L
    H --> M
    I --> N
    I --> O
    I --> P

    style D fill:#e8f5e9
    style J fill:#e1f5ff
    style N fill:#f3e5f5
    style O fill:#f3e5f5
    style P fill:#f3e5f5
```

## Technology Stack

```mermaid
graph TB
    subgraph "Frontend Framework"
        REACT[React 18<br/>UI Framework]
        TS[TypeScript<br/>Type Safety]
        VITE[Vite<br/>Build Tool]
    end

    subgraph "ZK Libraries"
        NOIR_JS[Noir.js<br/>Circuit Execution]
        BB_JS[bb.js<br/>UltraHonk Backend]
        GARAGA_JS[Garaga SDK<br/>Calldata Generation]
    end

    subgraph "Blockchain"
        STARKNET_JS[Starknet.js<br/>RPC & Contracts]
        RPC_PROVIDER[RPC Provider<br/>Network Connection]
    end

    subgraph "Build Tools"
        BUN[Bun<br/>Package Manager]
        ESLINT[ESLint<br/>Code Quality]
    end

    REACT --> TS
    TS --> VITE
    VITE --> BUN

    REACT --> NOIR_JS
    NOIR_JS --> BB_JS
    BB_JS --> GARAGA_JS

    REACT --> STARKNET_JS
    STARKNET_JS --> RPC_PROVIDER

    style REACT fill:#e8f5e9
    style NOIR_JS fill:#f3e5f5
    style STARKNET_JS fill:#e1f5ff
```

## Key Features

### 1. Proof Generation
- **Witness Generation**: Executes Noir circuit with user inputs
- **Proof Creation**: Generates ZK proof using UltraHonk backend
- **Calldata Preparation**: Serializes proof for on-chain verification

### 2. Wallet Integration
- **Network Connection**: Connects to Ztarknet testnet
- **Contract Interaction**: Calls verifier contract methods
- **Transaction Handling**: Manages transaction lifecycle

### 3. User Interface
- **State Management**: Tracks proof generation progress
- **Error Handling**: Displays errors at each stage
- **Token Faucet**: Allows users to mint test tokens

## Future Frontend Configuration

### Planned Features

```mermaid
graph TD
    subgraph "Trading Interface"
        TI[Position Management<br/>Open/Close Positions]
        OI[Order Management<br/>Create/Execute Orders]
        PM[Portfolio View<br/>Position History]
    end

    subgraph "ZK Integration"
        ZKI[Automatic Proof Generation<br/>Background Processing]
        ZKC[Proof Caching<br/>Optimize Performance]
        ZKV[Proof Verification Status<br/>Real-time Updates]
    end

    subgraph "Market Data"
        MD[Price Charts<br/>Real-time Updates]
        MF[Funding Rates<br/>Display & History]
        MOI[Open Interest<br/>Market Metrics]
    end

    subgraph "Wallet Features"
        WF[Multi-Wallet Support<br/>ArgentX, Braavos]
        WB[Balance Display<br/>yUSD & ETH]
        WH[Transaction History<br/>User Activity]
    end

    TI --> ZKI
    OI --> ZKI
    PM --> ZKC
    ZKI --> ZKV
    MD --> MF
    MF --> MOI
    WF --> WB
    WB --> WH

    style TI fill:#e8f5e9
    style ZKI fill:#f3e5f5
    style MD fill:#e1f5ff
    style WF fill:#fff4e1
```

### Configuration Options

1. **Network Configuration**
   - RPC endpoint configuration
   - Contract addresses management
   - Network switching (testnet/mainnet)

2. **Proof Generation Settings**
   - Thread count for proof generation
   - Proof caching strategies
   - Background proof generation

3. **UI Customization**
   - Theme configuration
   - Layout preferences
   - Notification settings

4. **Performance Optimization**
   - Code splitting
   - Lazy loading
   - Asset optimization

## Development Setup

```mermaid
graph LR
    A[Install Dependencies] --> B[Copy Artifacts]
    B --> C[Build Circuit]
    C --> D[Start Dev Server]
    D --> E[Test Proof Generation]
    E --> F[Deploy to Production]

    style A fill:#e8f5e9
    style D fill:#e1f5ff
    style F fill:#fff4e1
```

### Setup Steps

1. **Install Dependencies**
   ```bash
   cd app
   bun install
   ```

2. **Copy Circuit Artifacts**
   ```bash
   make artifacts
   ```

3. **Start Development Server**
   ```bash
   bun run serve
   ```

4. **Build for Production**
   ```bash
   bun run build
   ```

## Integration Points

```mermaid
graph TB
    subgraph "Frontend"
        FE[React App]
    end

    subgraph "ZK Circuit"
        ZC[Noir Circuit<br/>circuit.json]
    end

    subgraph "Blockchain"
        BC[Starknet Network]
        VC[Verifier Contract]
        PC[PerpRouter Contract]
    end

    subgraph "External Services"
        ORACLE[Pragma Oracle<br/>Price Feeds]
        RPC[RPC Node<br/>Network Access]
    end

    FE -->|Generate Proof| ZC
    FE -->|Submit Transaction| BC
    BC -->|Verify Proof| VC
    VC -->|Valid| PC
    PC -->|Get Prices| ORACLE
    BC -->|Network Access| RPC

    style FE fill:#e8f5e9
    style ZC fill:#f3e5f5
    style BC fill:#e1f5ff
    style VC fill:#fff4e1
```

## Summary

The Web App provides:
- ✅ **Proof Generation**: Complete ZK proof workflow
- ✅ **Wallet Integration**: Seamless blockchain interaction
- ✅ **User Experience**: Intuitive interface with state tracking
- ✅ **Error Handling**: Comprehensive error management
- ✅ **Future-Ready**: Architecture supports trading features

The frontend is designed to be extensible, allowing for easy addition of trading features, market data visualization, and advanced portfolio management tools.











