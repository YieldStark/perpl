require('dotenv').config();
const starknet = require('starknet');
const readline = require('readline');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';

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

// Convert string to felt252
function stringToFelt252(str) {
    return starknet.cairo.felt(str);
}

async function grantAdminRole() {
    const newAdminAddress = process.env.ADMIN_ADDRESS;
    
    if (!newAdminAddress) {
        console.error('❌ ADMIN_ADDRESS not found in .env file');
        process.exit(1);
    }
    
    console.log('🔐 Granting ADMIN role to new account\n');
    console.log(`   New Admin Address: ${newAdminAddress}`);
    console.log(`   RoleStore Address: ${ROLE_STORE_ADDRESS}\n`);
    
    // Check if already has role
    const contract = new starknet.Contract({
        abi: ROLE_STORE_ABI,
        address: ROLE_STORE_ADDRESS,
        providerOrAccount: provider,
    });
    
    try {
        const hasRole = await contract.has_role(newAdminAddress, stringToFelt252('ADMIN'));
        if (hasRole) {
            console.log('✅ Account already has ADMIN role!');
            rl.close();
            return;
        }
    } catch (error) {
        // Continue
    }
    
    console.log('📝 To grant ADMIN role, you need an account that already has ADMIN role.');
    console.log('   This is typically the account that deployed the RoleStore contract.\n');
    
    const adminAddress = await question('Enter admin account address (that has ADMIN role): ');
    const adminPrivateKey = await question('Enter admin account private key (0x...): ');
    
    if (!adminAddress.trim() || !adminPrivateKey.trim()) {
        console.error('❌ Address and private key are required');
        rl.close();
        process.exit(1);
    }
    
    if (!adminPrivateKey.trim().startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        rl.close();
        process.exit(1);
    }
    
    // Create admin account
    const adminAccount = new starknet.Account({
        provider,
        address: adminAddress.trim(),
        signer: adminPrivateKey.trim(),
        cairoVersion: '1',
        transactionVersion: '0x3',
    });
    
    // Verify admin has role
    console.log('\n🔍 Verifying admin account has ADMIN role...');
    try {
        const hasRole = await contract.has_role(adminAddress.trim(), stringToFelt252('ADMIN'));
        if (!hasRole) {
            console.error('❌ The provided account does not have ADMIN role');
            console.error('   You need an account that was granted ADMIN role to grant roles to others.');
            rl.close();
            process.exit(1);
        }
        console.log('✅ Admin account verified\n');
    } catch (error) {
        console.error('❌ Error verifying admin role:', error.message);
        rl.close();
        process.exit(1);
    }
    
    // Grant role
    console.log('📤 Granting ADMIN role...');
    try {
        const contractWithAccount = new starknet.Contract({
            abi: ROLE_STORE_ABI,
            address: ROLE_STORE_ADDRESS,
            providerOrAccount: adminAccount,
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
            console.error('   The account you provided does not have ADMIN role.');
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



