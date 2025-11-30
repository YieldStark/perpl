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

const provider = new starknet.RpcProvider({
    nodeUrl: RPC_URL,
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
];

async function checkMarket() {
    console.log('🔍 Checking market status:', MARKET_ID);
    console.log('📋 DataStore address:', DATA_STORE_ADDRESS);

    const contract = new starknet.Contract({
        abi: DATA_STORE_ABI,
        address: DATA_STORE_ADDRESS,
        providerOrAccount: provider,
    });

    try {
        // Convert market_id string to felt252
        // Use exact Pragma asset ID if available - this matches contract expectations
        // This is CRITICAL for avoiding MARKET_DISABLED errors
        const marketIdFelt = PRAGMA_ASSET_IDS[MARKET_ID] || starknet.cairo.felt(MARKET_ID);
        
        // Use callContract directly for view functions
        const result = await provider.callContract({
            contractAddress: DATA_STORE_ADDRESS,
            entrypoint: 'get_market_config',
            calldata: [marketIdFelt],
        });
        
        // Parse the result - u256 values are returned as [low, high] pairs
        const parsedResult = {
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

        console.log('\n📊 Market Config:');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('   Market ID:     ', MARKET_ID);
        console.log('   Enabled:       ', parsedResult.enabled ? '✅ YES' : '❌ NO');
        console.log('   Max Leverage:  ', parsedResult.max_leverage.low.toString(), 'x');
        console.log('   Min Margin:   ', parsedResult.min_margin_ratio.low.toString(), '%');
        console.log('   Max Position: ', parsedResult.max_position_size.low.toString());
        console.log('   Trading Fee:   ', parsedResult.trading_fee_bps.low.toString(), 'bps');
        console.log('   Liq Fee:      ', parsedResult.liquidation_fee_bps.low.toString(), 'bps');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        if (parsedResult.enabled) {
            console.log('\n✅ Market is ENABLED - orders can be submitted');
        } else {
            console.log('\n❌ Market is DISABLED - orders will be rejected');
            console.log('   Run: npm run enable-market');
        }
    } catch (error) {
        console.error('\n❌ Error checking market:', error.message);
        if (error.message.includes('not found') || error.message.includes('does not exist')) {
            console.log('\n⚠️  Market config does not exist');
            console.log('   Run: npm run enable-market to create and enable it');
        }
        process.exit(1);
    }
}

// Run the script
checkMarket();

