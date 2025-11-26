# Deployment Order & How Verifier Works

## Key Understanding

### Compilation vs Deployment

**Compilation (Building):**
- ✅ **You DON'T need the verifier deployed to compile contracts**
- Contracts use `IVerifier` interface (just a trait definition)
- They store `verifier_address: ContractAddress` (just a number)
- No runtime dependency during compilation

**Deployment (On-Chain):**
- ✅ **You DO need the verifier deployed first**
- Contracts need the actual verifier address to call it
- Verifier address is passed in constructor

---

## Recommended Order

### Step 1: Build Everything (No Deployment Needed)

```bash
# 1. Build verifier contract
cd quickstart/verifier
scarb build

# 2. Build perpetual contracts
cd ../contracts
scarb build
```

**Why this works:**
- Verifier contract exists as code (in `verifier/` directory)
- Perpetual contracts use interface, not actual contract
- Both compile independently

---

### Step 2: Deploy Contracts (In Order)

#### 2.1 Deploy Verifier First

```bash
cd quickstart/verifier

# Declare the contract
sncast declare --contract-name UltraStarknetZKHonkVerifier

# Note the class hash from output, then deploy:
sncast invoke \
  --contract-address 0x041a78e741e5af2fec34b695679bc6891742439f7afb8484ecd7766661ad02bf \
  --function "deployContract" \
  --calldata <CLASS_HASH> 0x0 0x0 0x0

# Note the deployed contract address from events
```

**Output:** You'll get a verifier contract address like `0x1234...`

---

#### 2.2 Deploy Perpetual Contracts (With Verifier Address)

```bash
cd quickstart/contracts

# Deploy in dependency order:
# 1. RoleStore
# 2. DataStore (needs RoleStore)
# 3. EventEmitter
# 4. Oracle
# 5. CollateralVault (needs RoleStore)
# 6. PositionHandler (needs: DataStore, EventEmitter, Verifier, Vault)
# 7. OrderHandler
# 8. LiquidationHandler
# 9. RiskManager
# 10. PerpRouter (needs all handlers)
```

**Example - Deploy PositionHandler:**
```bash
sncast declare --contract-name PositionHandler

sncast deploy \
  --class-hash <POSITION_HANDLER_CLASS_HASH> \
  --constructor-calldata \
    <DATA_STORE_ADDRESS> \
    <EVENT_EMITTER_ADDRESS> \
    <VERIFIER_ADDRESS> \  # ← Use the verifier address from Step 2.1
    <YUSD_TOKEN_ADDRESS> \
    <COLLATERAL_VAULT_ADDRESS>
```

---

## How It Works

### At Compile Time

```cairo
// contracts/src/core/verifier.cairo
#[starknet::interface]
pub trait IVerifier<TContractState> {
    fn verify_ultra_starknet_zk_honk_proof(...) -> Option<Span<u256>>;
}

// This is just an interface - no actual contract needed!
```

```cairo
// contracts/src/handlers/position_handler.cairo
use private_perp::core::verifier::{IVerifier, IVerifierDispatcher};

// Uses interface, not actual contract
let verifier = IVerifierDispatcher { 
    contract_address: self.verifier_address.read() 
};
```

**Key Point:** `IVerifierDispatcher` is auto-generated from the interface. It's just a struct that holds an address. No deployment needed for compilation.

---

### At Runtime (After Deployment)

```cairo
// When user calls open_position():
let verifier = IVerifierDispatcher { 
    contract_address: self.verifier_address.read()  // Address set in constructor
};

// This makes an external call to the deployed verifier contract
let result = verifier.verify_ultra_starknet_zk_honk_proof(proof);
```

**Key Point:** At runtime, the dispatcher calls the actual deployed verifier contract at the stored address.

---

## Complete Deployment Checklist

### Phase 1: Build (No Deployment)
- [x] ✅ Build verifier: `cd verifier && scarb build`
- [ ] ⏳ Build contracts: `cd contracts && scarb build`
- [ ] ⏳ Verify both compile successfully

### Phase 2: Deploy Core Contracts
- [ ] Deploy RoleStore
- [ ] Deploy DataStore (with RoleStore address)
- [ ] Deploy EventEmitter
- [ ] Deploy Oracle
- [ ] Deploy CollateralVault (with RoleStore address)

### Phase 3: Deploy Verifier
- [ ] Declare verifier: `sncast declare --contract-name UltraStarknetZKHonkVerifier`
- [ ] Deploy verifier via UDC
- [ ] **Save verifier address** ← Important!

### Phase 4: Deploy Handler Contracts (Need Verifier)
- [ ] Deploy PositionHandler (with verifier address)
- [ ] Deploy OrderHandler
- [ ] Deploy LiquidationHandler (with verifier address)
- [ ] Deploy RiskManager

### Phase 5: Deploy Router
- [ ] Deploy PerpRouter (with all handler addresses)

---

## Summary

**For Building:**
- ✅ Build verifier first (optional, but good practice)
- ✅ Build contracts second
- ✅ No deployment needed

**For Deployment:**
- ✅ Deploy verifier first
- ✅ Deploy contracts second (with verifier address)
- ✅ Verifier must exist on-chain before contracts can use it

**Why This Works:**
- Compilation uses interfaces (no runtime dependency)
- Deployment needs actual addresses (runtime dependency)

---

## Next Steps Right Now

Since you've already built the verifier, you should:

1. **Build the contracts** to make sure everything compiles:
   ```bash
   cd quickstart/contracts
   scarb build
   ```

2. **If contracts build successfully**, you're ready to deploy when needed

3. **When ready to deploy**, follow Phase 2-5 above


