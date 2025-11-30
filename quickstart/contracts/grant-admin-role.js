// Grant ADMIN role using ztarknet account (run from contracts folder)
// Usage: node grant-admin-role.js <new_admin_address>

const starknet = require('starknet');
const { execSync } = require('child_process');

const RPC_URL = 'https://ztarknet-madara.d.karnot.xyz';
const ROLE_STORE_ADDRESS = '0x005cd9ac7159f8b1c7e4e7994effe29c2e42305f26cfbe948c51826082b16819';
const ZTARKNET_ADDRESS = '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec';

const newAdminAddress = process.argv[2];

if (!newAdminAddress) {
    console.error('Usage: node grant-admin-role.js <new_admin_address>');
    console.error('Example: node grant-admin-role.js 0x6ea65f11fc62023916d34c517bc2deaf15024bf5f851209741b34fd1afd7bef');
    process.exit(1);
}

// Try to use sncast directly (simplest approach)
console.log('🔐 Granting ADMIN role using ztarknet account\n');
console.log(`   New Admin: ${newAdminAddress}`);
console.log(`   Using: ztarknet account`);
console.log(`   RoleStore: ${ROLE_STORE_ADDRESS}\n`);

try {
    console.log('📤 Getting ztarknet account details...\n');
    
    // Get account details first
    const accountInfo = execSync('sncast account show --name ztarknet --display-private-keys', {
        encoding: 'utf-8',
        stdio: 'pipe'
    });
    
    const addrMatch = accountInfo.match(/address:\s*(0x[a-fA-F0-9]+)/i);
    const keyMatch = accountInfo.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
    
    if (!addrMatch || !keyMatch) {
        throw new Error('Could not parse ztarknet account details');
    }
    
    const ztarknetAddr = addrMatch[1];
    const ztarknetKey = keyMatch[1];
    
    console.log(`   Using account: ${ztarknetAddr}\n`);
    console.log('📤 Calling grant_role via sncast...\n');
    
    // Convert 'ADMIN' to felt252: 'ADMIN' = 0x41444d494e
    const ADMIN_ROLE = '0x41444d494e';
    
    execSync(`sncast invoke \
        --contract-address ${ROLE_STORE_ADDRESS} \
        --function grant_role \
        --calldata ${newAdminAddress} ${ADMIN_ROLE} \
        --url ${RPC_URL} \
        --private-key ${ztarknetKey} \
        --account-address ${ztarknetAddr}`, {
        stdio: 'inherit',
        shell: true
    });
    
    console.log('\n✅ ADMIN role granted successfully!');
    console.log('   New admin can now run: npm run enable-market (from admin folder)');
    
} catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\n💡 Alternative: Use the interactive script from admin folder:');
    console.log('   cd ../admin');
    console.log('   npm run grant-role-simple');
    console.log('   (then enter ztarknet address and private key)');
    process.exit(1);
}

