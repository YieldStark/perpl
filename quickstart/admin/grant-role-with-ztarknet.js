require('dotenv').config();
const starknet = require('starknet');
const { execSync } = require('child_process');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';
const ZTARKNET_ADDRESS = '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec';

// RoleStore ABI
const ROLE_STORE_ABI = [
    {
        type: 'function',
        name: 'has_role',
        inputs: [
            { name: 'account', type: 'felt252' },
            { name: 'role', type: 'felt252' }
        ],
        outputs: [{ name: 'has_role', type: 'bool' }],
        state_mutability: 'view',
    },
    {
        type: 'function',
        name: 'grant_role',
        inputs: [
            { name: 'account', type: 'felt252' },
            { name: 'role', type: 'felt252' }
        ],
        outputs: [],
        state_mutability: 'external',
    },
];

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

function stringToFelt252(str) {
    return starknet.cairo.felt(str);
}

async function grantAdminRole() {
    const newAdminAddress = process.env.ADMIN_ADDRESS;
    
    if (!newAdminAddress) {
        console.error('❌ ADMIN_ADDRESS not found in .env file');
        process.exit(1);
    }
    
    console.log('🔐 Granting ADMIN role using ztarknet account\n');
    console.log(`   New Admin Address: ${newAdminAddress}`);
    console.log(`   Ztarknet Address: ${ZTARKNET_ADDRESS}`);
    console.log(`   RoleStore Address: ${ROLE_STORE_ADDRESS}\n`);
    
    // Try to get ztarknet private key from sncast
    console.log('🔍 Attempting to get ztarknet account private key...\n');
    
    let ztarknetPrivateKey = null;
    
    // Method 1: Try sncast command (from WSL if available)
    try {
        console.log('   Trying sncast command...');
        const output = execSync('sncast account show --name ztarknet --display-private-keys', {
            encoding: 'utf-8',
            stdio: 'pipe',
            shell: true
        });
        
        const privateKeyMatch = output.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
        if (privateKeyMatch) {
            ztarknetPrivateKey = privateKeyMatch[1];
            console.log('   ✅ Found private key via sncast\n');
        }
    } catch (error) {
        console.log('   ⚠️  sncast command failed\n');
    }
    
    // Method 2: Try reading account file
    if (!ztarknetPrivateKey) {
        const fs = require('fs');
        const os = require('os');
        const path = require('path');
        
        const homeDir = os.homedir();
        const possiblePaths = [
            path.join(homeDir, '.starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
            path.join(homeDir, '.config', 'starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
            '/mnt/c/Users/DELL/.starknet_accounts/starknet_open_zeppelin_accounts.json',
        ];
        
        for (const accountPath of possiblePaths) {
            if (fs.existsSync(accountPath)) {
                try {
                    console.log(`   Trying account file: ${accountPath}`);
                    const accounts = JSON.parse(fs.readFileSync(accountPath, 'utf-8'));
                    if (accounts.ztarknet && accounts.ztarknet.private_key) {
                        ztarknetPrivateKey = accounts.ztarknet.private_key;
                        console.log('   ✅ Found private key in account file\n');
                        break;
                    }
                } catch (error) {
                    // Continue
                }
            }
        }
    }
    
    if (!ztarknetPrivateKey) {
        console.error('❌ Could not find ztarknet private key automatically');
        console.log('\n💡 Please provide the private key manually:');
        console.log('   1. Get it from WSL: sncast account show --name ztarknet --display-private-keys');
        console.log('   2. Or run: npm run grant-role-simple');
        console.log('      (then enter ztarknet address and private key when prompted)\n');
        process.exit(1);
    }
    
    // Verify ztarknet has ADMIN role
    console.log('🔍 Verifying ztarknet account has ADMIN role...');
    const contract = new starknet.Contract({
        abi: ROLE_STORE_ABI,
        address: ROLE_STORE_ADDRESS,
        providerOrAccount: provider,
    });
    
    try {
        const hasRole = await contract.has_role(ZTARKNET_ADDRESS, stringToFelt252('ADMIN'));
        if (!hasRole) {
            console.error('❌ ztarknet account does not have ADMIN role');
            console.error('   This account may not be the one that deployed RoleStore');
            process.exit(1);
        }
        console.log('   ✅ ztarknet has ADMIN role\n');
    } catch (error) {
        console.error('❌ Error checking role:', error.message);
        process.exit(1);
    }
    
    // Create ztarknet account
    const ztarknetAccount = new starknet.Account({
        provider,
        address: ZTARKNET_ADDRESS,
        signer: ztarknetPrivateKey,
        cairoVersion: '1',
        transactionVersion: '0x3',
    });
    
    // Grant role
    console.log('📤 Granting ADMIN role to new account...');
    try {
        const contractWithAccount = new starknet.Contract({
            abi: ROLE_STORE_ABI,
            address: ROLE_STORE_ADDRESS,
            providerOrAccount: ztarknetAccount,
        });
        
        const tx = await contractWithAccount.grant_role(
            newAdminAddress,
            stringToFelt252('ADMIN')
        );
        
        console.log('✅ Transaction submitted!');
        console.log(`   Transaction hash: ${tx.transaction_hash}`);
        console.log('   Waiting for confirmation...\n');
        
        await provider.waitForTransaction(tx.transaction_hash);
        
        console.log('✅ ADMIN role granted successfully!\n');
        console.log('📋 Next steps:');
        console.log('   1. Run: npm run enable-market');
        
    } catch (error) {
        console.error('❌ Error granting role:', error.message);
        if (error.message.includes('NOT_ADMIN')) {
            console.error('   The ztarknet account does not have ADMIN role.');
        }
        process.exit(1);
    }
}

grantAdminRole().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});



