# Private Perp DEX Contracts

## Structure

### Core Contracts (Deployed)
- `core/role_store.cairo` - Access control
- `core/event_emitter.cairo` - Event emission
- `core/data_store.cairo` - Centralized storage
- `core/oracle.cairo` - Pragma Oracle integration

### Handler Contracts (Deployed)
- `handlers/position_handler.cairo` - Open/close positions
- `handlers/order_handler.cairo` - Market/limit orders
- `handlers/liquidation_handler.cairo` - Liquidations
- `handlers/fee_handler.cairo` - Fee collection

### Router (Deployed)
- `router/perp_router.cairo` - Main entry point

### Library Modules (Not Deployed)
- `position/` - Position logic utilities
- `order/` - Order logic utilities
- `fee/` - Fee calculation utilities
- `liquidation/` - Liquidation logic utilities
- `pricing/` - Pricing and PnL utilities
- `utils/` - General utilities

## Deployment Order

1. RoleStore
2. EventEmitter
3. DataStore
4. Oracle
5. Verifier (from Garaga)
6. PositionHandler
7. OrderHandler
8. LiquidationHandler
9. FeeHandler
10. PerpRouter

## TODO

- [ ] Add proper ERC20 dispatcher implementation
- [ ] Add proper Verifier dispatcher implementation
- [ ] Complete ZK proof verification integration
- [ ] Add comprehensive error handling
- [ ] Add tests








