# Lower-Level RPC Approach for Calldata Control

## Overview

This document explains how to use lower-level RPC methods to send transactions with complete control over calldata formatting, bypassing `account.execute()`.

## Current Status

✅ **The hex prefix issue appears to be RESOLVED!** 

The latest error you're seeing is `MARKET_DISABLED`, which means:
- The RPC is accepting your calldata ✅
- All hex strings have the `0x` prefix ✅
- The transaction is being processed ✅
- The contract is rejecting it due to market status (different issue)

## Two Approaches Available

### Option 1: High-Level (`account.execute`) - CURRENT

**Location**: `usePerpRouter.ts` lines ~708 and ~1505

```typescript
const result = await ztarknetAccount.execute({
  contractAddress: CONTRACTS.PERP_ROUTER,
  entrypoint: 'open_position',
  calldata: protectedCalldata,
});
```

**Pros:**
- Simple and clean
- Handles fee estimation automatically
- Manages nonce automatically
- Signs transaction automatically

**Cons:**
- Less control over transaction structure
- Calldata goes through Starknet.js internal processing

### Option 2: Lower-Level RPC (Commented Out)

**Location**: `usePerpRouter.ts` lines ~714-780 (commented block)

This approach:
1. Creates `RpcProvider` directly
2. Gets nonce manually
3. Constructs transaction object manually
4. Estimates fee manually
5. Signs transaction manually
6. Sends via `provider.addInvokeTransaction()`

**To Enable:**
1. Uncomment the Option 2 block
2. Comment out Option 1
3. Uncomment the imports at the top:
   ```typescript
   import { RpcProvider, hash } from 'starknet';
   import { NETWORK } from '../config/contracts';
   ```

**Pros:**
- Complete control over calldata format
- Direct access to RPC layer
- Can inspect/modify transaction before sending
- No intermediate transformations

**Cons:**
- More code to maintain
- Manual fee estimation
- Manual nonce management
- More error-prone

## Key Differences

| Feature | Option 1 (account.execute) | Option 2 (Direct RPC) |
|---------|---------------------------|----------------------|
| Calldata Control | Limited | Full |
| Fee Estimation | Automatic | Manual |
| Nonce Management | Automatic | Manual |
| Transaction Signing | Automatic | Manual |
| Code Complexity | Low | High |
| Debugging | Harder | Easier |

## When to Use Each

**Use Option 1 (current)** when:
- ✅ Current implementation is working
- ✅ You trust Starknet.js to handle calldata correctly
- ✅ You want simpler code

**Use Option 2 (lower-level)** when:
- ⚠️ You need absolute control over calldata format
- ⚠️ You're debugging calldata serialization issues
- ⚠️ You want to inspect the exact RPC request being sent

## Current Recommendation

**Stick with Option 1** - The hex prefix issue is resolved. The `MARKET_DISABLED` error is a contract-level issue, not a calldata formatting issue.

If you want to try Option 2 for debugging purposes, uncomment the code block and test it. The lower-level approach will give you complete visibility into what's being sent to the RPC.

## RPC Method Reference

The lower-level approach uses these Starknet.js methods:

1. **`provider.getNonceForAddress()`** - Get account nonce
2. **`provider.estimateFee()`** - Estimate transaction fee
3. **`hash.calculateInvokeTransactionHash()`** - Calculate transaction hash
4. **`account.signer.signTransaction()`** - Sign transaction
5. **`provider.addInvokeTransaction()`** - Submit transaction

## Transaction Structure

The manual transaction object includes:
- `type`: 'INVOKE'
- `sender_address`: Account address
- `calldata`: Your calldata array (full control here!)
- `signature`: Transaction signature
- `nonce`: Account nonce
- `version`: Transaction version (v3)
- `resource_bounds`: Gas limits
- `tip`: Tip amount
- `paymaster_data`: Paymaster data (if any)
- `nonce_data_availability_mode`: 'L1' or 'L2'
- `fee_data_availability_mode`: 'L1' or 'L2'
- `account_deployment_data`: Account deployment data (if any)

## Next Steps

1. **Current Issue**: `MARKET_DISABLED` - This is a contract state issue, not calldata
2. **If you want to try lower-level**: Uncomment Option 2 and test
3. **If calldata issues return**: Option 2 gives you full control to debug

