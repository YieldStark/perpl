// Grant ADMIN role using ztarknet account (pure starknet.js, no sncast needed)
// Usage: node grant-admin-role-direct.js <new_admin_address> [ztarknet_private_key]

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
    const newAdminAddress = process.argv[2];
    let ztarknetPrivateKey = process.argv[3];
    
    if (!newAdminAddress) {
        console.error('Usage: node grant-admin-role-direct.js <new_admin_address> [ztarknet_private_key]');
        console.error('Example: node grant-admin-role-direct.js 0x6ea65f11fc62023916d34c517bc2deaf15024bf5f851209741b34fd1afd7bef');
        process.exit(1);
    }
    
    console.log('🔐 Granting ADMIN role to new account\n');
    console.log(`   New Admin: ${newAdminAddress}`);
    console.log(`   Ztarknet: ${ZTARKNET_ADDRESS}`);
    console.log(`   RoleStore: ${ROLE_STORE_ADDRESS}\n`);
    
    // Get private key if not provided
    if (!ztarknetPrivateKey) {
        console.log('📝 Ztarknet private key not provided as argument');
        console.log('   You can get it by running: sncast account list');
        console.log('   Or check your account file: ~/.starknet_accounts/starknet_open_zeppelin_accounts.json\n');
        ztarknetPrivateKey = await question('Enter ztarknet private key (0x...): ');
    }
    
    ztarknetPrivateKey = ztarknetPrivateKey.trim();
    
    if (!ztarknetPrivateKey.startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        rl.close();
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
    
    // Verify ztarknet has ADMIN role
    console.log('\n🔍 Verifying ztarknet has ADMIN role...');
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
            rl.close();
            process.exit(1);
        }
        console.log('   ✅ ztarknet has ADMIN role\n');
    } catch (error) {
        console.error('❌ Error checking role:', error.message);
        rl.close();
        process.exit(1);
    }
    
    // Grant role
    console.log('📤 Granting ADMIN role...');
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
        console.log('   cd ../admin');
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



