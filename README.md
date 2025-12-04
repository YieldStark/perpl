# CircuitX: Private Perpetual Futures DEX

> **Trade Private Perpetuals. Prove Validity, Never Identity.**

A privacy-native perpetual futures DEX built on **Ztarknet** (Starknet testnet) that enables margin trading with full leverage while keeping all position details completely private through **Zero-Knowledge proofs**.

---


### Why CircuitX Fits

CircuitX delivers **true privacy in perpetual trading**—a category explicitly mentioned in the wildcard bounty. Unlike traditional DEXs that expose all trading data on-chain, CircuitX uses ZK proofs to hide position details (size, entry price, margin, direction) while maintaining full on-chain verification.

**Key Innovation:** Only commitment hashes are stored on-chain. Position details are cryptographically hidden, making it impossible for MEV bots, competitors, or even the protocol itself to see your trading strategy.

---

## 🚀 Quick Start

### Prerequisites

- **Node.js** 18+ and **Bun** (or npm/yarn)
- **Starknet wallet** (ArgentX or Braavos) with testnet access
- **Ztarknet RPC** access: `https://ztarknet-madara.d.karnot.xyz`

### 1. Clone & Install

```bash
git clone <repository-url>
cd ztarknet/quickstart/app
bun install  # or npm install
```

### 2. Start Frontend

```bash
bun run dev  # or npm run dev
```

Open `http://localhost:5173` in your browser.

### 3. Connect Wallet & Get Test Tokens

1. **Connect Wallet**: Click "Connect" in the header
2. **Get yUSD**: Click "Faucet" → Mint test tokens (yUSD)
3. **Start Trading**: Navigate to `/trade` or click "Start Trading" on landing page

### 4. Open Your First Private Position

1. Select market (BTC/USD, SOL/USD, etc.)
2. Set margin amount and leverage (up to 20x)
3. Choose direction (Long/Short)
4. Click "Buy Market" or "Sell Market"
5. Wait for ZK proof generation (~10-30 seconds)
6. Confirm transaction in wallet

**Result:** Your position is open on-chain, but only a commitment hash is visible. All position details remain private!

---

## 🏗️ Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    User (Frontend)                          │
│  - React/TypeScript UI                                      │
│  - ZK Proof Generation (Noir + UltraHonk)                   │
│  - Wallet Integration (Starknet.js)                        │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│              PerpRouter (Entry Point)                       │
│  - Routes to PositionHandler/OrderHandler                   │
└────────────────────┬──────────────────────────────────────┘
                      │
        ┌─────────────┴─────────────┐
        ▼                           ▼
┌──────────────────┐      ┌──────────────────┐
│ PositionHandler  │      │   OrderHandler   │
│ - Open/Close     │      │ - Market/Limit   │
│ - Verify Proofs  │      │ - TWAP Orders    │
└────────┬─────────┘      └──────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Core Infrastructure                      │
│  • Verifier: Validates ZK proofs on-chain                   │
│  • DataStore: Stores only commitment hashes (no position    │
│    details)                                                 │
│  • CollateralVault: Manages user funds & PnL settlement     │
│  • Oracle: Pyth Network price feeds via Pragma Oracle      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Privacy Mechanism

### How Privacy Works

1. **User generates ZK proof** with private inputs:
   - Private margin amount
   - Private position size
   - Private entry price
   - Private trader secret

2. **Circuit generates commitment hash** (Pedersen hash):
   - One-way function (impossible to reverse)
   - Uniquely identifies position
   - Cryptographically bound to private inputs

3. **Only commitment stored on-chain**:
   - No position size
   - No entry price
   - No margin amount
   - No direction (long/short)

4. **Proof verification**:
   - Contract verifies proof validity
   - Ensures sufficient margin, valid price, etc.
   - **Without revealing any private values**

### What's Public vs Private

| Public (On-Chain)          | Private (User Only)         |
|----------------------------|-----------------------------|
| Commitment hash            | Position size               |
| User address               | Entry price                 |
| Market ID                  | Margin amount               |
| Timestamp                  | Direction (long/short)      |
| Locked collateral amount   | Trading strategy            |

---

## 📁 Project Structure

```
ztarknet/
├── quickstart/
│   ├── app/                    # Frontend (React + TypeScript)
│   │   ├── src/
│   │   │   ├── components/     # UI components
│   │   │   ├── services/       # ZK proof generation, contract calls
│   │   │   ├── hooks/          # React hooks
│   │   │   └── config/         # Contract addresses
│   │   └── package.json
│   │
│   ├── circuit/                 # ZK Circuit (Noir)
│   │   ├── src/
│   │   │   ├── main.nr         # Main circuit logic
│   │   │   └── perp.nr         # Perpetual trading logic
│   │   └── Nargo.toml
│   │
│   ├── contracts/              # Cairo Smart Contracts
│   │   ├── src/
│   │   │   ├── handlers/        # PositionHandler, OrderHandler
│   │   │   ├── vault/           # CollateralVault
│   │   │   ├── store/           # DataStore, RoleStore
│   │   │   └── router/          # PerpRouter
│   │   └── Scarb.toml
│   │
│   └── verifier/               # ZK Verifier Contract (Garaga)
│
├── docs/                       # Documentation
│   ├── ARCHITECTURE.md         # System architecture
│   ├── DEMO_SLIDES.md          # Demo presentation
│   └── ...
│
└── README.md                   # This file
```

