#!/bin/bash

# Quick redeploy script for PositionHandler with MARKET_DISABLED bypass
# Make sure you've rebuilt contracts first: cd ../contracts && scarb build

echo "🔄 Redeploying PositionHandler..."
echo ""

# Deployed addresses
DATA_STORE="0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e"
EVENT_EMITTER="0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02"
VERIFIER="0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d"
YUSD_TOKEN="0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda"
COLLATERAL_VAULT="0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d"

cd ../contracts

echo "📝 Step 1: Declaring PositionHandler..."
sncast declare --contract-name PositionHandler

echo ""
echo "🚀 Step 2: Deploying PositionHandler..."
echo "   (Copy the class hash from above and use it below)"
echo ""
echo "Run this command with the class hash from declaration:"
echo ""
echo "sncast deploy \\"
echo "  --class-hash <POSITION_HANDLER_CLASS_HASH> \\"
echo "  --constructor-calldata \\"
echo "    $DATA_STORE \\"
echo "    $EVENT_EMITTER \\"
echo "    $VERIFIER \\"
echo "    $YUSD_TOKEN \\"
echo "    $COLLATERAL_VAULT"
echo ""
echo "Or run this all-in-one:"
echo ""
echo "CLASS_HASH=\$(sncast declare --contract-name PositionHandler | grep 'class_hash' | awk '{print \$3}')"
echo "sncast deploy --class-hash \$CLASS_HASH --constructor-calldata $DATA_STORE $EVENT_EMITTER $VERIFIER $YUSD_TOKEN $COLLATERAL_VAULT"

