# Prover.toml Input Guide

## Why All Parameters Are Required

The `main()` function in `src/main.nr` declares **all possible parameters** upfront, even though different actions use different subsets:

- **Action 0 (open_market)**: Uses `price_impact`, `execution_price`, `acceptable_slippage`, `leverage`, `min_margin_ratio`, `max_position_size`
- **Action 1 (open_limit)**: Same as action 0, plus `trigger_price`
- **Action 2 (open_twap)**: Uses TWAP-specific parameters: `twap_price`, `twap_duration`, `chunk_index`, `total_chunks`
- **Action 3 (close)**: Uses `current_price`, `closing_size`, `trading_fee_bps`
- **Action 4 (close_tp)**: Same as action 3, plus `take_profit_price`
- **Action 5 (close_sl)**: Same as action 3, plus `stop_loss_price`
- **Action 6 (liquidation)**: Uses `current_price`, `min_margin_ratio`

## Setting Unused Parameters

For parameters not used by your chosen action, set them to `"0"`. Noir will still require them in the input file, but they won't affect the circuit execution for that specific action.

## Example: Open Market Order

```toml
action = "0"  # Market order
private_margin = "100"
private_position_size = "1000"
# ... other required fields
price_impact = "50"
execution_price = "50050"
# Unused for market orders, but still required:
trigger_price = "0"
twap_price = "0"
take_profit_price = "0"
# etc.
```

## Example: Close Position

```toml
action = "3"  # Close position
private_margin = "100"
private_position_size = "1000"
private_entry_price = "50000"
current_price = "51000"
closing_size = "1000"
trading_fee_bps = "10"
# Unused for close, but still required:
price_impact = "0"
leverage = "0"
trigger_price = "0"
# etc.
```

## Running the Circuit

```bash
# Execute with witness generation
nargo execute witness

# Generate proof
nargo prove

# Verify proof
nargo verify
```








