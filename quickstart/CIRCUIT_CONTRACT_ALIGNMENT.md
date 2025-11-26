# Circuit-Contract Alignment Analysis

## 🔍 Current Status

### ✅ Circuit Implementation
- **Status**: Complete - All 7 functions implemented
- **Location**: `quickstart/circuit/src/perp.nr` and `main.nr`
- **Functions**: 
  - `open_position_market` ✅
  - `open_position_limit` ✅
  - `open_position_twap` ✅
  - `close_position` ✅
  - `close_position_take_profit` ✅
  - `close_position_stop_loss` ✅
  - `check_liquidation` ✅

### ✅ Verifier Contract
- **Status**: Generated and compiled
- **Location**: `quickstart/verifier/`
- **Contract**: `UltraStarknetZKHonkVerifier`
- **Build Status**: ✅ Compiled successfully (dev & release)

---

## ⚠️ Critical Mismatch Found

### Problem: Circuit Output vs Contract Expectations

**Circuit Currently Returns:**
- Only `commitment: Field` (single value)

**Contracts Expect:**

#### For `open_position`:
- **Public Inputs** (Span<felt252>):
  - `[0]`: market_id
  - `[1]`: commitment
  - `[2]`: is_long
  
- **Proof Outputs** (Span<u256>):
  - `[0]`: size
  - `[1]`: collateral_locked

#### For `close_position`:
- **Public Inputs** (Span<felt252>):
  - `[0]`: market_id
  - `[1]`: commitment
  - `[2]`: outcome_code
  - `[3]`: is_full_close
  
- **Proof Outputs** (Span<u256>):
  - `[0]`: closed_size
  - `[1]`: payout
  - `[2]`: loss_to_vault
  - `[3]`: fees
  - `[4]`: collateral_released

#### For `liquidate_position`:
- **Public Inputs** (Span<felt252>):
  - `[0]`: market_id
  - `[1]`: commitment
  
- **Proof Outputs** (Span<u256>):
  - `[0]`: closed_size
  - `[1]`: loss_to_vault
  - `[2]`: fees
  - `[3]`: reward
  - `[4]`: collateral_released

---

## 🔧 Required Fixes

### 1. Update Circuit to Return Multiple Values

The circuit needs to return **public outputs** that the verifier contract can expose. In Noir with Garaga, we need to:

**Option A: Return struct with public outputs**
```noir
pub struct OpenPositionOutput {
    pub commitment: Field,
    pub size: Field,
    pub collateral_locked: Field,
}

pub fn open_position_market(...) -> OpenPositionOutput {
    // ... calculations ...
    OpenPositionOutput {
        commitment,
        size: private_position_size,
        collateral_locked: private_margin,
    }
}
```

**Option B: Use return array (if supported)**
```noir
pub fn open_position_market(...) -> pub [Field; 3] {
    [commitment, private_position_size, private_margin]
}
```

### 2. Update Main Function

The `main` function needs to route outputs properly based on action type.

### 3. Verify Garaga Integration

Check if Garaga properly extracts public outputs from Noir circuit and makes them available as `Span<u256>` in the verifier contract.

---

## 📋 Action Items

### Immediate (Critical)
1. ✅ **Circuit Logic**: Complete - All functions implemented
2. ❌ **Circuit Outputs**: Need to add public outputs (size, collateral, PnL, fees, etc.)
3. ✅ **Verifier Generation**: Done - Contract exists in `quickstart/verifier/`
4. ⚠️ **Output Alignment**: Need to verify Garaga extracts outputs correctly

### Next Steps
1. **Update Circuit Functions** to return public outputs
2. **Test Circuit** with `nargo test` to ensure outputs are correct
3. **Regenerate Verifier** using Garaga after circuit updates
4. **Test Verifier** with actual proofs to ensure outputs match contract expectations
5. **Update Contracts** if needed to match actual verifier output format

---

## 🔗 How Garaga Works

1. **Noir Circuit** → Compile to circuit.json
2. **Generate Proof** → Creates proof + public inputs
3. **Garaga** → Generates Cairo verifier contract from circuit
4. **Verifier Contract** → Verifies proofs and returns public outputs
5. **PositionHandler** → Calls verifier, gets `Option<Span<u256>>` with outputs

The key question: **Does Garaga automatically extract all `pub` return values from Noir as public outputs?**

---

## ✅ What's Working

1. ✅ Circuit compiles (`nargo check`)
2. ✅ Circuit has all required functions
3. ✅ Verifier contract generated and compiled
4. ✅ Contracts expect verifier interface correctly
5. ✅ Privacy logic matches (private inputs hidden, commitments generated)

---

## ❌ What Needs Fixing

1. ❌ Circuit needs to return public outputs (not just commitment)
2. ❌ Need to verify Garaga extracts outputs correctly
3. ❌ May need to update circuit return types
4. ❌ Test end-to-end: Circuit → Proof → Verifier → Contract

---

## 🎯 Recommendation

1. **Check Garaga Documentation**: Verify how public outputs are extracted
2. **Update Circuit**: Add public outputs to return values
3. **Regenerate Verifier**: Run `garaga gen` again after circuit update
4. **Test Integration**: Create a test proof and verify it works with contracts


