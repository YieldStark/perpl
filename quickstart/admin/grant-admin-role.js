require('dotenv').config();
const starknet = require('starknet');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';

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
        console.log('   Make sure you have run: npm run create-admin-js');
        process.exit(1);
    }
    
    console.log('🔐 Granting ADMIN role to new account\n');
    console.log(`   New Admin Address: ${newAdminAddress}`);
    console.log(`   RoleStore Address: ${ROLE_STORE_ADDRESS}\n`);
    
    // Check if account already has ADMIN role
    const contract = new starknet.Contract({
        abi: ROLE_STORE_ABI,
        address: ROLE_STORE_ADDRESS,
        providerOrAccount: provider,
    });
    
    try {
        const hasRole = await contract.has_role(newAdminAddress, stringToFelt252('ADMIN'));
        if (hasRole) {
            console.log('✅ Account already has ADMIN role!');
            return;
        }
    } catch (error) {
        console.log('⚠️  Could not check role (will try to grant anyway)');
    }
    
    // Try known admin accounts
    const knownAdmins = [
        '0x5be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e', // oracle_admin
        '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec', // ztarknet
    ];
    
    console.log('🔍 Checking which account has ADMIN role...\n');
    
    let adminWithRole = null;
    for (const adminAddr of knownAdmins) {
        try {
            const hasRole = await contract.has_role(adminAddr, stringToFelt252('ADMIN'));
            if (hasRole) {
                console.log(`✅ Found admin with role: ${adminAddr}`);
                adminWithRole = adminAddr;
                break;
            }
        } catch (error) {
            // Continue checking
        }
    }
    
    if (!adminWithRole) {
        console.error('❌ Could not find an account with ADMIN role');
        console.log('\n💡 Options:');
        console.log('   1. Use an existing admin account to grant the role manually');
        console.log('   2. Check the RoleStore deployment to find the original admin');
        console.log('   3. If you deployed RoleStore, use that account\n');
        console.log('📝 To grant manually, use an account with ADMIN role:');
        console.log(`   const contract = new starknet.Contract({`);
        console.log(`       abi: ROLE_STORE_ABI,`);
        console.log(`       address: '${ROLE_STORE_ADDRESS}',`);
        console.log(`       providerOrAccount: adminAccount,`);
        console.log(`   });`);
        console.log(`   await contract.grant_role('${newAdminAddress}', starknet.cairo.felt('ADMIN'));`);
        process.exit(1);
    }
    
    console.log(`\n📝 Using admin account: ${adminWithRole}`);
    console.log('   ⚠️  You need the PRIVATE KEY for this account to grant the role\n');
    console.log('💡 To grant the role manually:');
    console.log('   1. Get the private key for the admin account');
    console.log('   2. Update .env with that account temporarily');
    console.log('   3. Run this script again\n');
    console.log('   Or use this code snippet:');
    console.log(`   const adminAccount = new starknet.Account({`);
    console.log(`       provider,`);
    console.log(`       address: '${adminWithRole}',`);
    console.log(`       signer: '<PRIVATE_KEY>',`);
    console.log(`       cairoVersion: '1',`);
    console.log(`   });`);
    console.log(`   const contract = new starknet.Contract({`);
    console.log(`       abi: ROLE_STORE_ABI,`);
    console.log(`       address: '${ROLE_STORE_ADDRESS}',`);
    console.log(`       providerOrAccount: adminAccount,`);
    console.log(`   });`);
    console.log(`   await contract.grant_role('${newAdminAddress}', starknet.cairo.felt('ADMIN'));`);
}

grantAdminRole().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});



