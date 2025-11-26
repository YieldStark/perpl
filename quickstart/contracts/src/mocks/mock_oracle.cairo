//! Mock Oracle contract for local testing (no external data dependency)
//!
//! This contract implements the same `IOracle` interface exposed by the production
//! Pragma-backed oracle, but stores prices that are manually pushed by an admin.
//! It allows us to exercise the rest of the perpetual stack on Ztarknet before
//! the official Pragma feed is available.

use private_perp::core::oracle::{IOracle, Price};

#[starknet::interface]
pub trait IMockOracleAdmin<TContractState> {
    /// Admin-only method used to push prices into the mock feed.
    fn set_price(
        ref self: TContractState,
        market_id: felt252,
        value: u128,
        decimals: u32,
        num_sources: u32,
    );
}

#[starknet::contract]
mod MockOracle {
    use private_perp::core::oracle::{IOracle, Price};
    use starknet::{ContractAddress, get_block_timestamp, get_caller_address};
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use super::IMockOracleAdmin;

    #[storage]
    struct Storage {
        admin: ContractAddress,
        market_to_asset: Map<felt252, felt252>,
        prices: Map<felt252, Price>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, admin: ContractAddress) {
        self.admin.write(admin);
    }

    #[generate_trait]
    impl MockOracleInternal of MockOracleInternalTrait {
        fn assert_admin(state: @ContractState) {
            let caller = get_caller_address();
            let admin = state.admin.read();
            assert(caller == admin, 'MOCK_ORACLE_NOT_ADMIN');
        }
    }

    #[external(v0)]
    impl MockOracleAdminImpl of super::IMockOracleAdmin<ContractState> {
        fn set_price(
            ref self: ContractState,
            market_id: felt252,
            value: u128,
            decimals: u32,
            num_sources: u32,
        ) {
            MockOracleInternalTrait::assert_admin(@self);

            let timestamp = get_block_timestamp();
            let price = Price { value, timestamp, decimals, num_sources };

            // Allow setting prices even for markets that have not been formally registered yet.
            self.prices.write(market_id, price);
        }
    }

    #[external(v0)]
    impl OracleCompatImpl of IOracle<ContractState> {
        fn get_price(self: @ContractState, market_id: felt252) -> Price {
            let price = self.prices.read(market_id);
            assert(price.timestamp != 0, 'MOCK_PRICE_NOT_SET');
            price
        }

        fn update_price_from_pragma(ref self: ContractState, market_id: felt252) {
            // In the mock implementation, prices are already written via `set_price`.
            // This function is preserved for compatibility with the production oracle.
            let price = self.prices.read(market_id);
            assert(price.timestamp != 0, 'MOCK_PRICE_NOT_SET');
        }

        fn register_market(ref self: ContractState, market_id: felt252, asset_id: felt252) {
            self.market_to_asset.write(market_id, asset_id);
        }

        fn get_twap(self: @ContractState, market_id: felt252, duration: u64, start_time: u64) -> (u128, u32) {
            let _ = duration;
            let _ = start_time;
            // Return the spot price as TWAP for mock purposes.
            let price = self.prices.read(market_id);
            assert(price.timestamp != 0, 'MOCK_PRICE_NOT_SET');

            (price.value, price.decimals)
        }
    }
}

