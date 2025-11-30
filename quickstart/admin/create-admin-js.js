require('dotenv').config();
const starknet = require('starknet');
const fs = require('fs');
const path = require('path');

const networkUrl = process.env.STARKNET_RPC_URL || 'https://ztarknet-madara.d.karnot.xyz';
const provider = new starknet.RpcProvider({ nodeUrl: networkUrl });

// OpenZeppelin account class hash (standard for Ztarknet)
const OZ_ACCOUNT_CLASS_HASH = '0x01484c93b9d6cf61614d698ed069b3c6992c32549194fc3465258c2194734189';

async function createAndDeployAdminAccount() {
    console.log('🔧 Creating and deploying admin account using starknet.js\n');
    
    // Generate a new private key
    const privateKeyBytes = starknet.ec.starkCurve.utils.randomPrivateKey();
    // Convert Uint8Array to hex string properly
    const privateKeyHex = '0x' + Array.from(privateKeyBytes)
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    
    // Calculate the account address (same method as walletService.ts)
    const rawPublicKey = starknet.ec.starkCurve.getPublicKey(privateKeyHex);
    // Extract x-coordinate (first 32 bytes or skip first byte if 65 bytes)
    const xSlice = rawPublicKey.length === 64 
        ? rawPublicKey.slice(0, 32) 
        : rawPublicKey.slice(1, 33);
    const publicKeyBigInt = BigInt('0x' + Array.from(xSlice).map(b => b.toString(16).padStart(2, '0')).join(''));
    const publicKeyHex = '0x' + publicKeyBigInt.toString(16);
    
    // Calculate address using the same method as walletService
    const constructorCalldata = [publicKeyBigInt.toString()];
    const accountAddress = starknet.hash.calculateContractAddressFromHash(
        publicKeyBigInt,
        OZ_ACCOUNT_CLASS_HASH,
        constructorCalldata,
        0
    );
    
    console.log('✅ Account created:');
    console.log(`   Address: ${accountAddress}`);
    console.log(`   Private Key: ${privateKeyHex.substring(0, 20)}...`);
    console.log(`   Public Key: ${publicKeyHex.substring(0, 20)}...\n`);
    
    // Create account instance (not deployed yet)
    const account = new starknet.Account({
        provider,
        address: accountAddress,
        signer: privateKeyHex,
        cairoVersion: '1',
        transactionVersion: '0x3',
    });
    
    console.log('📝 Step 1: Get funds from faucet');
    console.log(`   Visit: https://faucet.ztarknet.cash/`);
    console.log(`   Enter address: ${accountAddress}\n`);
    
    // Wait for user to fund the account
    console.log('⏳ Waiting for account to be funded...');
    console.log('   (Press Ctrl+C to skip and deploy manually later)\n');
    
    let funded = false;
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
        try {
            const balance = await provider.getBalance(accountAddress);
            if (balance > 0n) {
                funded = true;
                console.log(`✅ Account funded! Balance: ${balance.toString()}\n`);
                break;
            }
        } catch (e) {
            // Account not deployed yet, that's fine
        }
        
        if (i < maxAttempts - 1) {
            process.stdout.write(`   Checking... (${i + 1}/${maxAttempts})\r`);
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    }
    
    if (!funded) {
        console.log('\n⚠️  Account not funded yet. You can:');
        console.log('   1. Fund it at https://faucet.ztarknet.cash/');
        console.log('   2. Deploy manually later using the script below\n');
    }
    
    // Deploy the account
    console.log('📝 Step 2: Deploying account to network...');
    try {
        const deployResponse = await account.deployAccount({
            classHash: OZ_ACCOUNT_CLASS_HASH,
            constructorCalldata: [publicKeyBigInt.toString()],
            contractAddress: accountAddress,
            addressSalt: publicKeyBigInt, // Use public key as salt (same as walletService)
        });
        
        console.log('✅ Account deployment transaction submitted!');
        console.log(`   Transaction hash: ${deployResponse.transaction_hash}`);
        console.log(`   Waiting for confirmation...\n`);
        
        await provider.waitForTransaction(deployResponse.transaction_hash);
        console.log('✅ Account deployed successfully!\n');
    } catch (error) {
        if (error.message && error.message.includes('insufficient balance')) {
            console.error('\n❌ Deployment failed: Insufficient balance');
            console.error('   Please fund the account first at: https://faucet.ztarknet.cash/');
            console.error(`   Address: ${accountAddress}\n`);
        } else {
            console.error('\n❌ Deployment error:', error.message);
            console.error('   You can deploy manually later using:\n');
            console.error(`   const account = new starknet.Account({`);
            console.error(`       provider,`);
            console.error(`       address: '${accountAddress}',`);
            console.error(`       signer: '${privateKeyHex}',`);
            console.error(`       cairoVersion: '1',`);
            console.error(`   });`);
            console.error(`   await account.deployAccount({`);
            console.error(`       classHash: '${OZ_ACCOUNT_CLASS_HASH}',`);
            console.error(`       constructorCalldata: ['${publicKeyBigInt.toString()}'],`);
            console.error(`       contractAddress: '${accountAddress}',`);
            console.error(`       addressSalt: '${publicKeyBigInt.toString()}',`);
            console.error(`   });\n`);
        }
    }
    
    // Update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Update or add ADMIN_ADDRESS and ADMIN_KEY
    const lines = envContent.split('\n');
    const newLines = lines.map(line => {
        if (line.startsWith('ADMIN_ADDRESS=')) {
            return `ADMIN_ADDRESS=${accountAddress}`;
        }
        if (line.startsWith('ADMIN_KEY=')) {
            return `ADMIN_KEY=${privateKeyHex}`;
        }
        return line;
    });
    
    if (!lines.some(l => l.startsWith('ADMIN_ADDRESS='))) {
        newLines.push(`ADMIN_ADDRESS=${accountAddress}`);
    }
    if (!lines.some(l => l.startsWith('ADMIN_KEY='))) {
        newLines.push(`ADMIN_KEY=${privateKeyHex}`);
    }
    
    // Remove empty lines at the end
    while (newLines[newLines.length - 1] === '') {
        newLines.pop();
    }
    
    fs.writeFileSync(envPath, newLines.join('\n') + '\n');
    
    console.log('✅ Updated quickstart/admin/.env with:');
    console.log(`   ADMIN_ADDRESS=${accountAddress}`);
    console.log(`   ADMIN_KEY=${privateKeyHex.substring(0, 20)}...`);
    
    console.log('\n📋 Next steps:');
    console.log('   1. If not already funded, fund the account at: https://faucet.ztarknet.cash/');
    console.log('   2. If deployment failed, run this script again after funding');
    console.log('   3. Grant ADMIN role to this account (if needed)');
    console.log('   4. Run: npm run enable-market');
}

createAndDeployAdminAccount().catch(error => {
    console.error('❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
});

