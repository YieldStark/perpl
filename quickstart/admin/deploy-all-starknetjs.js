require('dotenv').config();
const starknet = require('starknet');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';

// Contract addresses from DEPLOYED_ADDRESSES.md
const VERIFIER_ADDRESS = '0x26cb40ff6fda0e89fe50a7b229c5ffb172177406f85ac2fa96ac3e2a2cb7d2d';
const YUSD_TOKEN_ADDRESS = '0x0374317fb45421115f2b3b3df22dce36d922a00eb7b2f80966ebc23cb8b2cfda';
const MOCK_ORACLE_ADDRESS = '0x00e2c5d520b31762df17b54f339c665a7c4c9fa9e81fd05c40c2e0fce3de47b9';

// Pragma Asset IDs
const PRAGMA_ASSET_IDS = {
    'BTC/USD': '0x4254432f555344',
    'ETH/USD': '0x4554482f555344',
};

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

// Get account from environment or prompt
async function getAccount() {
    let accountAddress = process.env.ACCOUNT_ADDRESS;
    let accountKey = process.env.ACCOUNT_KEY;
    
    if (!accountAddress || !accountKey) {
        console.log('📋 Account Setup Required');
        console.log('   Please set in .env (ACCOUNT_ADDRESS, ACCOUNT_KEY) or provide now:');
        
        const readline = require('readline').createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        return new Promise((resolve) => {
            readline.question('   Account Address (0x...): ', (addr) => {
                accountAddress = addr.trim();
                readline.question('   Private Key (0x...): ', (key) => {
                    accountKey = key.trim();
                    readline.close();
                    resolve({ accountAddress, accountKey });
                });
            });
        });
    }
    
    return { accountAddress, accountKey };
}

// Read compiled contract files
function getContractFiles(contractName) {
    const contractsDir = path.join(__dirname, '../contracts');
    const targetDir = path.join(contractsDir, 'target/dev');
    
    // Try to find the contract files
    const sierraPath = path.join(targetDir, `${contractName}.contract_class.json`);
    const casmPath = path.join(targetDir, `${contractName}.compiled_contract_class.json`);
    
    if (!fs.existsSync(sierraPath)) {
        throw new Error(`Contract not compiled: ${contractName}. Run 'cd quickstart/contracts && scarb build' first.`);
    }
    
    const sierra = JSON.parse(fs.readFileSync(sierraPath, 'utf8'));
    const casm = fs.existsSync(casmPath) ? JSON.parse(fs.readFileSync(casmPath, 'utf8')) : null;
    
    return { sierra, casm };
}

// Declare contract using starknet.js
async function declareContract(contractName, account) {
    console.log(`\n📝 Declaring ${contractName}...`);
    
    const { sierra, casm } = getContractFiles(contractName);
    
    try {
        const declareResponse = await account.declare({
            contract: sierra,
            casm: casm,
        });
        
        await provider.waitForTransaction(declareResponse.transaction_hash);
        console.log(`✅ ${contractName} declared`);
        console.log(`   Class Hash: ${declareResponse.class_hash}`);
        console.log(`   Transaction: ${declareResponse.transaction_hash}`);
        
        return declareResponse.class_hash;
    } catch (error) {
        // If already declared, try to get the class hash from the error or re-declare
        if (error.message && error.message.includes('already declared')) {
            console.log(`   ⚠️  Contract already declared, extracting class hash...`);
            // Extract class hash from sierra
            const classHash = starknet.hash.computeContractClassHash(sierra);
            console.log(`   Class Hash: ${classHash}`);
            return classHash;
        }
        throw error;
    }
}

// Deploy contract using starknet.js
async function deployContract(contractName, classHash, constructorCalldata, account) {
    console.log(`\n🔧 Deploying ${contractName}...`);
    
    try {
        const deployResponse = await account.deployContract({
            classHash: classHash,
            constructorCalldata: constructorCalldata,
        });
        
        await provider.waitForTransaction(deployResponse.transaction_hash);
        console.log(`✅ ${contractName} deployed`);
        console.log(`   Contract Address: ${deployResponse.contract_address}`);
        console.log(`   Transaction: ${deployResponse.transaction_hash}`);
        
        return deployResponse.contract_address;
    } catch (error) {
        console.error(`❌ Error deploying ${contractName}: ${error.message}`);
        throw error;
    }
}

