const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
require('dotenv').config();

const accountName = process.argv[2] || 'myaccount';

console.log(`📋 Setting up admin account: ${accountName}\n`);

// Try to find sncast account file
function findAccountFile() {
    // Check if path is provided via environment variable
    if (process.env.SNCAST_ACCOUNT_FILE) {
        if (fs.existsSync(process.env.SNCAST_ACCOUNT_FILE)) {
            return process.env.SNCAST_ACCOUNT_FILE;
        }
    }
    
    const homeDir = os.homedir();
    const possiblePaths = [
        path.join(homeDir, '.starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
        path.join(homeDir, '.config', 'starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
    ];
    
    // Try WSL paths (if running from Windows)
    // Common WSL usernames to try
    const wslUsers = ['ahm', 'ubuntu', 'wsl', os.userInfo().username.toLowerCase()];
    for (const user of wslUsers) {
        // Try /mnt/c style path (if accessible)
        const wslPath1 = `/mnt/c/Users/${process.env.USERNAME || 'DELL'}/.starknet_accounts/starknet_open_zeppelin_accounts.json`;
        if (fs.existsSync(wslPath1)) {
            return wslPath1;
        }
        // Try \\wsl$ style path (Windows access to WSL)
        const wslPath2 = `\\\\wsl$\\Ubuntu\\home\\${user}\\.starknet_accounts\\starknet_open_zeppelin_accounts.json`;
        if (fs.existsSync(wslPath2)) {
            return wslPath2;
        }
        // Try direct WSL home path
        const wslPath3 = `\\\\wsl.localhost\\Ubuntu\\home\\${user}\\.starknet_accounts\\starknet_open_zeppelin_accounts.json`;
        if (fs.existsSync(wslPath3)) {
            return wslPath3;
        }
    }
    
    for (const accountPath of possiblePaths) {
        if (fs.existsSync(accountPath)) {
            return accountPath;
        }
    }
    return null;
}

function findSncast() {
    try {
        // Try which (Linux/WSL/Mac)
        const which = execSync('which sncast', { encoding: 'utf-8', stdio: 'pipe' }).trim();
        if (which) return 'sncast';
    } catch (e) {
        // Try where (Windows)
        try {
            const where = execSync('where sncast', { encoding: 'utf-8', stdio: 'pipe' }).trim();
            if (where) return 'sncast';
        } catch (e2) {
            // Not found
        }
    }
    return null;
}

try {
    let address, privateKey, deployed;
    
    // First, try to use sncast command
    const sncastCmd = findSncast();
    if (sncastCmd) {
        try {
            console.log('🔍 Using sncast to get account details...');
            const output = execSync(`${sncastCmd} account show --name ${accountName} --display-private-keys`, { 
                encoding: 'utf-8',
                stdio: 'pipe'
            });
            
            // Parse the output
            const addressMatch = output.match(/address:\s*(0x[a-fA-F0-9]+)/i);
            const privateKeyMatch = output.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
            const deployedMatch = output.match(/deployed:\s*(true|false)/i);
            
            if (addressMatch && privateKeyMatch) {
                address = addressMatch[1];
                privateKey = privateKeyMatch[1];
                deployed = deployedMatch ? deployedMatch[1].toLowerCase() === 'true' : false;
            }
        } catch (e) {
            console.log('⚠️  sncast command failed, trying to read account file directly...');
        }
    }
    
    // Fallback: read account file directly
    if (!address || !privateKey) {
        console.log('🔍 Reading account file directly...');
        const accountFile = findAccountFile();
        
        if (!accountFile) {
            console.log('\n❌ Could not find account file automatically.');
            console.log('\n📝 Options to fix this:');
            console.log('\n1. Set SNCAST_ACCOUNT_FILE environment variable:');
            console.log(`   set SNCAST_ACCOUNT_FILE=/home/ahm/.starknet_accounts/starknet_open_zeppelin_accounts.json`);
            console.log(`   npm run setup-account ${accountName}`);
            console.log('\n2. Or manually create/edit quickstart/admin/.env with:');
            console.log(`   ADMIN_ADDRESS=<account_address>`);
            console.log(`   ADMIN_KEY=<private_key>`);
            console.log('\n3. Or run from WSL:');
            console.log(`   cd /mnt/c/Users/DELL/ztarknet/quickstart/admin`);
            console.log(`   npm run setup-account ${accountName}`);
            console.log('\n💡 From your earlier output, the account file is at:');
            console.log('   /home/ahm/.starknet_accounts/starknet_open_zeppelin_accounts.json');
            console.log('\n   You can copy it to Windows or access it from WSL.');
            
            // Show account details from earlier output
            const knownAccounts = {
                'oracle_admin': {
                    address: '0x5be0f450ed5a69c4131f8c966da49d2579055baba7dd920c28c5ae94526cc3e',
                    deployed: true
                },
                'ztarknet': {
                    address: '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec',
                    deployed: true
                },
                'myaccount': {
                    address: '0x5966682c7b99e235f68ffeca45b3f62753ab5d71167a9963cd78c6c24be27ad',
                    deployed: false
                }
            };
            
            if (knownAccounts[accountName]) {
                console.log(`\n📋 Known account info for '${accountName}':`);
                console.log(`   Address: ${knownAccounts[accountName].address}`);
                console.log(`   Deployed: ${knownAccounts[accountName].deployed ? '✅ YES' : '❌ NO'}`);
                console.log(`\n   You still need the private key. Run from WSL:`);
                console.log(`   sncast account show --name ${accountName} --display-private-keys`);
            }
            
            process.exit(1);
        }
        
        console.log(`📂 Found account file: ${accountFile}`);
        const accountsData = JSON.parse(fs.readFileSync(accountFile, 'utf-8'));
        
        if (!accountsData[accountName]) {
            throw new Error(`Account '${accountName}' not found in ${accountFile}\n\nAvailable accounts: ${Object.keys(accountsData).join(', ')}`);
        }
        
        const account = accountsData[accountName];
        address = account.address;
        privateKey = account.private_key;
        deployed = account.deployed === true;
        
        if (!address || !privateKey) {
            throw new Error(`Account '${accountName}' is missing address or private_key in ${accountFile}`);
        }
    }
    
    console.log('✅ Account details:');
    console.log(`   Address: ${address}`);
    console.log(`   Deployed: ${deployed ? '✅ YES' : '❌ NO'}`);
    console.log(`   Private Key: ${privateKey.substring(0, 10)}...`);
    
    if (!deployed) {
        console.log('\n⚠️  WARNING: Account is not deployed!');
        console.log(`\n📝 To deploy the account, run:`);
        console.log(`   sncast account deploy --name ${accountName} --url https://ztarknet-madara.d.karnot.xyz`);
        console.log(`\n   Or use a different deployed account like 'oracle_admin' or 'ztarknet'`);
    }
    
    // Update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = '';
    
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf-8');
    }
    
    // Update or add ADMIN_ADDRESS and ADMIN_KEY
    const lines = envContent.split('\n');
    let updated = false;
    const newLines = lines.map(line => {
        if (line.startsWith('ADMIN_ADDRESS=')) {
            updated = true;
            return `ADMIN_ADDRESS=${address}`;
        }
        if (line.startsWith('ADMIN_KEY=')) {
            updated = true;
            return `ADMIN_KEY=${privateKey}`;
        }
        return line;
    });
    
    if (!updated || !lines.some(l => l.startsWith('ADMIN_ADDRESS='))) {
        newLines.push(`ADMIN_ADDRESS=${address}`);
    }
    if (!updated || !lines.some(l => l.startsWith('ADMIN_KEY='))) {
        newLines.push(`ADMIN_KEY=${privateKey}`);
    }
    
    // Remove empty lines at the end
    while (newLines[newLines.length - 1] === '') {
        newLines.pop();
    }
    
    fs.writeFileSync(envPath, newLines.join('\n') + '\n');
    
    console.log('\n✅ Updated quickstart/admin/.env with:');
    console.log(`   ADMIN_ADDRESS=${address}`);
    console.log(`   ADMIN_KEY=${privateKey.substring(0, 10)}...`);
    
    if (!deployed) {
        console.log('\n⚠️  Remember to deploy the account before running enable-market!');
    } else {
        console.log('\n✅ Account is deployed - you can now run: npm run enable-market');
    }
    
} catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) console.log('Output:', error.stdout);
    if (error.stderr) console.error('Error:', error.stderr);
    process.exit(1);
}

