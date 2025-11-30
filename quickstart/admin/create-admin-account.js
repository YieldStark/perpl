const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const accountName = process.argv[2] || 'admin';

console.log(`🔧 Creating and deploying admin account: ${accountName}\n`);

// Check if sncast is available
function findSncast() {
    // First, try to run sncast directly (most reliable)
    // Use shell: true to get proper PATH from the environment
    try {
        execSync('sncast --version', { encoding: 'utf-8', stdio: 'pipe', shell: true });
        return 'sncast';
    } catch (e) {
        // Try which (Linux/WSL/Mac)
        try {
            execSync('which sncast', { encoding: 'utf-8', stdio: 'pipe' });
            return 'sncast';
        } catch (e2) {
            // Try where (Windows)
            try {
                execSync('where sncast', { encoding: 'utf-8', stdio: 'pipe' });
                return 'sncast';
            } catch (e3) {
                // Try common installation paths
                const commonPaths = [
                    '/usr/local/bin/sncast',
                    '/usr/bin/sncast',
                    path.join(process.env.HOME || process.env.USERPROFILE || '', '.cargo', 'bin', 'sncast'),
                ];
                
                for (const sncastPath of commonPaths) {
                    if (fs.existsSync(sncastPath)) {
                        return sncastPath;
                    }
                }
                
                return null;
            }
        }
    }
}

const sncastCmd = findSncast();
if (!sncastCmd) {
    console.error('❌ sncast not found. Please install it first:');
    console.error('   https://foundry-rs.github.io/starknet-foundry/getting_started/installation.html');
    console.error('\n💡 If sncast is installed but not found, try:');
    console.error('   - Running from the same terminal where sncast works');
    console.error('   - Adding sncast to your PATH');
    process.exit(1);
}

console.log(`✅ Found sncast: ${sncastCmd}\n`);

const networkUrl = process.env.STARKNET_RPC_URL || 'https://ztarknet-madara.d.karnot.xyz';

try {
    console.log('📝 Step 1: Creating account...');
    
    // Create account
    execSync(`${sncastCmd} account create --name ${accountName} --add-profile`, {
        stdio: 'inherit',
        shell: true,
        env: {
            ...process.env,
            STARKNET_RPC_URL: networkUrl
        }
    });
    
    console.log('\n✅ Account created successfully!\n');
    
    console.log('📝 Step 2: Getting account details...');
    
    // Get account details
    const output = execSync(`${sncastCmd} account show --name ${accountName} --display-private-keys`, {
        encoding: 'utf-8',
        stdio: 'pipe',
        shell: true
    });
    
    // Parse the output
    const addressMatch = output.match(/address:\s*(0x[a-fA-F0-9]+)/i);
    const privateKeyMatch = output.match(/private key:\s*(0x[a-fA-F0-9]+)/i);
    
    if (!addressMatch || !privateKeyMatch) {
        console.error('❌ Could not parse account information');
        console.log('Raw output:', output);
        process.exit(1);
    }
    
    const address = addressMatch[1];
    const privateKey = privateKeyMatch[1];
    
    console.log('✅ Account details:');
    console.log(`   Address: ${address}`);
    console.log(`   Private Key: ${privateKey.substring(0, 10)}...`);
    
    console.log('\n📝 Step 3: Deploying account to network...');
    console.log(`   Network: ${networkUrl}\n`);
    
    // Deploy account
    try {
        execSync(`${sncastCmd} account deploy --name ${accountName} --url ${networkUrl}`, {
            stdio: 'inherit',
            shell: true
        });
        console.log('\n✅ Account deployed successfully!\n');
    } catch (deployError) {
        console.error('\n⚠️  Deployment failed. This might be because:');
        console.error('   1. The account needs funding first');
        console.error('   2. Network connection issues');
        console.error('\nYou can deploy manually later with:');
        console.error(`   sncast account deploy --name ${accountName} --url ${networkUrl}`);
        console.error('\nThe account details have been saved to .env anyway.');
    }
    
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
    
    console.log('✅ Updated quickstart/admin/.env with:');
    console.log(`   ADMIN_ADDRESS=${address}`);
    console.log(`   ADMIN_KEY=${privateKey.substring(0, 10)}...`);
    
    console.log('\n📋 Next steps:');
    console.log('   1. Fund the account (if not already funded)');
    console.log('   2. Grant ADMIN role to this account (if needed)');
    console.log('   3. Run: npm run enable-market');
    
} catch (error) {
    console.error('❌ Error:', error.message);
    if (error.stdout) console.log('Output:', error.stdout);
    if (error.stderr) console.error('Error:', error.stderr);
    process.exit(1);
}

