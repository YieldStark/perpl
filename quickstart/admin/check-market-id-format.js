require('dotenv').config();
const starknet = require('starknet');

const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

// Test all possible market_id formats
const testFormats = [
    { name: 'Hex lowercase', value: '0x4254432f555344' },
    { name: 'Hex uppercase', value: '0X4254432F555344' },
    { name: 'Hex mixed case', value: '0x4254432F555344' },
    { name: 'Decimal string', value: '18669995996566340' },
    { name: 'Decimal BigInt', value: BigInt('18669995996566340') },
    { name: 'Cairo felt', value: starknet.cairo.felt('BTC/USD') },
    { name: 'String BTC/USD', value: 'BTC/USD' },
];

async function testMarketIdFormats() {
    console.log('🔍 Testing all market_id formats with DataStore\n');
    console.log('=' .repeat(70));
    
    for (const format of testFormats) {
        try {
            const result = await provider.callContract({
                contractAddress: DATA_STORE_ADDRESS,
                entrypoint: 'get_market_config',
                calldata: [format.value],
            });
            
            const enabled = result[12] !== 0n;
            const maxLeverage = result[0];
            
            console.log(`\n✅ ${format.name}: ${format.value}`);
            console.log(`   Enabled: ${enabled}`);
            console.log(`   Max Leverage: ${maxLeverage}`);
            
            if (enabled) {
                console.log(`   🎯 THIS FORMAT WORKS!`);
            }
        } catch (error) {
            console.log(`\n❌ ${format.name}: ${format.value}`);
            console.log(`   Error: ${error.message}`);
        }
    }
    
    console.log(`\n\n💡 Recommendation:`);
    console.log(`   Use the format that returned enabled=true above`);
    console.log(`   Make sure your frontend sends EXACTLY that format in public_inputs[0]`);
}

testMarketIdFormats().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});

