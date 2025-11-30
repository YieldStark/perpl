#!/bin/bash

# Quick redeploy DataStore with role checks bypassed
cd quickstart/contracts

echo "📝 Declaring DataStore..."
sncast declare --contract-name DataStore

echo ""
echo "✅ Copy the class_hash above, then run:"
echo ""
echo "sncast deploy \\"
echo "  --class-hash <CLASS_HASH_FROM_ABOVE> \\"
echo "  --constructor-calldata 0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819"

