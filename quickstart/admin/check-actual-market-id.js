require('dotenv').config();
const starknet = require('starknet');

const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const POSITION_HANDLER = '0x034fefb6137bc137491b2226a362d67a1485496e02e9b261b273f39d7b97aebd';

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

// Test different market_id formats that might be sent
const testMarketIds = [
    '0x4254432f555344',           // Expected hex format
    '0x4254432f555344'.toLowerCase(), // Lowercase
    '0x4254432f555344'.toUpperCase(), // Uppercase
    starknet.cairo.felt('BTC/USD'),   // Cairo felt conversion
    '18669995996566340',              // Decimal format
    BigInt('0x4254432f555344').toString(), // BigInt to string
];

async function checkMarketId() {
    console.log('🔍 Checking which market_id format works with DataStore\n');
    console.log('=' .repeat(70));
    
    for (const marketId of testMarketIds) {
        const marketIdStr = String(marketId);
        console.log(`\n📋 Testing market_id: ${marketIdStr}`);
        console.log(`   Type: ${typeof marketId}`);
        
        try {
            // Try to get market config
            const result = await provider.callContract({
                contractAddress: DATA_STORE_ADDRESS,
                entrypoint: 'get_market_config',
                calldata: [marketIdStr],
            });
            
            const enabled = result[12] !== 0n;
            const maxLeverage = { low: result[0], high: result[1] };
            const minMarginRatio = { low: result[2], high: result[3] };
            
            console.log(`   ✅ SUCCESS - Market config found:`);
            console.log(`      Enabled: ${enabled}`);
            console.log(`      Max Leverage: ${maxLeverage.low}`);
            console.log(`      Min Margin Ratio: ${minMarginRatio.low}`);
            
            if (enabled) {
                console.log(`   🎯 THIS FORMAT WORKS AND MARKET IS ENABLED!`);
            } else {
                console.log(`   ⚠️  Market config found but DISABLED`);
            }
        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}`);
        }
    }
    
    // Also test what happens if we pass the market_id through the position handler
    console.log(`\n\n🔍 Testing market_id extraction in PositionHandler\n`);
    console.log('=' .repeat(70));
    
    // The position handler expects public_inputs as [market_id, commitment]
    // Let's simulate what the contract would receive
    const testPublicInputs = [
        '0x4254432f555344',  // market_id
        '0x1234567890abcdef', // dummy commitment
    ];
    
    console.log(`Test public_inputs:`, testPublicInputs);
    console.log(`\n💡 The contract extracts market_id from public_inputs[0]`);
    console.log(`   Make sure your frontend sends: public_inputs[0] = '0x4254432f555344'`);
    console.log(`   (or the exact format that worked above)`);
}

checkMarketId().catch(error => {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
    process.exit(1);
});

