require('dotenv').config();
const starknet = require('starknet');

const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const MARKET_ID = 'BTC/USD';

// Pragma Asset IDs - Exact felt252 values
const PRAGMA_ASSET_IDS = {
    'BTC/USD': '0x4254432f555344', // Pragma asset ID: 18669995996566340
};

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

async function verifyMarket() {
    console.log('🔍 Verifying market is ready for trading\n');
    console.log(`   Market: ${MARKET_ID}`);
    console.log(`   Market ID (Pragma): ${PRAGMA_ASSET_IDS[MARKET_ID]}`);
    console.log(`   DataStore: ${DATA_STORE_ADDRESS}\n`);
    
    const marketIdFelt = PRAGMA_ASSET_IDS[MARKET_ID];
    
    try {
        const result = await provider.callContract({
            contractAddress: DATA_STORE_ADDRESS,
            entrypoint: 'get_market_config',
            calldata: [marketIdFelt],
        });
        
        // Parse all fields from result
        const maxLeverage = { low: result[0], high: result[1] };
        const minMarginRatio = { low: result[2], high: result[3] };
        const maxPositionSize = { low: result[4], high: result[5] };
        const priceImpactFactor = { low: result[6], high: result[7] };
        const tradingFeeBps = { low: result[8], high: result[9] };
        const liquidationFeeBps = { low: result[10], high: result[11] };
        const enabled = result[12] !== 0n;
        
        console.log('📊 Market Status:');
        console.log(`   Enabled: ${enabled ? '✅ YES' : '❌ NO'}`);
        console.log(`   Max Leverage: ${maxLeverage.low.toString()}x`);
        console.log(`   Min Margin Ratio: ${minMarginRatio.low.toString()}%`);
        console.log(`   Max Position Size: ${maxPositionSize.low.toString()}`);
        console.log(`   Price Impact Factor: ${priceImpactFactor.low.toString()}`);
        console.log(`   Trading Fee: ${tradingFeeBps.low.toString()} bps`);
        console.log(`   Liquidation Fee: ${liquidationFeeBps.low.toString()} bps`);
        console.log(`   Market ID Used: ${marketIdFelt}\n`);
        
        if (enabled) {
            console.log('✅ Market is ENABLED and ready for trading!');
            console.log('   You can now submit orders from your app.\n');
            console.log('💡 If you still get MARKET_DISABLED error:');
            console.log('   1. Make sure your frontend uses the exact market_id:');
            console.log(`      ${marketIdFelt}`);
            console.log('   2. Check browser console for the market_id being sent');
            console.log('   3. Verify it matches the Pragma asset ID above');
        } else {
            console.log('❌ Market is NOT enabled');
            console.log('   You need to enable it with an account that has ADMIN role');
        }
        
    } catch (error) {
        console.error('❌ Error checking market:', error.message);
    }
}

verifyMarket().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});