// Grant role using starknet.js
async function grantRole(roleStoreAddress, accountAddress, role, adminAccount) {
    console.log(`\n🔐 Granting ${role} role to ${accountAddress}...`);
    
    const roleFelt = starknet.cairo.felt(role);
    const accountFelt = starknet.cairo.felt(accountAddress);
    
    try {
        const call = {
            contractAddress: roleStoreAddress,
            entrypoint: 'grant_role',
            calldata: [accountFelt, roleFelt],
        };
        
        const tx = await adminAccount.execute(call);
        await provider.waitForTransaction(tx.transaction_hash);
        console.log(`✅ Role granted! Tx: ${tx.transaction_hash}`);
    } catch (error) {
        console.error(`❌ Error granting role: ${error.message}`);
        throw error;
    }
}

// Enable market using starknet.js
async function enableMarket(dataStoreAddress, marketId, config, adminAccount) {
    console.log(`\n📊 Enabling market: ${marketId}...`);
    
    const marketIdFelt = PRAGMA_ASSET_IDS[marketId] || starknet.cairo.felt(marketId);
    
    // Convert config to Cairo format (u256 = [low, high])
    const toHex = (val) => {
        if (typeof val === 'bigint') {
            return '0x' + val.toString(16);
        }
        return val || '0x0';
    };
    
    const calldata = [
        marketIdFelt,
        toHex(config.max_leverage.low),
        toHex(config.max_leverage.high),
        toHex(config.min_margin_ratio.low),
        toHex(config.min_margin_ratio.high),
        toHex(config.max_position_size.low),
        toHex(config.max_position_size.high),
        toHex(config.price_impact_factor.low),
        toHex(config.price_impact_factor.high),
        toHex(config.trading_fee_bps.low),
        toHex(config.trading_fee_bps.high),
        toHex(config.liquidation_fee_bps.low),
        toHex(config.liquidation_fee_bps.high),
        config.enabled ? '0x1' : '0x0'
    ];
    
    try {
        const call = {
            contractAddress: dataStoreAddress,
            entrypoint: 'set_market_config',
            calldata: calldata,
        };
        
        const tx = await adminAccount.execute(call);
        await provider.waitForTransaction(tx.transaction_hash);
        console.log(`✅ Market enabled! Tx: ${tx.transaction_hash}`);
    } catch (error) {
        console.error(`❌ Error enabling market: ${error.message}`);
        throw error;
    }
}

