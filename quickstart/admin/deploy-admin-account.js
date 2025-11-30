require('dotenv').config();
const starknet = require('starknet');
const { execSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ADMIN_ADDRESS = '0x5966682c7b99e235f68ffeca45b3f62753ab5d71167a9963cd78c6c24be27ad';
const OZ_ACCOUNT_CLASS_HASH = '0x01484c93b9d6cf61614d698ed069b3c6992c32549194fc3465258c2194734189';

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

function findAccountFile() {
    const homeDir = os.homedir();
    const possiblePaths = [
        path.join(homeDir, '.starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
        path.join(homeDir, '.config', 'starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
        '/mnt/c/Users/DELL/.starknet_accounts/starknet_open_zeppelin_accounts.json',
    ];
    
    for (const accountPath of possiblePaths) {
        if (fs.existsSync(accountPath)) {
            return accountPath;
        }
    }
    return null;
}

async function deployAdminAccount() {
    console.log('🔍 Finding admin account (myaccount) private key...\n');
    console.log(`   Admin Address: ${ADMIN_ADDRESS}\n`);
    
    let privateKey = null;
    
    // Method 1: Try sncast
    try {
        const output = execSync('sncast account list', { encoding: 'utf-8', stdio: 'pipe', shell: true });
        if (output.includes('myaccount') || output.includes(ADMIN_ADDRESS)) {
            console.log('   Found account in sncast list');
            // Try to get private key
            try {
                const showOutput = execSync('sncast account show --name myaccount --display-private-keys', {
                    encoding: 'utf-8',
                    stdio: 'pipe',
                    shell: true
                });
                const keyMatch = showOutput.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
                if (keyMatch) {
                    privateKey = keyMatch[1];
                    console.log('   ✅ Found private key via sncast\n');
                }
            } catch (e) {
                // Continue to file reading
            }
        }
    } catch (e) {
        // Continue
    }
    
    // Method 2: Read account file
    if (!privateKey) {
        const accountFile = findAccountFile();
        if (accountFile) {
            try {
                console.log(`   Reading account file: ${accountFile}`);
                const accounts = JSON.parse(fs.readFileSync(accountFile, 'utf-8'));
                
                // Try 'myaccount' key
                if (accounts.myaccount && accounts.myaccount.private_key) {
                    privateKey = accounts.myaccount.private_key;
                    console.log('   ✅ Found private key in account file\n');
                } else {
                    // Search by address
                    for (const [name, account] of Object.entries(accounts)) {
                        if (account.address && account.address.toLowerCase() === ADMIN_ADDRESS.toLowerCase()) {
                            privateKey = account.private_key;
                            console.log(`   ✅ Found private key for account: ${name}\n`);
                            break;
                        }
                    }
                }
            } catch (error) {
                console.log(`   ❌ Error reading account file: ${error.message}\n`);
            }
        }
    }
    
    if (!privateKey) {
        console.error('❌ Could not find private key for admin account');
        console.log('\n💡 Options:');
        console.log('   1. Find the private key manually from your account files');
        console.log('   2. Check WSL: cat ~/.starknet_accounts/starknet_open_zeppelin_accounts.json | grep -A 5 myaccount');
        console.log('   3. Or provide it manually when prompted\n');
        
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        
        const answer = await new Promise(resolve => {
            rl.question('Enter admin account private key (0x...) or press Enter to skip: ', resolve);
        });
        rl.close();
        
        if (!answer.trim()) {
            console.log('   Skipping deployment');
            process.exit(0);
        }
        
        privateKey = answer.trim();
    }
    
    if (!privateKey.startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        process.exit(1);
    }
    
    // Create account instance
    const account = new starknet.Account({
        provider,
        address: ADMIN_ADDRESS,
        signer: privateKey,
        cairoVersion: '1',
        transactionVersion: '0x3',
    });
    
    // Check if already deployed
    console.log('🔍 Checking if account is already deployed...');
    try {
        const balance = await provider.getBalance(ADMIN_ADDRESS);
        console.log(`   Balance: ${balance.toString()}\n`);
    } catch (error) {
        // Account not deployed
    }
    
    // Deploy account
    console.log('📤 Deploying admin account...');
    try {
        // Calculate public key from private key
        const rawPublicKey = starknet.ec.starkCurve.getPublicKey(privateKey);
        const xSlice = rawPublicKey.length === 64 
            ? rawPublicKey.slice(0, 32) 
            : rawPublicKey.slice(1, 33);
        const publicKeyBigInt = BigInt('0x' + Array.from(xSlice).map(b => b.toString(16).padStart(2, '0')).join(''));
        
        const deployResponse = await account.deployAccount({
            classHash: OZ_ACCOUNT_CLASS_HASH,
            constructorCalldata: [publicKeyBigInt.toString()],
            contractAddress: ADMIN_ADDRESS,
            addressSalt: publicKeyBigInt,
        });
        
        console.log('✅ Account deployment transaction submitted!');
        console.log(`   Transaction hash: ${deployResponse.transaction_hash}`);
        console.log('   Waiting for confirmation...\n');
        
        await provider.waitForTransaction(deployResponse.transaction_hash);
        
        console.log('✅ Admin account deployed successfully!\n');
        console.log('📋 Next steps:');
        console.log('   1. Update .env:');
        console.log(`      ADMIN_ADDRESS=${ADMIN_ADDRESS}`);
        console.log(`      ADMIN_KEY=${privateKey.substring(0, 20)}...`);
        console.log('   2. Run: npm run enable-market');
        
    } catch (error) {
        if (error.message && error.message.includes('already deployed')) {
            console.log('✅ Account is already deployed!\n');
            console.log('📋 Update .env:');
            console.log(`   ADMIN_ADDRESS=${ADMIN_ADDRESS}`);
            console.log(`   ADMIN_KEY=${privateKey.substring(0, 20)}...`);
            console.log('   Then run: npm run enable-market');
        } else if (error.message && error.message.includes('insufficient balance')) {
            console.error('\n❌ Deployment failed: Insufficient balance');
            console.error('   Please fund the account first at: https://faucet.ztarknet.cash/');
            console.error(`   Address: ${ADMIN_ADDRESS}\n`);
        } else {
            console.error('❌ Deployment error:', error.message);
        }
        process.exit(1);
    }
}

deployAdminAccount().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});



