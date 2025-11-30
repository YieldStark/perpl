require('dotenv').config();
const starknet = require('starknet');

// Contract addresses
const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';

// Market ID (e.g., 'BTC/USD')
const MARKET_ID = process.env.MARKET_ID || 'BTC/USD';

// Pragma Asset IDs - Exact felt252 values used by the contract
// These match the values defined in contracts/src/core/oracle.cairo
// CRITICAL: Using exact values ensures market_id matches what's stored in DataStore
const PRAGMA_ASSET_IDS = {
    'BTC/USD': '0x4254432f555344', // Pragma asset ID: 18669995996566340 (ASCII "BTC/USD")
    'ETH/USD': '0x4554482f555344', // Pragma asset ID: 19514442401534788 (ASCII "ETH/USD")
    'WBTC/USD': '0x574254432f555344', // Pragma asset ID: 6287680677296296772
    'LORDS/USD': '0x4c4f5244532f555344', // Pragma asset ID: 1407668255603079598916
    'STRK/USD': '0x5354524b2f555344', // Pragma asset ID: 6004514686061859652
    'EKUBO/USD': '0x454b55424f2f555344', // Pragma asset ID: 1278253658919688033092
    'DOG/USD': '0x444f472f555344', // Pragma asset ID: 19227465571717956
};

// Default market config (from market_registry.cairo)
const DEFAULT_CONFIG = {
    max_leverage: { low: 20n, high: 0n }, // 20x leverage
    min_margin_ratio: { low: 5n, high: 0n }, // 5% minimum margin
    max_position_size: { low: 1000000000000000000000000n, high: 0n }, // 1M yUSD max
    price_impact_factor: { low: 1000n, high: 0n },
    trading_fee_bps: { low: 10n, high: 0n }, // 0.1% trading fee
    liquidation_fee_bps: { low: 50n, high: 0n }, // 0.5% liquidation fee
    enabled: true,
};

const provider = new starknet.RpcProvider({
    nodeUrl: RPC_URL,
});

const account = new starknet.Account({
    provider,
    address: process.env.ADMIN_ADDRESS,
    signer: process.env.ADMIN_KEY,
    cairoVersion: '1',
    transactionVersion: '0x3',
    defaultTipType: 'recommendedTip',
});

// DataStore ABI (minimal - just what we need)
const DATA_STORE_ABI = [
    {
        type: 'function',
        name: 'get_market_config',
        inputs: [{ name: 'market_id', type: 'felt252' }],
        outputs: [
            { name: 'max_leverage', type: 'u256' },
            { name: 'min_margin_ratio', type: 'u256' },
            { name: 'max_position_size', type: 'u256' },
            { name: 'price_impact_factor', type: 'u256' },
            { name: 'trading_fee_bps', type: 'u256' },
            { name: 'liquidation_fee_bps', type: 'u256' },
            { name: 'enabled', type: 'bool' },
        ],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'set_market_config',
        inputs: [
            { name: 'market_id', type: 'felt252' },
            { name: 'max_leverage', type: 'u256' },
            { name: 'min_margin_ratio', type: 'u256' },
            { name: 'max_position_size', type: 'u256' },
            { name: 'price_impact_factor', type: 'u256' },
            { name: 'trading_fee_bps', type: 'u256' },
            { name: 'liquidation_fee_bps', type: 'u256' },
            { name: 'enabled', type: 'bool' },
        ],
        outputs: [],
        state_mutability: 'external',
    },
];

