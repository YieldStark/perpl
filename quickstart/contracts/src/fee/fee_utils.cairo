//! Fee calculation utilities

/// Calculate trading fee
pub fn calculate_trading_fee(size: u256, fee_bps: u256) -> u256 {
    (size * fee_bps) / 10000
}

/// Calculate liquidation fee
pub fn calculate_liquidation_fee(position_size: u256, liquidation_fee_bps: u256) -> u256 {
    (position_size * liquidation_fee_bps) / 10000
}

/// Calculate liquidator reward (50% of liquidation fee)
pub fn calculate_liquidation_reward(liquidation_fee: u256) -> u256 {
    liquidation_fee / 2
}





