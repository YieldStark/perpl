require('dotenv').config();
const starknet = require('starknet');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const NETWORK = 'ztarknet';

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

// Get account from environment, sncast, or prompt
async function getAccount() {
    let accountAddress = process.env.ACCOUNT_ADDRESS;
    let accountKey = process.env.ACCOUNT_KEY;
    const accountName = process.env.ACCOUNT_NAME || 'ztarknet';
    
    // Try to get from sncast if not in env
    if (!accountAddress || !accountKey) {
        try {
            console.log(`🔍 Trying to get ${accountName} account from sncast...`);
            const output = execSync(`sncast account show --name ${accountName} --display-private-keys`, {
                encoding: 'utf-8',
                stdio: 'pipe',
                shell: true
            });
            
            const addressMatch = output.match(/address:\s*(0x[a-fA-F0-9]+)/i);
            const privateKeyMatch = output.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
            
            if (addressMatch && privateKeyMatch) {
                accountAddress = addressMatch[1];
                accountKey = privateKeyMatch[1];
                console.log(`✅ Found account: ${accountAddress}\n`);
            }
        } catch (e) {
            console.log('⚠️  Could not get account from sncast\n');
        }
    }
    
    // Prompt if still not found
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
                    resolve({ accountAddress, accountKey, accountName });
                });
            });
        });
    }
    
    return { accountAddress, accountKey, accountName };
}

// Find sncast command
function findSncast() {
    // Try direct command first
    try {
        execSync('sncast --version', { encoding: 'utf8', stdio: 'pipe', shell: true });
        return 'sncast';
    } catch (e) {
        // Try WSL
        try {
            execSync('wsl sncast --version', { encoding: 'utf8', stdio: 'pipe', shell: true });
            return 'wsl sncast';
        } catch (e2) {
            // Try with bash
            try {
                execSync('bash -c "sncast --version"', { encoding: 'utf8', stdio: 'pipe', shell: true });
                return 'bash -c "sncast';
            } catch (e3) {
                return null;
            }
        }
    }
}

// Find sncast command
let cachedSncastCmd = null;

function findSncast() {
    if (cachedSncastCmd) return cachedSncastCmd;
    
    // Try direct command first
    try {
        execSync('sncast --version', { encoding: 'utf8', stdio: 'pipe', shell: true });
        cachedSncastCmd = 'sncast';
        return cachedSncastCmd;
    } catch (e) {
        // Try WSL
        try {
            execSync('wsl sncast --version', { encoding: 'utf8', stdio: 'pipe', shell: true });
            cachedSncastCmd = 'wsl sncast';
            console.log('   ℹ️  Using sncast via WSL');
            return cachedSncastCmd;
        } catch (e2) {
            // Try bash
            try {
                execSync('bash -c "sncast --version"', { encoding: 'utf8', stdio: 'pipe', shell: true });
                cachedSncastCmd = 'bash -c "sncast';
                return cachedSncastCmd;
            } catch (e3) {
                cachedSncastCmd = null;
                return null;
            }
        }
    }
}

// Execute sncast command
function execSncast(command, description) {
    console.log(`\n📤 ${description}...`);
    
    const sncastCmd = findSncast();
    if (!sncastCmd) {
        throw new Error(
            'sncast not found. Please:\n' +
            '  1. Install sncast: https://foundry-rs.github.io/starknet-foundry/getting_started/installation.html\n' +
            '  2. Or run from WSL where sncast is available\n' +
            '  3. Or add sncast to your Windows PATH\n' +
            '  4. Or set SNCAST_PATH environment variable to sncast location'
        );
    }
    
    // Adjust command if using WSL
    let adjustedCommand = command;
    if (sncastCmd === 'wsl sncast') {
        // For WSL, we need to adjust paths and run in WSL context
        const contractsPath = path.join(__dirname, '../contracts').replace(/\\/g, '/');
        const wslPath = `/mnt/c${contractsPath.replace('C:', '').replace(/\\/g, '/')}`;
        adjustedCommand = `wsl bash -c "cd ${wslPath} && ${command}"`;
    } else if (sncastCmd.startsWith('bash')) {
        adjustedCommand = `bash -c "${command.replace(/"/g, '\\"')}"`;
    }
    
    try {
        const output = execSync(adjustedCommand, { 
            encoding: 'utf8',
            stdio: 'pipe',
            shell: true,
            cwd: sncastCmd === 'wsl sncast' ? undefined : path.join(__dirname, '../contracts')
        });
        console.log(`✅ ${description} completed`);
        return output;
    } catch (error) {
        console.error(`❌ Error: ${error.message}`);
        if (error.stdout) console.log('Output:', error.stdout);
        if (error.stderr) console.error('Error:', error.stderr);
        throw error;
    }
}

