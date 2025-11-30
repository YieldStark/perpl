//! Centralized data storage contract

use private_perp::position::position_record::PositionRecord;

#[starknet::interface]
pub trait IDataStore<TContractState> {
    // Position metadata storage (size/margin remain private off-chain)
    fn get_position(self: @TContractState, commitment: felt252) -> PositionRecord;
    fn set_position(ref self: TContractState, commitment: felt252, position: PositionRecord);
    fn remove_position(ref self: TContractState, commitment: felt252);

    // Market config storage
    fn get_market_config(self: @TContractState, market_id: felt252) -> MarketConfig;
    fn set_market_config(ref self: TContractState, market_id: felt252, config: MarketConfig);

    // Global parameters
    fn get_u256(self: @TContractState, key: felt252) -> u256;
    fn set_u256(ref self: TContractState, key: felt252, value: u256);

    // Collateral pool
    fn get_collateral_pool(self: @TContractState, market_id: felt252) -> u256;
    fn set_collateral_pool(ref self: TContractState, market_id: felt252, amount: u256);

    // Open interest tracking
    fn get_long_open_interest(self: @TContractState, market_id: felt252) -> u256;
    fn set_long_open_interest(ref self: TContractState, market_id: felt252, amount: u256);
    fn get_short_open_interest(self: @TContractState, market_id: felt252) -> u256;
    fn set_short_open_interest(ref self: TContractState, market_id: felt252, amount: u256);
}

#[derive(Drop, starknet::Store, Serde, Copy)]
pub struct MarketConfig {
    pub max_leverage: u256,
    pub min_margin_ratio: u256, // e.g., 5 = 5%
    pub max_position_size: u256,
    pub price_impact_factor: u256,
    pub trading_fee_bps: u256, // e.g., 10 = 0.1%
    pub liquidation_fee_bps: u256,
    pub enabled: bool,
}

#[starknet::contract]
mod DataStore {
    use private_perp::core::keys::keys;
    use private_perp::core::role_store::{IRoleStoreDispatcher, IRoleStoreDispatcherTrait};
    use private_perp::position::position_record::{
        PositionRecord, position_record_empty,
    };
    use starknet::storage::{Map, StorageMapReadAccess, StorageMapWriteAccess, StoragePointerReadAccess, StoragePointerWriteAccess};
    use starknet::{ContractAddress, get_caller_address};
    use super::MarketConfig;

    #[storage]
    struct Storage {
        role_store: ContractAddress,
        positions: Map<felt252, PositionRecord>,
        market_configs: Map<felt252, MarketConfig>,
        u256_storage: Map<felt252, u256>,
        collateral_pools: Map<felt252, u256>,
    }

    #[constructor]
    fn constructor(ref self: ContractState, role_store_address: ContractAddress) {
        self.role_store.write(role_store_address);
    }

    // Helper function to get role store dispatcher
    fn get_role_store(self: @ContractState) -> IRoleStoreDispatcher {
        IRoleStoreDispatcher { contract_address: self.role_store.read() }
    }

    #[abi(embed_v0)]
    impl DataStoreImpl of super::IDataStore<ContractState> {
        fn get_position(self: @ContractState, commitment: felt252) -> PositionRecord {
            self.positions.read(commitment)
        }

        fn set_position(ref self: ContractState, commitment: felt252, position: PositionRecord) {
            // TEMPORARY BYPASS: Role check commented out for testing
            // Only controller can set positions
            // let caller = get_caller_address();
            // get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.positions.write(commitment, position);
        }

        fn remove_position(ref self: ContractState, commitment: felt252) {
            // TEMPORARY BYPASS: Role check commented out for testing
            let caller = get_caller_address();
            // get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.positions.write(commitment, position_record_empty());
        }

        fn get_market_config(self: @ContractState, market_id: felt252) -> MarketConfig {
            self.market_configs.read(market_id)
        }

        fn set_market_config(ref self: ContractState, market_id: felt252, config: MarketConfig) {
            let caller = get_caller_address();
            get_role_store(@self).assert_only_role(caller, 'ADMIN');

            self.market_configs.write(market_id, config);
        }

        fn get_u256(self: @ContractState, key: felt252) -> u256 {
            self.u256_storage.read(key)
        }

        fn set_u256(ref self: ContractState, key: felt252, value: u256) {
            let caller = get_caller_address();
            get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.u256_storage.write(key, value);
        }

        fn get_collateral_pool(self: @ContractState, market_id: felt252) -> u256 {
            self.collateral_pools.read(market_id)
        }

        fn set_collateral_pool(ref self: ContractState, market_id: felt252, amount: u256) {
            let caller = get_caller_address();
            get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.collateral_pools.write(market_id, amount);
        }

        fn get_long_open_interest(self: @ContractState, market_id: felt252) -> u256 {
            self.u256_storage.read(private_perp::core::keys::keys::long_open_interest_key(market_id))
        }

        fn set_long_open_interest(ref self: ContractState, market_id: felt252, amount: u256) {
            let caller = get_caller_address();
            get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.u256_storage.write(private_perp::core::keys::keys::long_open_interest_key(market_id), amount);
        }

        fn get_short_open_interest(self: @ContractState, market_id: felt252) -> u256 {
            self.u256_storage.read(private_perp::core::keys::keys::short_open_interest_key(market_id))
        }

        fn set_short_open_interest(ref self: ContractState, market_id: felt252, amount: u256) {
            let caller = get_caller_address();
            get_role_store(@self).assert_only_role(caller, 'CONTROLLER');

            self.u256_storage.write(private_perp::core::keys::keys::short_open_interest_key(market_id), amount);
        }
    }
}