// Main deployment function
async function deployAll() {
    console.log('🚀 Starting Full Contract Deployment (using starknet.js)\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Check if contracts are built
    const contractsDir = path.join(__dirname, '../contracts');
    const targetDir = path.join(contractsDir, 'target/dev');
    if (!fs.existsSync(targetDir)) {
        console.error('❌ Contracts not built. Please run:');
        console.error('   cd quickstart/contracts && scarb build');
        process.exit(1);
    }
    
    // Get account
    const { accountAddress, accountKey } = await getAccount();
    const account = new starknet.Account({
        provider,
        address: accountAddress,
        signer: accountKey,
        cairoVersion: '1',
        transactionVersion: '0x3',
        defaultTipType: 'recommendedTip',
    });
    
    console.log(`\n👤 Using account: ${accountAddress}`);
    console.log(`   Network: ${RPC_URL}\n`);
    
    const deployed = {};
    
    try {
        // Step 1: Deploy RoleStore (admin = account address)
        const roleStoreClassHash = await declareContract('RoleStore', account);
        const roleStoreAddress = await deployContract('RoleStore', roleStoreClassHash, [accountAddress], account);
        deployed.roleStore = { classHash: roleStoreClassHash, contractAddress: roleStoreAddress };
        
        // Step 2: Deploy EventEmitter
        const eventEmitterClassHash = await declareContract('EventEmitter', account);
        const eventEmitterAddress = await deployContract('EventEmitter', eventEmitterClassHash, [], account);
        deployed.eventEmitter = { classHash: eventEmitterClassHash, contractAddress: eventEmitterAddress };
        
        // Step 3: Deploy DataStore
        const dataStoreClassHash = await declareContract('DataStore', account);
        const dataStoreAddress = await deployContract('DataStore', dataStoreClassHash, [roleStoreAddress], account);
        deployed.dataStore = { classHash: dataStoreClassHash, contractAddress: dataStoreAddress };
        
        // Step 4: Deploy Oracle
        const oracleClassHash = await declareContract('Oracle', account);
        const oracleAddress = await deployContract('Oracle', oracleClassHash, [MOCK_ORACLE_ADDRESS, eventEmitterAddress, '3600'], account);
        deployed.oracle = { classHash: oracleClassHash, contractAddress: oracleAddress };
        
        // Step 5: Deploy CollateralVault
        const collateralVaultClassHash = await declareContract('CollateralVault', account);
        const collateralVaultAddress = await deployContract('CollateralVault', collateralVaultClassHash, [YUSD_TOKEN_ADDRESS, roleStoreAddress], account);
        deployed.collateralVault = { classHash: collateralVaultClassHash, contractAddress: collateralVaultAddress };
        
        // Step 6: Deploy PositionHandler
        const positionHandlerClassHash = await declareContract('PositionHandler', account);
        const positionHandlerAddress = await deployContract('PositionHandler', positionHandlerClassHash, [
            dataStoreAddress,
            eventEmitterAddress,
            VERIFIER_ADDRESS,
            YUSD_TOKEN_ADDRESS,
            collateralVaultAddress
        ], account);
        deployed.positionHandler = { classHash: positionHandlerClassHash, contractAddress: positionHandlerAddress };
        
        // Step 7: Deploy OrderHandler
        const orderHandlerClassHash = await declareContract('OrderHandler', account);
        const orderHandlerAddress = await deployContract('OrderHandler', orderHandlerClassHash, [
            dataStoreAddress,
            eventEmitterAddress,
            oracleAddress,
            positionHandlerAddress
        ], account);
        deployed.orderHandler = { classHash: orderHandlerClassHash, contractAddress: orderHandlerAddress };
        
        // Step 8: Deploy LiquidationHandler
        const liquidationHandlerClassHash = await declareContract('LiquidationHandler', account);
        const liquidationHandlerAddress = await deployContract('LiquidationHandler', liquidationHandlerClassHash, [
            dataStoreAddress,
            eventEmitterAddress,
            VERIFIER_ADDRESS,
            collateralVaultAddress
        ], account);
        deployed.liquidationHandler = { classHash: liquidationHandlerClassHash, contractAddress: liquidationHandlerAddress };
        
        // Step 9: Deploy RiskManager
        const riskManagerClassHash = await declareContract('RiskManager', account);
        const riskManagerAddress = await deployContract('RiskManager', riskManagerClassHash, [dataStoreAddress, oracleAddress], account);
        deployed.riskManager = { classHash: riskManagerClassHash, contractAddress: riskManagerAddress };
        
        // Step 10: Deploy PerpRouter
        const perpRouterClassHash = await declareContract('PerpRouter', account);
        const perpRouterAddress = await deployContract('PerpRouter', perpRouterClassHash, [
            positionHandlerAddress,
            orderHandlerAddress,
            liquidationHandlerAddress,
            riskManagerAddress
        ], account);
        deployed.perpRouter = { classHash: perpRouterClassHash, contractAddress: perpRouterAddress };
        
        // Step 11: Grant roles to handlers
        console.log('\n🔐 Setting up roles...');
        
        await grantRole(roleStoreAddress, positionHandlerAddress, 'CONTROLLER', account);
        await grantRole(roleStoreAddress, orderHandlerAddress, 'CONTROLLER', account);
        await grantRole(roleStoreAddress, liquidationHandlerAddress, 'CONTROLLER', account);
        await grantRole(roleStoreAddress, positionHandlerAddress, 'POSITION_HANDLER', account);
        await grantRole(roleStoreAddress, liquidationHandlerAddress, 'LIQUIDATION_HANDLER', account);
        
        // Step 12: Enable markets
        console.log('\n📊 Enabling markets...');
        
        const defaultConfig = {
            max_leverage: { low: 20n, high: 0n },
            min_margin_ratio: { low: 5n, high: 0n },
            max_position_size: { low: 1000000000000000000000000n, high: 0n },
            price_impact_factor: { low: 1000n, high: 0n },
            trading_fee_bps: { low: 10n, high: 0n },
            liquidation_fee_bps: { low: 50n, high: 0n },
            enabled: true
        };
        
        for (const marketId of Object.keys(PRAGMA_ASSET_IDS)) {
            await enableMarket(dataStoreAddress, marketId, defaultConfig, account);
        }
        
        // Save deployment addresses
        const deploymentFile = path.join(__dirname, 'deployment-addresses.json');
        fs.writeFileSync(deploymentFile, JSON.stringify(deployed, null, 2));
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Deployment Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Deployed Contracts:');
        for (const [name, info] of Object.entries(deployed)) {
            console.log(`   ${name}: ${info.contractAddress}`);
        }
        console.log(`\n📝 Addresses saved to: ${deploymentFile}`);
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.error('\n📋 Partial deployment saved to deployment-addresses.json');
        if (deployed && Object.keys(deployed).length > 0) {
            const deploymentFile = path.join(__dirname, 'deployment-addresses.json');
            fs.writeFileSync(deploymentFile, JSON.stringify(deployed, null, 2));
        }
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    deployAll().catch(console.error);
}

module.exports = { deployAll };



