require('dotenv').config();
const starknet = require('starknet');

const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';

// Pragma Asset IDs - Exact felt252 values
const PRAGMA_ASSET_IDS = {
    'BTC/USD': '0x4254432f555344',
};

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

async function debugMarketId() {
    console.log('🔍 Debugging Market ID Issue\n');
    console.log('=' .repeat(60));
    
    const expectedMarketId = PRAGMA_ASSET_IDS['BTC/USD'];
    console.log(`\n📋 Expected Market ID (from frontend):`);
    console.log(`   Hex: ${expectedMarketId}`);
    console.log(`   Decimal: ${BigInt(expectedMarketId).toString()}`);
    console.log(`   ASCII: ${Buffer.from(expectedMarketId.slice(2), 'hex').toString()}`);
    
    // Test different market_id formats
    const testMarketIds = [
        expectedMarketId,
        expectedMarketId.toLowerCase(),
        expectedMarketId.toUpperCase(),
        '0x' + expectedMarketId.slice(2).toLowerCase(),
        '0x' + expectedMarketId.slice(2).toUpperCase(),
        // Also test cairo.felt() conversion
        starknet.cairo.felt('BTC/USD'),
    ];
    
    console.log(`\n🧪 Testing different market_id formats:\n`);
    
    for (const marketId of testMarketIds) {
        try {
            const result = await provider.callContract({
                contractAddress: DATA_STORE_ADDRESS,
                entrypoint: 'get_market_config',
                calldata: [marketId],
            });
            
            const enabled = result[12] !== 0n;
            const maxLeverage = { low: result[0], high: result[1] };
            
            console.log(`   Market ID: ${marketId}`);
            console.log(`   ✅ Found config: Enabled=${enabled}, MaxLeverage=${maxLeverage.low}`);
            console.log(`   ${enabled ? '✅✅✅ MARKET ENABLED ✅✅✅' : '❌ Market disabled'}\n`);
            
            if (enabled) {
                console.log(`   🎯 THIS IS THE CORRECT MARKET ID FORMAT!`);
                console.log(`   Use this exact value in your frontend: ${marketId}\n`);
            }
        } catch (error) {
            console.log(`   Market ID: ${marketId}`);
            console.log(`   ❌ Error: ${error.message}\n`);
        }
    }
    
    // Also check what cairo.felt('BTC/USD') produces
    console.log(`\n📊 Cairo.felt() conversion:`);
    const cairoFelt = starknet.cairo.felt('BTC/USD');
    console.log(`   cairo.felt('BTC/USD') = ${cairoFelt}`);
    console.log(`   Matches expected: ${cairoFelt.toLowerCase() === expectedMarketId.toLowerCase()}`);
    
    // Check if there are any other market configs stored
    console.log(`\n🔍 Checking for other market configs...`);
    const otherMarketIds = [
        '0x4554482f555344', // ETH/USD
        '0x574254432f555344', // WBTC/USD
        cairoFelt,
    ];
    
    for (const marketId of otherMarketIds) {
        try {
            const result = await provider.callContract({
                contractAddress: DATA_STORE_ADDRESS,
                entrypoint: 'get_market_config',
                calldata: [marketId],
            });
            
            const enabled = result[12] !== 0n;
            if (enabled || result[0] !== 0n || result[2] !== 0n) {
                console.log(`   Found config for ${marketId}: Enabled=${enabled}`);
            }
        } catch (error) {
            // Ignore errors for non-existent markets
        }
    }
    
    console.log(`\n💡 Recommendations:`);
    console.log(`   1. Use the EXACT market_id format that returned enabled=true above`);
    console.log(`   2. Ensure your frontend uses this exact value (case-sensitive)`);
    console.log(`   3. Check browser console to verify the market_id being sent matches`);
    console.log(`   4. The market_id must be in public_inputs[0] of your proof`);
}

debugMarketId().catch(error => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
});

