# Admin zone

## Install deps

Requires node >= 22

```
npm i
```

## Setup

### Step 1: Set up Admin Account

**Recommended: Create a new admin account (easiest)**
```bash
# Creates a new account, deploys it, and configures .env automatically
npm run create-admin

# Or with a custom name
npm run create-admin my-admin-account
```

This will:
- Create a new account using `sncast`
- Deploy it to the Ztarknet network
- Automatically configure your `.env` file
- Save the account details locally

**Alternative options:**

**Option A: Run from WSL (if accounts are in WSL)**
```bash
# From WSL terminal
cd /mnt/c/Users/DELL/ztarknet/quickstart/admin
npm run setup-account oracle_admin
```

**Option B: Manual setup (works from Windows or WSL)**
```bash
# This will prompt you for address and private key
npm run setup-account-manual
```

To get your account details, run from WSL:
```bash
sncast account show --name oracle_admin --display-private-keys
```

**Option C: Set environment variable and run setup**
```bash
# Set the account file path (WSL path)
set SNCAST_ACCOUNT_FILE=/home/ahm/.starknet_accounts/starknet_open_zeppelin_accounts.json
npm run setup-account oracle_admin
```

**Option D: Manually edit `.env` file**
Create or edit `quickstart/admin/.env`:
```env
ADMIN_ADDRESS=0x5be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e
ADMIN_KEY=0x35be678fc5dc3ac7a7b80382d0a24374f750193586b2d69dbc82e75d69baf61
```

**Known deployed accounts:**
- `oracle_admin`: `0x5be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e` ✅
- `ztarknet`: `0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec` ✅
- `myaccount`: `0x5966682c7b99e235f68ffeca45b3f62753ab5d71167a9963cd78c6c24be27ad` ❌ (not deployed)

The `setup-account` script will:
- Extract the account address and private key from sncast or account file
- Automatically update your `.env` file
- Check if the account is deployed

### Step 2: Verify `.env` file

Make sure `quickstart/admin/.env` contains:
- `ADMIN_KEY` - Private key of the admin account (must have ADMIN role)
- `ADMIN_ADDRESS` - Address of the admin account
- `MARKET_ID` (optional) - Market ID to enable (default: 'BTC/USD')

## Scripts

### Check Market Status

Check if a market is enabled and view its configuration.

```bash
# Check BTC/USD (default)
npm run check-market

# Check a specific market
MARKET_ID='ETH/USD' npm run check-market
```

### Enable Market

Enable a market for trading by setting `enabled: true` in the market config.

```bash
# Enable BTC/USD (default)
npm run enable-market

# Enable a specific market
MARKET_ID='ETH/USD' npm run enable-market
```

The script will:
1. Fetch the current market config (if it exists)
2. Update the `enabled` field to `true`
3. Preserve all other market settings (leverage, fees, etc.)
4. If the market doesn't exist, it will create it with default settings

**Note:** The admin account must have the `ADMIN` role in the RoleStore contract.