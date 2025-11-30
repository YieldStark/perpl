//! Base order utilities

use private_perp::order::order::Order;

/// Generate order commitment
pub fn generate_order_commitment(order: Order) -> felt252 {
    // Simplified - use poseidon hash in production
    order.commitment
}





















