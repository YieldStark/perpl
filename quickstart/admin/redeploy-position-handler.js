require('dotenv').config();
const starknet = require('starknet');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';

// Existing deployed addresses
const DATA_STORE_ADDRESS = '0x0545ac402d68976d8ca93d145a20e159063a8ccdf6590717eaa243f6ddf63d0e';
const EVENT_EMITTER_ADDRESS = '0x0056920a7aa0ed0516f33abade0b0ff4f5305a20cabd0117f49477eeb3be7e02';
const VERIFIER_ADDRESS = '0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d';
const YUSD_TOKEN_ADDRESS = '0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda';
const COLLATERAL_VAULT_ADDRESS = '0x07a05cd688bb3c68d25a49c4882ecfdb3a2836f827fe0367592b994d12c2f13d';

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

async function getAccount() {
    let accountAddress = process.env.ADMIN_ADDRESS || process.env.ACCOUNT_ADDRESS;
    let accountKey = process.env.ADMIN_KEY || process.env.ACCOUNT_KEY;
    
    if (!accountAddress || !accountKey) {
        console.log('❌ Missing account credentials');
        console.log('   Set ADMIN_ADDRESS and ADMIN_KEY in .env');
        process.exit(1);
    }
    
    return new starknet.Account(provider, accountAddress, accountKey);
}

function getContractFiles(contractName) {
    const contractsDir = path.join(__dirname, '../contracts');
    const targetDir = path.join(contractsDir, 'target/dev');
    
    const sierraPath = path.join(targetDir, `${contractName}.contract_class.json`);
    const casmPath = path.join(targetDir, `${contractName}.compiled_contract_class.json`);
    
    if (!fs.existsSync(sierraPath)) {
        throw new Error(`❌ Contract not compiled: ${contractName}\n   Run: cd quickstart/contracts && scarb build`);
    }
    
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = fs.existsSync(casmPath) ? JSON.parse(fs.readFileSync(casmPath, 'utf8')) : null;
    
    return { sierra, casm };
}

async function declareContract(contractName, account) {
    console.log(`\n📝 Declaring ${contractName}...`);
    
    const { sierra, casm } = getContractFiles(contractName);
    
    try {
        const declareResponse = await account.declare({
            contract: sierra,
            casm: casm,
        });
        
        console.log(`   ⏳ Waiting for declaration...`);
        await provider.waitForTransaction(declareResponse.transaction_hash);
        console.log(`✅ ${contractName} declared`);
        console.log(`   Class Hash: ${declareResponse.class_hash}`);
        console.log(`   Transaction: ${declareResponse.transaction_hash}`);
        
        return declareResponse.class_hash;
    } catch (error) {
        if (error.message && error.message.includes('already declared')) {
            console.log(`   ⚠️  Contract already declared, computing class hash...`);
            const classHash = starknet.hash.computeContractClassHash(sierra);
            console.log(`   Class Hash: ${classHash}`);
            return classHash;
        }
        throw error;
    }
}

async function deployContract(contractName, classHash, constructorCalldata, account) {
    console.log(`\n🚀 Deploying ${contractName}...`);
    
    const deployResponse = await account.deployContract({
        classHash: classHash,
        constructorCalldata: constructorCalldata,
    });
    
    console.log(`   ⏳ Waiting for deployment...`);
    await provider.waitForTransaction(deployResponse.transaction_hash);
    
    const contractAddress = deployResponse.contract_address;
    console.log(`✅ ${contractName} deployed`);
    console.log(`   Address: ${contractAddress}`);
    console.log(`   Transaction: ${deployResponse.transaction_hash}`);
    
    return contractAddress;
}

async function main() {
    console.log('🔄 Redeploying PositionHandler with MARKET_DISABLED check bypassed\n');
    console.log('=' .repeat(70));
    
    const account = await getAccount();
    console.log(`\n👤 Using account: ${account.address}`);
    
    // Step 1: Declare PositionHandler
    const positionHandlerClassHash = await declareContract('PositionHandler', account);
    
    // Step 2: Deploy PositionHandler
    const constructorCalldata = [
        DATA_STORE_ADDRESS,
        EVENT_EMITTER_ADDRESS,
        VERIFIER_ADDRESS,
        YUSD_TOKEN_ADDRESS,
        COLLATERAL_VAULT_ADDRESS,
    ];
    
    const positionHandlerAddress = await deployContract(
        'PositionHandler',
        positionHandlerClassHash,
        constructorCalldata,
        account
    );
    
    console.log(`\n✅ PositionHandler redeployed successfully!`);
    console.log(`\n📋 Update your frontend config:`);
    console.log(`   POSITION_HANDLER: '${positionHandlerAddress}'`);
    console.log(`\n📋 Update PerpRouter (if needed):`);
    console.log(`   Run your PerpRouter deployment with new PositionHandler address`);
    
    // Update DEPLOYED_ADDRESSES.md
    const addressesFile = path.join(__dirname, '../DEPLOYED_ADDRESSES.md');
    if (fs.existsSync(addressesFile)) {
        let content = fs.readFileSync(addressesFile, 'utf8');
        // Update PositionHandler address
        content = content.replace(
            /## PositionHandler Contract.*?##/s,
            `## PositionHandler Contract ✅ REDEPLOYED\n\n**Contract Name:** \`PositionHandler\`\n\n**Deployed Address:** \`${positionHandlerAddress}\`\n\n**Class Hash:** \`${positionHandlerClassHash}\`\n\n**Status:** ✅ Ready (MARKET_DISABLED check temporarily bypassed for testing)\n\n---\n\n##`
        );
        fs.writeFileSync(addressesFile, content);
        console.log(`\n✅ Updated DEPLOYED_ADDRESSES.md`);
    }
}

main().catch(error => {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
});

