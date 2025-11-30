const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const accountName = process.argv[2] || 'ztarknet';

console.log(`🔍 Looking for private key for account: ${accountName}\n`);

// Try multiple methods to get the private key

// Method 1: Try sncast command (if available)
console.log('Method 1: Trying sncast command...');
try {
    const output = execSync(`sncast account show --name ${accountName} --display-private-keys`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        shell: true
    });
    
    const privateKeyMatch = output.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
    if (privateKeyMatch) {
        console.log('✅ Found private key via sncast:');
        console.log(`   ${privateKeyMatch[1]}\n`);
        console.log('📋 Add this to quickstart/admin/.env:');
        console.log(`   ADMIN_ADDRESS=0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec`);
        console.log(`   ADMIN_KEY=${privateKeyMatch[1]}`);
        process.exit(0);
    }
} catch (e) {
    console.log('   ❌ sncast not available or account not found\n');
}

// Method 2: Try reading account file directly
console.log('Method 2: Trying to read account file directly...');

function findAccountFile() {
    const homeDir = os.homedir();
    
    // Common account file locations
    const possiblePaths = [
        // Standard locations
        path.join(homeDir, '.starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
        path.join(homeDir, '.config', 'starknet_accounts', 'starknet_open_zeppelin_accounts.json'),
        // sncast location
        path.join(homeDir, '.config', 'sncast', 'accounts.toml'),
        // WSL paths (if accessible from Windows)
        `/mnt/c/Users/${process.env.USERNAME || 'DELL'}/.starknet_accounts/starknet_open_zeppelin_accounts.json`,
    ];
    
    // Try WSL paths
    const wslUsers = ['ahm', 'ubuntu', 'wsl'];
    for (const user of wslUsers) {
        possiblePaths.push(`/mnt/c/Users/${process.env.USERNAME || 'DELL'}/.starknet_accounts/starknet_open_zeppelin_accounts.json`);
        possiblePaths.push(`\\\\wsl$\\Ubuntu\\home\\${user}\\.starknet_accounts\\starknet_open_zeppelin_accounts.json`);
        possiblePaths.push(`\\\\wsl.localhost\\Ubuntu\\home\\${user}\\.starknet_accounts\\starknet_open_zeppelin_accounts.json`);
    }
    
    for (const accountPath of possiblePaths) {
        if (fs.existsSync(accountPath)) {
            console.log(`   ✅ Found account file: ${accountPath}`);
            return accountPath;
        }
    }
    
    return null;
}

const accountFile = findAccountFile();

if (accountFile) {
    try {
        const content = fs.readFileSync(accountFile, 'utf-8');
        
        // Try JSON format first
        if (accountFile.endsWith('.json')) {
            const accounts = JSON.parse(content);
            if (accounts[accountName]) {
                const account = accounts[accountName];
                if (account.private_key) {
                    console.log('✅ Found private key in account file:');
                    console.log(`   ${account.private_key}\n`);
                    console.log('📋 Add this to quickstart/admin/.env:');
                    console.log(`   ADMIN_ADDRESS=0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec`);
                    console.log(`   ADMIN_KEY=${account.private_key}`);
                    process.exit(0);
                }
            } else {
                console.log(`   ⚠️  Account '${accountName}' not found in file`);
                console.log(`   Available accounts: ${Object.keys(accounts).join(', ')}`);
            }
        } else if (accountFile.endsWith('.toml')) {
            // Try TOML format (sncast format)
            console.log('   📝 Found TOML file - parsing...');
            const lines = content.split('\n');
            let inAccount = false;
            let currentAccount = '';
            let privateKey = '';
            
            for (const line of lines) {
                if (line.trim().startsWith('[') && line.includes(accountName)) {
                    inAccount = true;
                    currentAccount = accountName;
                } else if (line.trim().startsWith('[')) {
                    inAccount = false;
                } else if (inAccount && line.includes('private_key')) {
                    const match = line.match(/private_key\s*=\s*["']?([^"'\s]+)["']?/);
                    if (match) {
                        privateKey = match[1];
                    }
                }
            }
            
            if (privateKey) {
                console.log('✅ Found private key in TOML file:');
                console.log(`   ${privateKey}\n`);
                console.log('📋 Add this to quickstart/admin/.env:');
                console.log(`   ADMIN_ADDRESS=0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec`);
                console.log(`   ADMIN_KEY=${privateKey}`);
                process.exit(0);
            }
        }
    } catch (error) {
        console.log(`   ❌ Error reading file: ${error.message}`);
    }
} else {
    console.log('   ❌ Account file not found in common locations\n');
}

// Method 3: Manual instructions
console.log('Method 3: Manual retrieval\n');
console.log('📝 To get your private key manually:\n');
console.log('Option A: From WSL (if account was created there):');
console.log(`   sncast account show --name ${accountName} --display-private-keys\n`);
console.log('Option B: Check account file location:');
console.log('   Windows: C:\\Users\\DELL\\.starknet_accounts\\starknet_open_zeppelin_accounts.json');
console.log('   WSL: /home/ahm/.starknet_accounts/starknet_open_zeppelin_accounts.json');
console.log('   Or: ~/.config/sncast/accounts.toml\n');
console.log('Option C: If you lost the private key:');
console.log('   You\'ll need to create a new account or use a different existing account.\n');
console.log('💡 Quick fix - Use oracle_admin instead:');
console.log('   npm run use-existing');
console.log('   (then enter: oracle_admin)');



