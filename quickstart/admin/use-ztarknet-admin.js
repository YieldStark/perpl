const fs = require('fs');
const path = require('path');

// Ztarknet account details (from contracts folder)
const ZTARKNET_ADDRESS = '0xaf0ec7edf5cfe4b63e230b9ec808956c41de0a54dcc9b0b808054230fcdfec';
const ZTARKNET_PRIVATE_KEY = '0x20a81d20d27d7e546aaa18474607fd3e00eeb28169d1f92f6984d768b374a7';

const envPath = path.join(__dirname, '.env');
let envContent = '';

if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
}

// Update or add ADMIN_ADDRESS and ADMIN_KEY
const lines = envContent.split('\n');
const newLines = lines.map(line => {
    if (line.startsWith('ADMIN_ADDRESS=')) {
        return `ADMIN_ADDRESS=${ZTARKNET_ADDRESS}`;
    }
    if (line.startsWith('ADMIN_KEY=')) {
        return `ADMIN_KEY=${ZTARKNET_PRIVATE_KEY}`;
    }
    return line;
});

if (!lines.some(l => l.startsWith('ADMIN_ADDRESS='))) {
    newLines.push(`ADMIN_ADDRESS=${ZTARKNET_ADDRESS}`);
}
if (!lines.some(l => l.startsWith('ADMIN_KEY='))) {
    newLines.push(`ADMIN_KEY=${ZTARKNET_PRIVATE_KEY}`);
}

// Remove empty lines at the end
while (newLines[newLines.length - 1] === '') {
    newLines.pop();
}

fs.writeFileSync(envPath, newLines.join('\n') + '\n');

console.log('✅ Updated quickstart/admin/.env to use ztarknet account:');
console.log(`   ADMIN_ADDRESS=${ZTARKNET_ADDRESS}`);
console.log(`   ADMIN_KEY=${ZTARKNET_PRIVATE_KEY.substring(0, 20)}...`);
console.log('\n📋 Next steps:');
console.log('   npm run enable-market');



