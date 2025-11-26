# Profit Distribution & Fee/Loss Accrual - Summary

## Quick Answer

### Which Vault Handles This?

**CollateralVault** handles:
- ✅ Profit distribution (`withdraw_profit()`)
- ✅ Loss absorption (`absorb_loss()`)
- ✅ Fee accrual (`accrue_fees()`)
- ✅ Balance validation (`has_sufficient_balance()`)

### Does Contract Hold Enough yUSD?

**Yes, CollateralVault holds all yUSD tokens:**
- Users deposit → Vault receives tokens
- Vault's ERC20 balance = actual tokens held
- Balance validated before every payout
- Minimum reserve ensures solvency

## How It Works

### 1. Token Storage

```
All yUSD tokens → CollateralVault
  ├── User deposits → Vault balance increases
  ├── Profits paid → Vault balance decreases
  ├── Losses absorbed → Vault balance stays (loss remains)
  └── Fees accrued → Vault balance stays (fees claimable)
```

### 2. Profit Distribution

```
User closes profitable position:
  PositionHandler → vault.withdraw_profit(market_id, user, payout)
  Vault → Transfers yUSD to user
  Vault balance ↓
```

**Profit source:** Vault balance (from deposits + other users' losses)

### 3. Loss Absorption

```
User closes losing position:
  PositionHandler → vault.absorb_loss(market_id, loss_amount)
  Vault → Loss stays in vault (tokens remain)
  PositionHandler → vault.withdraw_profit(market_id, user, remaining)
  Vault → Transfers remaining to user
  Vault balance ↓ (by payout, loss stays)
```

**Loss coverage:** Vault balance absorbs losses (up to limits)

### 4. Fee Accrual

```
Trade executes:
  FeeHandler → vault.accrue_fees(market_id, fee_amount)
  Vault → Updates accrued_fees[market_id]
  Fees stay in vault (admin can claim)
```

**Fee source:** Trading fees, liquidation fees, maker rebates

## Balance Requirements

### Minimum Balance

```
Vault Balance >= 
  All user deposits
  + Maximum potential profits
  + Insurance fund
  + Minimum reserve (10% or 1000 yUSD)
```

### Solvency Check

```cairo
vault.has_sufficient_balance(required_amount)  // Before every payout
vault.can_absorb_loss(market_id, loss_amount)  // Before absorbing loss
```

## Current Implementation

### CollateralVault Functions

1. **`deposit()`** - User deposits tokens → Vault holds them
2. **`withdraw_profit()`** - Pays profits to users
3. **`absorb_loss()`** - Absorbs losses (tokens stay)
4. **`accrue_fees()`** - Collects fees
5. **`get_vault_token_balance()`** - Gets actual ERC20 balance
6. **`has_sufficient_balance()`** - Validates before payout

### PositionHandler Integration

**Opening:**
- User deposits to vault first
- PositionHandler validates deposit

**Closing:**
- Calculates payout
- Calls `vault.withdraw_profit()` for profits
- Calls `vault.absorb_loss()` for losses
- Vault handles all transfers

## Key Points

1. ✅ **Vault holds ALL tokens** - Single source of truth
2. ✅ **Balance validated** - Before every operation
3. ✅ **Profits from vault** - Paid when users win
4. ✅ **Losses to vault** - Absorbed (tokens stay)
5. ✅ **Fees in vault** - Accrued, claimable by admin

## Files

- `PROFIT_LOSS_DISTRIBUTION.md` - Detailed explanation
- `VAULT_BALANCE_EXPLAINED.md` - Balance management
- `PROFIT_LOSS_SUMMARY.md` - This file








