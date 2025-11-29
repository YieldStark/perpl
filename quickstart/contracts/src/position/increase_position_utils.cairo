//! Increase position utilities

use private_perp::position::position::Position;

/// Calculate position size from margin and leverage
pub fn calculate_position_size(margin: u256, leverage: u256) -> u256 {
    (margin * leverage) / 100
}

/// Calculate required margin for position size
pub fn calculate_required_margin(position_size: u256, leverage: u256) -> u256 {
    (position_size * 100) / leverage
}















