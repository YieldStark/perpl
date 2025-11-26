#!/bin/bash

echo "=== Verifying Tool Installation ==="
echo ""

# Check bb
echo "1. Checking bb..."
if command -v bb &> /dev/null; then
    BB_VERSION=$(bb --version 2>&1 | head -n 1)
    echo "   ✓ bb found: $BB_VERSION"
    echo "   Location: $(which bb)"
else
    echo "   ✗ bb not found in PATH"
    echo "   Expected location: /home/ahm/.bb/bb"
fi
echo ""

# Check nargo
echo "2. Checking nargo..."
if command -v nargo &> /dev/null; then
    NARGO_VERSION=$(nargo --version 2>&1 | head -n 1)
    echo "   ✓ nargo found: $NARGO_VERSION"
    echo "   Location: $(which nargo)"
else
    echo "   ✗ nargo not found in PATH"
    echo "   Expected location: /home/ahm/.nargo/bin/nargo"
fi
echo ""

# Check scarb
echo "3. Checking scarb..."
if command -v scarb &> /dev/null; then
    SCARB_VERSION=$(scarb --version 2>&1 | head -n 1)
    echo "   ✓ scarb found: $SCARB_VERSION"
    echo "   Location: $(which scarb)"
else
    echo "   ✗ scarb not found in PATH"
    echo "   You need to install scarb 2.12.1"
fi
echo ""

# Check PATH
echo "4. Checking PATH..."
if [[ ":$PATH:" == *":/home/ahm/.bb:"* ]]; then
    echo "   ✓ /home/ahm/.bb is in PATH"
else
    echo "   ✗ /home/ahm/.bb is NOT in PATH"
fi

if [[ ":$PATH:" == *":/home/ahm/.nargo/bin:"* ]]; then
    echo "   ✓ /home/ahm/.nargo/bin is in PATH"
else
    echo "   ✗ /home/ahm/.nargo/bin is NOT in PATH"
fi
echo ""

echo "=== Version Requirements ==="
echo "Required by garaga 0.18.1:"
echo "  - bb: 0.86.0-starknet.1"
echo "  - nargo: 1.0.0-beta.3"
echo "  - scarb: 2.12.1"
echo ""






