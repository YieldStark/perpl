#!/bin/bash

# Redeploy DataStore with role checks bypassed
# After this, we'll need to redeploy contracts that use DataStore

echo "🔄 Redeploying DataStore with role checks bypassed..."
echo ""

cd ../contracts

# Declare DataStore
echo "📝 Step 1: Declaring DataStore..."
sncast declare --contract-name DataStore

echo ""
echo "🚀 Step 2: Deploy DataStore (copy class_hash from above)"
echo ""
echo "Run this command:"
echo ""
echo "sncast deploy \\"
echo "  --class-hash <DATA_STORE_CLASS_HASH> \\"
echo "  --constructor-calldata \\"
echo "    0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819"
echo ""
echo "⚠️  After deployment, you'll need to redeploy:"
echo "   - PositionHandler (with new DataStore address)"
echo "   - OrderHandler (with new DataStore address)"
echo "   - LiquidationHandler (with new DataStore address)"
echo "   - RiskManager (with new DataStore address)"
echo "   - PerpRouter (with new handler addresses)"

