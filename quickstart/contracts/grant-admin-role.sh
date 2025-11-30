#!/bin/bash

# Grant ADMIN role to a new account using ztarknet account
# Usage: ./grant-admin-role.sh <new_admin_address>

set -e

RPC_URL="https://ztarknet-madara.d.karnot.xyz"
ROLE_STORE_ADDRESS="0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819"
ZTARKNET_ACCOUNT="ztarknet"

if [ -z "$1" ]; then
    echo "Usage: ./grant-admin-role.sh <new_admin_address>"
    echo "Example: ./grant-admin-role.sh 0x6ea65f11fc62023916d34c517bc2deaf15024bf5f851209741b34fd1afd7bef"
    exit 1
fi

NEW_ADMIN_ADDRESS=$1

echo "🔐 Granting ADMIN role to new account"
echo "   New Admin: $NEW_ADMIN_ADDRESS"
echo "   Using: $ZTARKNET_ACCOUNT account"
echo "   RoleStore: $ROLE_STORE_ADDRESS"
echo ""

# Convert 'ADMIN' string to felt252 (ASCII encoding)
# 'ADMIN' = 0x41444d494e
ADMIN_ROLE="0x41444d494e"

echo "📤 Calling grant_role on RoleStore..."
# Get account details from sncast
echo "   Getting ztarknet account details..."
ACCOUNT_INFO=$(sncast account show --name $ZTARKNET_ACCOUNT --display-private-keys)

# Extract address and private key
ZTARKNET_ADDR=$(echo "$ACCOUNT_INFO" | grep -i "address:" | awk '{print $2}')
ZTARKNET_KEY=$(echo "$ACCOUNT_INFO" | grep -i "private key:" | awk '{print $3}')

if [ -z "$ZTARKNET_ADDR" ] || [ -z "$ZTARKNET_KEY" ]; then
    echo "❌ Could not get ztarknet account details"
    echo "   Make sure the account exists: sncast account list"
    exit 1
fi

echo "   Using account: $ZTARKNET_ADDR"
echo ""

# Use private key directly (sncast invoke doesn't support --account flag in all versions)
sncast invoke \
    --contract-address $ROLE_STORE_ADDRESS \
    --function "grant_role" \
    --calldata $NEW_ADMIN_ADDRESS $ADMIN_ROLE \
    --url $RPC_URL \
    --private-key $ZTARKNET_KEY \
    --account-address $ZTARKNET_ADDR

echo ""
echo "✅ ADMIN role granted!"
echo "   New admin can now run: npm run enable-market (from admin folder)"

