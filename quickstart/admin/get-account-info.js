const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('📋 Getting account information from sncast...\n');

try {
    // Try to list accounts
    const output = execSync('sncast account list', { encoding: 'utf-8' });
    console.log('Available accounts:');
    console.log(output);
    
    // Try to get the default account from snfoundry.toml
    const snfoundryPath = path.join(__dirname, '..', 'snfoundry.toml');
    if (fs.existsSync(snfoundryPath)) {
        const snfoundryContent = fs.readFileSync(snfoundryPath, 'utf-8');
        const accountMatch = snfoundryContent.match(/account\s*=\s*"([^"]+)"/);
        if (accountMatch) {
            const accountName = accountMatch[1];
            console.log(`\n📌 Default account from snfoundry.toml: ${accountName}`);
            console.log('\nTo get account details, run:');
            console.log(`  sncast account show --name ${accountName}`);
        }
    }
    
    console.log('\n💡 To use an account in the admin scripts:');
    console.log('   1. Get the account address and private key');
    console.log('   2. Add them to quickstart/admin/.env:');
    console.log('      ADMIN_ADDRESS=0x...');
    console.log('      ADMIN_KEY=0x...');
    console.log('\n⚠️  Note: Make sure the account is DEPLOYED on the network!');
    console.log('   If not deployed, run: sncast account deploy --name <account_name>');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Alternative: Check your sncast config manually');
    console.log('   Accounts are stored in: ~/.config/sncast/accounts.toml');
    console.log('   Or run: sncast account list');
}




