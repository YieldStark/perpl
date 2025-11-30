require('dotenv').config();
const starknet = require('starknet');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';

const provider = new starknet.RpcProvider({ nodeUrl: RPC_URL });

// RoleStore storage layout - admin is stored at a specific slot
// Based on: struct Storage { roles: Map<...>, admin: ContractAddress }
// admin is the second storage variable, so we need to calculate its slot

async function checkRoleStoreAdmin() {
    console.log('🔍 Checking RoleStore admin address\n');
    console.log(`   RoleStore: ${ROLE_STORE_ADDRESS}\n`);
    
    // Try to read the admin storage slot directly
    // In Cairo, storage variables are at sequential slots
    // roles Map is at slot 0, admin is at slot 1
    // Storage slot calculation: keccak(selector) + offset
    // For simple variables, it's just the keccak hash of the variable name
    
    try {
        // Calculate storage slot for 'admin' variable
        // In Cairo, storage slot = keccak(variable_name)
        const adminSelector = starknet.hash.starknetKeccak('admin');
        const adminAddress = await provider.getStorageAt(ROLE_STORE_ADDRESS, adminSelector);
        
        console.log('✅ Found admin address from storage:');
        console.log(`   ${adminAddress}\n`);
        
        // Check if this account has ADMIN role
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
        ];
        
        const contract = new starknet.Contract({
            abi: ROLE_STORE_ABI,
            address: ROLE_STORE_ADDRESS,
            providerOrAccount: provider,
        });
        
        const ADMIN_ROLE = starknet.cairo.felt('ADMIN');
        const hasRole = await provider.callContract({
            contractAddress: ROLE_STORE_ADDRESS,
            entrypoint: 'has_role',
            calldata: [adminAddress, ADMIN_ROLE],
        });
        
        console.log(`   Has ADMIN role: ${hasRole[0] !== 0n ? '✅ YES' : '❌ NO'}\n`);
        
        console.log('📋 To use this account, update .env:');
        console.log(`   ADMIN_ADDRESS=${adminAddress}`);
        console.log('   ADMIN_KEY=<private_key_for_above_address>');
        
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.log('\n💡 Alternative: Check the RoleStore deployment transaction');
        console.log('   The admin address was set in the constructor when RoleStore was deployed');
    }
}

checkRoleStoreAdmin().catch(error => {
    console.error('❌ Error:', error.message);
    process.exit(1);
});

