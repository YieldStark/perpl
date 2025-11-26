//! Pricing utilities

/// Calculate price impact
pub fn calculate_price_impact(pool_liquidity: u256, size: u256, impact_factor: u256) -> u256 {
    (size * impact_factor) / pool_liquidity
}

/// Calculate execution price
pub fn calculate_execution_price(oracle_price: u256, price_impact: u256, is_long: bool) -> u256 {
    if is_long {
        oracle_price + price_impact
    } else {
        oracle_price - price_impact
    }
}





