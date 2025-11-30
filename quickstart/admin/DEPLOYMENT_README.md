# Full Contract Deployment Guide

This guide will help you redeploy all contracts from scratch, automatically setting up roles and enabling markets.

## Prerequisites

1. **Account Setup**: You need a deployed account on Ztarknet
   - The script will try to use the `ztarknet` account automatically
   - Or set `ACCOUNT_ADDRESS` and `ACCOUNT_KEY` in `.env`
   - Or the script will prompt you for account details

2. **sncast**: Must be installed and configured
   ```bash
   # Check if sncast is available
   sncast --version
   
   # Make sure your account is set up
   sncast account list
   ```

3. **Contracts Built**: Contracts must be compiled
   ```bash
   cd quickstart/contracts
   scarb build
   ```

## Quick Start

```bash
cd quickstart/admin
npm run deploy-all
```

The script will:
1. ✅ Deploy all contracts in the correct order
2. ✅ Automatically grant necessary roles to handlers
3. ✅ Enable markets (BTC/USD, ETH/USD) with default config
4. ✅ Save all addresses to `deployment-addresses.json`

## What Gets Deployed

### Phase 1: Core Contracts
1. **RoleStore** - Access control (admin = your account)
2. **EventEmitter** - Event emission
3. **DataStore** - Centralized storage
4. **Oracle** - Price feeds (uses MockOracle)
5. **CollateralVault** - Token vault

### Phase 2: Handler Contracts
6. **PositionHandler** - Position management + ZK verification
7. **OrderHandler** - Order execution
8. **LiquidationHandler** - Liquidations + ZK verification
9. **RiskManager** - Risk parameters

### Phase 3: Router
10. **PerpRouter** - Main entry point

## Automatic Setup

After deployment, the script automatically:

1. **Grants Roles**:
   - `CONTROLLER` role to PositionHandler, OrderHandler, LiquidationHandler
   - `POSITION_HANDLER` role to PositionHandler
   - `LIQUIDATION_HANDLER` role to LiquidationHandler

2. **Enables Markets**:
   - BTC/USD
   - ETH/USD
   - With default config (20x leverage, 5% margin, etc.)

## Configuration

### Environment Variables (`.env`)

```bash
# Account (optional - script will try sncast first)
ACCOUNT_ADDRESS=0x...
ACCOUNT_KEY=0x...
ACCOUNT_NAME=ztarknet  # Default account name for sncast

# Network
RPC_URL=https://ztarknet-madara.d.karnot.xyz
```

### Contract Addresses (Hardcoded)

The script uses these pre-deployed addresses:
- **Verifier**: `0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d`
- **yUSD Token**: `0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda`
- **MockOracle**: `0x00e2c5d520b31762df17b54f339c665a7c4c9fa9e81fd05c40c2e0fce3de47b9`

## Output

After successful deployment, you'll get:

1. **Console Output**: All contract addresses printed
2. **JSON File**: `deployment-addresses.json` with all addresses
3. **Ready to Use**: Markets are enabled and ready for trading

## Troubleshooting

### Error: "sncast not found"
- Install sncast: https://foundry-rs.github.io/starknet-foundry/getting_started/installation.html
- Make sure it's in your PATH

### Error: "Account not found"
- Create account: `sncast account create --name ztarknet --url https://ztarknet-madara.d.karnot.xyz`
- Or set `ACCOUNT_ADDRESS` and `ACCOUNT_KEY` in `.env`

### Error: "Contract declaration failed"
- Make sure contracts are built: `cd quickstart/contracts && scarb build`
- Check you have enough funds for deployment

### Error: "Role grant failed"
- Make sure the account used for deployment has ADMIN role (it should, since it's the RoleStore admin)
- Check account has enough funds

## Manual Steps (if needed)

If the script fails partway through, you can:

1. Check `deployment-addresses.json` for what was deployed
2. Continue from where it left off
3. Or restart the script (it will redeploy everything)

## Next Steps

After deployment:

1. **Update Frontend Config**: Update contract addresses in `quickstart/app/src/config/contracts.ts`
2. **Test Order Submission**: Try submitting an order from the frontend
3. **Monitor**: Check transactions on the explorer

## Notes

- **RoleStore Admin**: The account you use for deployment becomes the RoleStore admin automatically
- **No Role Management Needed**: The script handles all role grants automatically
- **Markets Enabled**: Markets are enabled by default with sensible configs
- **Fresh Deployment**: This redeploys everything - old contracts are not affected



