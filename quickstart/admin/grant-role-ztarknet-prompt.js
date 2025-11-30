require('dotenv').config();
const starknet = require('starknet');
const readline = require('readline');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';
const ZTARKNET_ADDRESS = '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec';

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

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
        console.log('   Make sure you have run: npm run create-admin-js');
        rl.close();
        process.exit(1);
    }
    
    console.log('🔐 Granting ADMIN role using ztarknet account\n');
    console.log(`   New Admin Address: ${newAdminAddress}`);
    console.log(`   Ztarknet Address: ${ZTARKNET_ADDRESS}`);
    console.log(`   RoleStore Address: ${ROLE_STORE_ADDRESS}\n`);
    
    console.log('📝 Enter ztarknet account private key');
    console.log('   (Get it from: ~/.starknet_accounts/starknet_open_zeppelin_accounts.json)');
    console.log('   Or from WSL: cat ~/.starknet_accounts/starknet_open_zeppelin_accounts.json | grep -A 5 ztarknet\n');
    
    const ztarknetPrivateKey = await question('Ztarknet private key (0x...): ');
    
    if (!ztarknetPrivateKey.trim().startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        rl.close();
        process.exit(1);
    }
    
    // Create ztarknet account
    const ztarknetAccount = new starknet.Account({
        provider,
        address: ZTARKNET_ADDRESS,
        signer: ztarknetPrivateKey.trim(),
        cairoVersion: '1',
        transactionVersion: '0x3',
    });
    
    // Verify ztarknet has ADMIN role
    console.log('\n🔍 Verifying ztarknet has ADMIN role...');
    
    try {
        // Use callContract directly for view functions to avoid type issues
        const hasRoleResult = await provider.callContract({
            contractAddress: ROLE_STORE_ADDRESS,
            entrypoint: 'has_role',
            calldata: [ZTARKNET_ADDRESS, stringToFelt252('ADMIN')],
        });
        
        const hasRole = hasRoleResult[0] !== 0n;
        if (!hasRole) {
            console.error('❌ ztarknet account does not have ADMIN role');
            console.error('   This account may not be the one that deployed RoleStore');
            rl.close();
            process.exit(1);
        }
        console.log('   ✅ ztarknet has ADMIN role\n');
    } catch (error) {
        console.error('❌ Error checking role:', error.message);
        console.log('   ⚠️  Skipping role check, proceeding to grant role...\n');
    }
    
    // Grant role
    console.log('📤 Granting ADMIN role to new account...');
    try {
        // Use account.execute() directly to avoid type validation issues
        const call = {
            contractAddress: ROLE_STORE_ADDRESS,
            entrypoint: 'grant_role',
            calldata: [newAdminAddress, stringToFelt252('ADMIN')],
        };
        
        const tx = await ztarknetAccount.execute(call);
        
        console.log('✅ Transaction submitted!');
        console.log(`   Transaction hash: ${tx.transaction_hash}`);
        console.log('   Waiting for confirmation...\n');
        
        await provider.waitForTransaction(tx.transaction_hash);
        
        console.log('✅ ADMIN role granted successfully!\n');
        console.log('📋 Next steps:');
        console.log('   npm run enable-market');
        
    } catch (error) {
        console.error('❌ Error granting role:', error.message);
        if (error.message.includes('NOT_ADMIN')) {
            console.error('   The ztarknet account does not have ADMIN role.');
        }
        rl.close();
        process.exit(1);
    }
    
    rl.close();
}

grantAdminRole().catch(error => {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
});