// Extract class hash from sncast output
function extractClassHash(output) {
    const match = output.match(/class hash[:\s]+(0x[a-fA-F0-9]{64})/i);
    if (match) return match[1];
    
    // Try alternative format
    const match2 = output.match(/(0x[a-fA-F0-9]{64})/);
    if (match2) return match2[1];
    
    throw new Error('Could not extract class hash from output');
}

// Extract contract address from sncast output
function extractContractAddress(output) {
    const match = output.match(/contract address[:\s]+(0x[a-fA-F0-9]{64})/i);
    if (match) return match[1];
    
    const match2 = output.match(/address[:\s]+(0x[a-fA-F0-9]{64})/i);
    if (match2) return match2[1];
    
    throw new Error('Could not extract contract address from output');
}

// Deploy contract using sncast
async function deployContract(contractName, constructorCalldata, accountName) {
    console.log(`\n🔧 Deploying ${contractName}...`);
    
    // Declare
    const declareCmd = `sncast declare --contract-name ${contractName} --url ${RPC_URL} --account ${accountName}`;
    const declareOutput = execSncast(declareCmd, `Declaring ${contractName}`);
    const classHash = extractClassHash(declareOutput);
    console.log(`   Class Hash: ${classHash}`);
    
    // Deploy
    const calldataStr = constructorCalldata.join(' ');
    const deployCmd = `sncast deploy --class-hash ${classHash} --constructor-calldata ${calldataStr} --url ${RPC_URL} --account ${accountName}`;
    const deployOutput = execSncast(deployCmd, `Deploying ${contractName}`);
    const contractAddress = extractContractAddress(deployOutput);
    console.log(`   Contract Address: ${contractAddress}`);
    
    return { classHash, contractAddress };
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
    // Convert BigInt to hex strings for calldata
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
    console.log('🚀 Starting Full Contract Deployment\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    
    // Get account
    const { accountAddress, accountKey, accountName } = await getAccount();
    const account = new starknet.Account({
        provider,
        address: accountAddress,
        signer: accountKey,
        cairoVersion: '1',
        transactionVersion: '0x3',
        defaultTipType: 'recommendedTip',
    });
    
    console.log(`\n👤 Using account: ${accountAddress}`);
    console.log(`   Account Name: ${accountName}`);
    console.log(`   Network: ${RPC_URL}\n`);
    
    const deployed = {};
    
    try {
        // Step 1: Deploy RoleStore (admin = account address)
        const roleStore = await deployContract('RoleStore', [accountAddress], accountName);
        deployed.roleStore = roleStore;
        
        // Step 2: Deploy EventEmitter
        const eventEmitter = await deployContract('EventEmitter', [], accountName);
        deployed.eventEmitter = eventEmitter;
        
        // Step 3: Deploy DataStore
        const dataStore = await deployContract('DataStore', [roleStore.contractAddress], accountName);
        deployed.dataStore = dataStore;
        
        // Step 4: Deploy MockOracle (if needed)
        // Note: MockOracle might already be deployed, check first
        
        // Step 5: Deploy Oracle
        const oracle = await deployContract(
            'Oracle',
            [MOCK_ORACLE_ADDRESS, eventEmitter.contractAddress, '3600'],
            accountName
        );
        deployed.oracle = oracle;
        
        // Step 6: Deploy CollateralVault
        const collateralVault = await deployContract(
            'CollateralVault',
            [YUSD_TOKEN_ADDRESS, roleStore.contractAddress],
            accountName
        );
        deployed.collateralVault = collateralVault;
        
        // Step 7: Deploy PositionHandler
        const positionHandler = await deployContract(
            'PositionHandler',
            [
                dataStore.contractAddress,
                eventEmitter.contractAddress,
                VERIFIER_ADDRESS,
                YUSD_TOKEN_ADDRESS,
                collateralVault.contractAddress
            ],
            accountName
        );
        deployed.positionHandler = positionHandler;
        
        // Step 8: Deploy OrderHandler
        const orderHandler = await deployContract(
            'OrderHandler',
            [
                dataStore.contractAddress,
                eventEmitter.contractAddress,
                oracle.contractAddress,
                positionHandler.contractAddress
            ],
            accountName
        );
        deployed.orderHandler = orderHandler;
        
        // Step 9: Deploy LiquidationHandler
        const liquidationHandler = await deployContract(
            'LiquidationHandler',
            [
                dataStore.contractAddress,
                eventEmitter.contractAddress,
                VERIFIER_ADDRESS,
                collateralVault.contractAddress
            ],
            accountName
        );
        deployed.liquidationHandler = liquidationHandler;
        
        // Step 10: Deploy RiskManager
        const riskManager = await deployContract(
            'RiskManager',
            [dataStore.contractAddress, oracle.contractAddress],
            accountName
        );
        deployed.riskManager = riskManager;
        
        // Step 11: Deploy PerpRouter
        const perpRouter = await deployContract(
            'PerpRouter',
            [
                positionHandler.contractAddress,
                orderHandler.contractAddress,
                liquidationHandler.contractAddress,
                riskManager.contractAddress
            ],
            accountName
        );
        deployed.perpRouter = perpRouter;
        
        // Step 12: Grant roles to handlers
        console.log('\n🔐 Setting up roles...');
        
        await grantRole(roleStore.contractAddress, positionHandler.contractAddress, 'CONTROLLER', account);
        await grantRole(roleStore.contractAddress, orderHandler.contractAddress, 'CONTROLLER', account);
        await grantRole(roleStore.contractAddress, liquidationHandler.contractAddress, 'CONTROLLER', account);
        await grantRole(roleStore.contractAddress, positionHandler.contractAddress, 'POSITION_HANDLER', account);
        await grantRole(roleStore.contractAddress, liquidationHandler.contractAddress, 'LIQUIDATION_HANDLER', account);
        
        // Step 13: Enable markets
        console.log('\n📊 Enabling markets...');
        
        const defaultConfig = {
            max_leverage: { low: 20n, high: 0n }, // 20
            min_margin_ratio: { low: 5n, high: 0n }, // 5%
            max_position_size: { low: 1000000000000000000000000n, high: 0n }, // 1000000000000000000000000
            price_impact_factor: { low: 1000n, high: 0n }, // 1000
            trading_fee_bps: { low: 10n, high: 0n }, // 10
            liquidation_fee_bps: { low: 50n, high: 0n }, // 50
            enabled: true
        };
        
        for (const marketId of Object.keys(PRAGMA_ASSET_IDS)) {
            await enableMarket(dataStore.contractAddress, marketId, defaultConfig, account);
        }
        
        // Save deployment addresses
        const deploymentFile = path.join(__dirname, 'deployment-addresses.json');
        fs.writeFileSync(deploymentFile, JSON.stringify(deployed, null, 2));
        
        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Deployment Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('\n📋 Deployed Contracts:');
        console.log(`   RoleStore: ${roleStore.contractAddress}`);
        console.log(`   EventEmitter: ${eventEmitter.contractAddress}`);
        console.log(`   DataStore: ${dataStore.contractAddress}`);
        console.log(`   Oracle: ${oracle.contractAddress}`);
        console.log(`   CollateralVault: ${collateralVault.contractAddress}`);
        console.log(`   PositionHandler: ${positionHandler.contractAddress}`);
        console.log(`   OrderHandler: ${orderHandler.contractAddress}`);
        console.log(`   LiquidationHandler: ${liquidationHandler.contractAddress}`);
        console.log(`   RiskManager: ${riskManager.contractAddress}`);
        console.log(`   PerpRouter: ${perpRouter.contractAddress}`);
        console.log(`\n📝 Addresses saved to: ${deploymentFile}`);
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        console.error('\n📋 Partial deployment saved to deployment-addresses.json');
        process.exit(1);
    }
}

// Run deployment
if (require.main === module) {
    deployAll().catch(console.error);
}

module.exports = { deployAll };

