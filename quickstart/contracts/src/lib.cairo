//! Private Perp DEX - Module Declarations

// Core infrastructure contracts (deployed)
pub mod core {
    pub mod data_store;
    pub mod event_emitter;
    pub mod keys;
    pub mod market_registry;
    pub mod oracle;
    pub mod role_store;
    pub mod verifier;
}

// Mock contracts for local testing
pub mod mocks {
    pub mod mock_oracle;
}

// Position logic (libraries)
pub mod position {
    pub mod decrease_position_utils;
    pub mod error;
    pub mod increase_position_utils;
    pub mod position;
    pub mod position_record;
    pub mod position_utils;
}

// Order logic (libraries)
pub mod order {
    pub mod base_order_utils;
    pub mod error;
    pub mod order;
    pub mod order_record;
    pub mod order_utils;
    pub mod twap_order;
    pub mod twap_order_record;
}

// Fee logic (libraries)
pub mod fee {
    pub mod error;
    pub mod fee_utils;
}

// Liquidation logic (libraries)
pub mod liquidation {
    pub mod error;
    pub mod liquidation_utils;
}

// Pricing logic (libraries)
pub mod pricing {
    pub mod error;
    pub mod pnl_utils;
    pub mod pricing_utils;
}

// Handler contracts (deployed)
pub mod handlers {
    pub mod fee_handler;
    pub mod liquidation_handler;
    pub mod order_handler;
    pub mod position_handler;
}

// Market & Risk Management contracts (deployed)
pub mod market {
    pub mod funding;
}

pub mod risk {
    pub mod risk_manager;
}

// Vault contracts (deployed)
pub mod vault {
    pub mod collateral_vault;
}

// Router (deployed)
pub mod router {
    pub mod perp_router;
}

// Utilities (libraries)
pub mod utils {
    pub mod calc;
    pub mod i256;
    pub mod precision;
}

