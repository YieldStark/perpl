require('dotenv').config();
const starknet = require('starknet');

const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const MARKET_ID = 'BTC/USD';

// Pragma Asset IDs
const PRAGMA_ASSET_IDS = {
    'BTC/USD': '0x4254432f555344',
};

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

// Calculate storage slot for market_config
// In Cairo, Map storage uses: pedersen(domain_separator, key)
// For DataStore, market_configs is a Map<felt252, MarketConfig>
// domain_separator for market_configs map needs to be calculated
async function checkMarketStorage() {
    console.log('🔍 Checking market config storage directly\n');
    console.log(`   Market: ${MARKET_ID}`);
    console.log(`   Market ID: ${PRAGMA_ASSET_IDS[MARKET_ID]}`);
    console.log(`   DataStore: ${DATA_STORE_ADDRESS}\n`);

    const marketIdFelt = PRAGMA_ASSET_IDS[MARKET_ID];
    
    try {
        // First, check via the contract function
        console.log('📋 Checking via get_market_config()...');
        const result = await provider.callContract({
            contractAddress: DATA_STORE_ADDRESS,
            entrypoint: 'get_market_config',
            calldata: [marketIdFelt],
        });
        
        const enabled = result[12] !== 0n;
        console.log(`   Enabled (from contract): ${enabled ? '✅ YES' : '❌ NO'}`);
        console.log(`   Max Leverage: ${result[0]}`);
        console.log(`   Min Margin: ${result[2]}`);
        console.log(`   All values:`, result.map((v, i) => `[${i}]=${v.toString()}`).join(', '));
        
        // Check if it's all zeros (uninitialized)
        const allZeros = result.slice(0, 12).every(v => v === 0n) && result[12] === 0n;
        if (allZeros) {
            console.log('\n⚠️  WARNING: Market config appears to be all zeros (uninitialized)!');
            console.log('   Even though enabled might show as true, the config is not properly set.');
            console.log('   This could cause MARKET_DISABLED errors.');
        } else if (result[12] === 0n) {
            console.log('\n❌ Market is DISABLED (enabled = 0)');
        } else {
            console.log('\n✅ Market config exists and enabled = true');
        }
        
        // Try with different market_id formats to see if there's a mismatch
        console.log('\n🔍 Testing different market_id formats...');
        const testIds = [
            { name: 'Pragma Asset ID', value: '0x4254432f555344' },
            { name: 'String "BTC/USD"', value: starknet.cairo.felt('BTC/USD') },
            { name: 'Numeric 18669995996566340', value: '0x4254432f555344' }, // Same as Pragma
        ];
        
        for (const test of testIds) {
            try {
                const testResult = await provider.callContract({
                    contractAddress: DATA_STORE_ADDRESS,
                    entrypoint: 'get_market_config',
                    calldata: [test.value],
                });
                const testEnabled = testResult[12] !== 0n;
                console.log(`   ${test.name}: enabled=${testEnabled}, max_leverage=${testResult[0]}`);
            } catch (error) {
                console.log(`   ${test.name}: Error - ${error.message.substring(0, 50)}...`);
            }
        }
        
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
}

checkMarketStorage().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});