async function enableMarket() {
    console.log('🔧 Enabling market:', MARKET_ID);
    console.log('📋 DataStore address:', DATA_STORE_ADDRESS);
    console.log('👤 Admin address:', account.address);

    const contract = new starknet.Contract({
        abi: DATA_STORE_ABI,
        address: DATA_STORE_ADDRESS,
        providerOrAccount: provider,
    });

    try {
        // Try to get current market config
        console.log('\n📖 Fetching current market config...');
        let currentConfig;
        try {
            // Use callContract directly for view functions
            // Use exact Pragma asset ID if available - this matches contract expectations
            const marketIdFelt = PRAGMA_ASSET_IDS[MARKET_ID] || starknet.cairo.felt(MARKET_ID);
            const result = await provider.callContract({
                contractAddress: DATA_STORE_ADDRESS,
                entrypoint: 'get_market_config',
                calldata: [marketIdFelt],
            });
            
            // Parse the result - u256 values are returned as [low, high] pairs
            currentConfig = {
                max_leverage: {
                    low: BigInt(result[0]),
                    high: BigInt(result[1]),
                },
                min_margin_ratio: {
                    low: BigInt(result[2]),
                    high: BigInt(result[3]),
                },
                max_position_size: {
                    low: BigInt(result[4]),
                    high: BigInt(result[5]),
                },
                price_impact_factor: {
                    low: BigInt(result[6]),
                    high: BigInt(result[7]),
                },
                trading_fee_bps: {
                    low: BigInt(result[8]),
                    high: BigInt(result[9]),
                },
                liquidation_fee_bps: {
                    low: BigInt(result[10]),
                    high: BigInt(result[11]),
                },
                enabled: result[12] !== 0n, // bool is returned as felt252 (0 or 1)
            };
            console.log('✅ Current config found:');
            console.log('   Enabled:', currentConfig.enabled);
            console.log('   Max leverage:', currentConfig.max_leverage.low.toString());
            console.log('   Min margin ratio:', currentConfig.min_margin_ratio.low.toString());
            console.log('   Max position size:', currentConfig.max_position_size.low.toString());
            
            // Check if config has zero values (uninitialized)
            const isUninitialized = 
                currentConfig.max_leverage.low === 0n &&
                currentConfig.min_margin_ratio.low === 0n &&
                currentConfig.max_position_size.low === 0n;
            
            if (isUninitialized) {
                console.log('⚠️  Market config appears uninitialized (all zeros)');
                console.log('   Will use default values');
                currentConfig = null; // Use defaults
            }
        } catch (error) {
            console.log('⚠️  Market config not found, will use default config');
            console.log('   Error:', error.message);
            currentConfig = null;
        }

        // Prepare config - use current if exists and valid, otherwise use default
        // Normalize u256 values to {low, high} format if needed
        const normalizeU256 = (val) => {
            if (typeof val === 'object' && 'low' in val && 'high' in val) {
                return val;
            }
            if (typeof val === 'bigint' || typeof val === 'number') {
                return { low: BigInt(val), high: 0n };
            }
            return val;
        };
        
        // Use default config if current is null or uninitialized
        const config = currentConfig || DEFAULT_CONFIG;
        
        // Ensure enabled is true and use defaults if values are zero
        const updatedConfig = {
            max_leverage: normalizeU256(config.max_leverage),
            min_margin_ratio: normalizeU256(config.min_margin_ratio),
            max_position_size: normalizeU256(config.max_position_size),
            price_impact_factor: normalizeU256(config.price_impact_factor),
            trading_fee_bps: normalizeU256(config.trading_fee_bps),
            liquidation_fee_bps: normalizeU256(config.liquidation_fee_bps),
            enabled: true, // Always set to true
        };

        console.log('\n📝 Updating market config with enabled=true...');
        console.log('   Max leverage:', updatedConfig.max_leverage.low?.toString() || updatedConfig.max_leverage);
        console.log('   Min margin ratio:', updatedConfig.min_margin_ratio.low?.toString() || updatedConfig.min_margin_ratio);
        console.log('   Max position size:', updatedConfig.max_position_size.low?.toString() || updatedConfig.max_position_size);
        console.log('   Price impact factor:', updatedConfig.price_impact_factor.low?.toString() || updatedConfig.price_impact_factor);
        console.log('   Trading fee (bps):', updatedConfig.trading_fee_bps.low?.toString() || updatedConfig.trading_fee_bps);
        console.log('   Liquidation fee (bps):', updatedConfig.liquidation_fee_bps.low?.toString() || updatedConfig.liquidation_fee_bps);
        console.log('   Enabled:', updatedConfig.enabled);

        // Convert market_id string to felt252
        // Use exact Pragma asset ID if available - this matches contract expectations
        const marketIdFelt = PRAGMA_ASSET_IDS[MARKET_ID] || starknet.cairo.felt(MARKET_ID);

        // Note: We don't need to get nonce manually - account.execute() will handle it
        // But we can log it for debugging
        try {
            const nonce = await provider.getNonceForAddress(
                account.address,
                'latest'
            );
            console.log('   Current nonce:', nonce.toString());
        } catch (error) {
            // Nonce fetch failed - account.execute will handle it or error appropriately
            console.log('   Note: Could not fetch nonce (account may not be deployed)');
        }

        // Build calldata array for set_market_config
        // Format: [market_id, max_leverage.low, max_leverage.high, min_margin_ratio.low, min_margin_ratio.high, ...]
        const calldata = [
            marketIdFelt,
            updatedConfig.max_leverage.low,
            updatedConfig.max_leverage.high,
            updatedConfig.min_margin_ratio.low,
            updatedConfig.min_margin_ratio.high,
            updatedConfig.max_position_size.low,
            updatedConfig.max_position_size.high,
            updatedConfig.price_impact_factor.low,
            updatedConfig.price_impact_factor.high,
            updatedConfig.trading_fee_bps.low,
            updatedConfig.trading_fee_bps.high,
            updatedConfig.liquidation_fee_bps.low,
            updatedConfig.liquidation_fee_bps.high,
            updatedConfig.enabled ? 1n : 0n, // bool as felt252
        ];

        const call = {
            contractAddress: DATA_STORE_ADDRESS,
            entrypoint: 'set_market_config',
            calldata: calldata,
        };

        console.log('\n📤 Submitting transaction...');
        
        let tx_result;
        try {
            // Try to execute - account.execute will handle nonce automatically if not provided
            tx_result = await account.execute(call, {
                blockIdentifier: 'latest',
                tip: 1000n,
                // Don't pass nonce - let account.execute handle it
            });
        } catch (error) {
            if (error.message && (error.message.includes('Contract not found') || error.message.includes('not found'))) {
                console.error('\n❌ Account contract not deployed!');
                console.error('\n📋 To deploy your account:');
                console.error('   1. Make sure you have funds in your account address');
                console.error('   2. Deploy the account using sncast or Starknet.js');
                console.error('   3. Example with sncast:');
                console.error(`      sncast account deploy --name admin --url ${RPC_URL}`);
                console.error('\n   Or if using Starknet.js, you need to deploy the account contract first.');
                throw new Error('Account contract not deployed. Please deploy your account before running this script.');
            }
            throw error;
        }

        console.log('✅ Transaction submitted:', tx_result.transaction_hash);
        console.log('⏳ Waiting for confirmation...');

        const receipt = await provider.waitForTransaction(
            tx_result.transaction_hash,
            {
                retryInterval: 1000,
            }
        );

        console.log('\n✅ Transaction confirmed!');
        console.log('   Transaction hash:', receipt.transaction_hash);
        console.log('   Status:', receipt.status);
        console.log('\n🎉 Market', MARKET_ID, 'is now enabled!');
    } catch (error) {
        console.error('\n❌ Error enabling market:', error);
        if (error.message) {
            console.error('   Message:', error.message);
        }
        if (error.response) {
            console.error('   Response:', JSON.stringify(error.response, null, 2));
        }
        process.exit(1);
    }
}

// Run the script
enableMarket();