---

## 🎯 Key Features

### Privacy
- ✅ **Complete position privacy** - Strategy, entry prices, sizes hidden
- ✅ **ZK proof verification** - Validates positions without revealing details
- ✅ **MEV-resistant** - Private positions can't be front-run

### Trading
- ✅ **Full leverage** - Up to 20x leverage
- ✅ **Multiple order types** - Market, Limit, TWAP
- ✅ **Automatic PnL settlement** - Profit/loss calculated and settled on close
- ✅ **Real-time oracle prices** - Pyth Network integration

### Security
- ✅ **No intermediaries** - Fully decentralized
- ✅ **Self-custody** - Users control their funds
- ✅ **On-chain verification** - All proofs verified on-chain

---

## 🧪 Testing the Demo

### Scenario 1: Open a Private Position

1. Go to `/trade` (or click "Start Trading")
2. Connect wallet and get yUSD from faucet
3. Set margin: `100 yUSD`
4. Set leverage: `20x`
5. Click "Buy Market" (Long position)
6. Wait for proof generation (~10-30s)
7. Confirm transaction

**Verify Privacy:**
- Check on-chain explorer: Only commitment hash visible
- No position size, entry price, or direction stored

### Scenario 2: View Your Positions

1. Scroll down to "Positions" section
2. See your position with:
   - Real-time PnL
   - Mark price vs entry price
   - Liquidation price
   - All calculated client-side (not on-chain)

### Scenario 3: Close Position

1. Click "Close" button on position
2. Wait for proof generation
3. Confirm transaction
4. Profit/loss automatically settled
5. Collateral unlocked

**Verify:**
- Position removed from on-chain storage
- Funds returned (profit added or loss deducted)

---

## 📚 Documentation

- **[Architecture](docs/ARCHITECTURE.md)** - System design and components
- **[Demo Slides](docs/DEMO_SLIDES.md)** - Presentation content
- **[Smart Contracts](docs/SMART_CONTRACT.md)** - Contract details
- **[ZK Circuit](quickstart/circuit/CIRCUIT_COMPLETE.md)** - Circuit implementation
- **[Deployment Guide](quickstart/DEPLOYMENT_GUIDE.md)** - How to deploy contracts

---

## 🔧 Technical Stack

- **Blockchain**: Ztarknet (Starknet testnet)
- **ZK System**: Noir circuits + UltraHonk proofs + Garaga verifier
- **Frontend**: React + TypeScript + Vite
- **Wallet**: Starknet.js (ArgentX/Braavos)
- **Oracle**: Pyth Network + Pragma Oracle
- **Language**: Cairo (contracts), Noir (circuits), TypeScript (frontend)

---

## 🌐 Deployed Contracts

### Network: Ztarknet
**RPC URL**: `https://ztarknet-madara.d.karnot.xyz`

### Key Contracts

- **yUSD Token**: `0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda`
- **Verifier**: `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d`
- **PerpRouter**: See `quickstart/app/src/config/contracts.ts` for latest addresses

---

## 🎬 Demo Video Highlights

1. **Landing Page** (`/`) - Hero section with value proposition
2. **Trading Interface** (`/trade`) - Open/close positions
3. **Portfolio** (`/portfolio`) - View positions and PnL
4. **Privacy Demo** - Show on-chain explorer (only commitment visible)

---

## 🤝 Contributing

This is a hackathon submission. For questions or issues:
- Check `docs/` for detailed documentation
- Review contract addresses in `quickstart/app/src/config/contracts.ts`
- See deployment guides in `quickstart/DEPLOYMENT_GUIDE.md`

---

## 📄 License

See `LICENSE` file for details.

---

## 🙏 Acknowledgments

- **Ztarknet** - Starknet testnet infrastructure
- **Noir** - ZK circuit language
- **Garaga** - ZK proof system
- **Pyth Network** - Oracle price feeds
- **Starknet.js** - Wallet integration

---

## 📞 Contact

For hackathon judges: All code, documentation, and demo are ready for review. The system is fully functional on Ztarknet testnet.

**Key Innovation:** CircuitX is the first fully private perpetual DEX where position details are cryptographically hidden while maintaining complete on-chain verification—exactly what the "Private perps" wildcard bounty is looking for.

---

**Built for Zypherpunk Hackathon 2025** 🚀
