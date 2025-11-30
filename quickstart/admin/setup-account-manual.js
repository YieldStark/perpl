const fs = require('fs');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(prompt) {
    return new Promise((resolve) => {
        rl.question(prompt, resolve);
    });
}

async function main() {
    console.log('📋 Manual Admin Account Setup\n');
    console.log('Enter your account details:\n');
    
    const address = await question('Admin Address (0x...): ');
    const privateKey = await question('Private Key (0x...): ');
    const deployed = await question('Is account deployed? (y/n, default: y): ');
    
    if (!address.startsWith('0x') || !privateKey.startsWith('0x')) {
        console.error('❌ Address and private key must start with 0x');
        process.exit(1);
    }
    
    const isDeployed = deployed.toLowerCase() !== 'n';
    
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
            return `ADMIN_ADDRESS=${address}`;
        }
        if (line.startsWith('ADMIN_KEY=')) {
            return `ADMIN_KEY=${privateKey}`;
        }
        return line;
    });
    
    if (!lines.some(l => l.startsWith('ADMIN_ADDRESS='))) {
        newLines.push(`ADMIN_ADDRESS=${address}`);
    }
    if (!lines.some(l => l.startsWith('ADMIN_KEY='))) {
        newLines.push(`ADMIN_KEY=${privateKey}`);
    }
    
    // Remove empty lines at the end
    while (newLines[newLines.length - 1] === '') {
        newLines.pop();
    }
    
    fs.writeFileSync(envPath, newLines.join('\n') + '\n');
    
    console.log('\n✅ Updated quickstart/admin/.env');
    console.log(`   ADMIN_ADDRESS=${address}`);
    console.log(`   ADMIN_KEY=${privateKey.substring(0, 10)}...`);
    
    if (!isDeployed) {
        console.log('\n⚠️  Remember to deploy the account before running enable-market!');
    } else {
        console.log('\n✅ You can now run: npm run enable-market');
    }
    
    rl.close();
}

main().catch(err => {
    console.error('❌ Error:', err.message);
    rl.close();
    process.exit(1);
});




