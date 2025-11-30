require('dotenv').config();
const readline = require('readline');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

// Known deployed accounts from quickstart
const KNOWN_ACCOUNTS = {
    'oracle_admin': {
        address: '0x5be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e',
        deployed: true,
        note: 'Already deployed ✅'
    },
    'ztarknet': {
        address: '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec',
        deployed: true,
        note: 'Already deployed ✅'
    }
};

async function main() {
    console.log('📋 Use Existing Account from Quickstart\n');
    console.log('Available accounts:');
    Object.entries(KNOWN_ACCOUNTS).forEach(([name, info]) => {
        console.log(`  ${name}: ${info.address} (${info.note})`);
    });
    console.log('\n⚠️  You need the PRIVATE KEY for the account.');
    console.log('   Get it by running from WSL:');
    console.log('   sncast account show --name <account_name> --display-private-keys\n');
    
    const accountName = await question('Enter account name (or press Enter to use oracle_admin): ');
    const selectedAccount = accountName.trim() || 'oracle_admin';
    
    if (!KNOWN_ACCOUNTS[selectedAccount]) {
        console.error(`❌ Unknown account: ${selectedAccount}`);
        console.log('Available accounts:', Object.keys(KNOWN_ACCOUNTS).join(', '));
        rl.close();
        process.exit(1);
    }
    
    const accountInfo = KNOWN_ACCOUNTS[selectedAccount];
    console.log(`\n✅ Selected account: ${selectedAccount}`);
    console.log(`   Address: ${accountInfo.address}`);
    console.log(`   Deployed: ${accountInfo.deployed ? '✅ YES' : '❌ NO'}\n`);
    
    if (!accountInfo.deployed) {
        console.error('❌ This account is not deployed. Please deploy it first or use a different account.');
        rl.close();
        process.exit(1);
    }
    
    const privateKey = await question('Enter private key (0x...): ');
    const privateKeyTrimmed = privateKey.trim();
    
    if (!privateKeyTrimmed.startsWith('0x')) {
        console.error('❌ Private key must start with 0x');
        rl.close();
        process.exit(1);
    }
    
    // Update .env file
    const fs = require('fs');
    const path = require('path');
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    const lines = envContent.split('\n');
    const newLines = lines.map(line => {
        if (line.startsWith('ADMIN_ADDRESS=')) {
            return `ADMIN_ADDRESS=${accountInfo.address}`;
        }
        if (line.startsWith('ADMIN_KEY=')) {
            return `ADMIN_KEY=${privateKeyTrimmed}`;
        }
        return line;
    });
    
    if (!lines.some(l => l.startsWith('ADMIN_ADDRESS='))) {
        newLines.push(`ADMIN_ADDRESS=${accountInfo.address}`);
    }
    if (!lines.some(l => l.startsWith('ADMIN_KEY='))) {
        newLines.push(`ADMIN_KEY=${privateKeyTrimmed}`);
    }
    
    while (newLines[newLines.length - 1] === '') {
        newLines.pop();
    }
    
    fs.writeFileSync(envPath, newLines.join('\n') + '\n');
    
    console.log('\n✅ Updated quickstart/admin/.env with:');
    console.log(`   ADMIN_ADDRESS=${accountInfo.address}`);
    console.log(`   ADMIN_KEY=${privateKeyTrimmed.substring(0, 20)}...`);
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npm run enable-market');
    
    rl.close();
}

main().catch(error => {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
});



