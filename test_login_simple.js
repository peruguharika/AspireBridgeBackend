const http = require('http');

console.log('\n🧪 TESTING LOGIN API...\n');

const testAccounts = [
    { email: 'test.aspirant.1767595010039@example.com', password: 'password123', name: 'Test Aspirant' },
    { email: 'test.asp.1767595093927@test.com', password: 'test123', name: 'Test Asp' },
    { email: 'duplicate.test@example.com', password: 'password123', name: 'Duplicate Test' }
];

async function testLogin(account) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            email: account.email,
            password: account.password
        });

        const options = {
            hostname: 'localhost',
            port: 5000,
            path: '/api/auth/login',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => {
                resolve({ status: res.statusCode, body, account });
            });
        });

        req.on('error', (e) => reject(e));
        req.write(data);
        req.end();
    });
}

async function runTests() {
    console.log('Testing login with multiple accounts...\n');
    console.log('═══════════════════════════════════════════════\n');

    for (const account of testAccounts) {
        try {
            console.log(`📧 Testing: ${account.name}`);
            console.log(`   Email: ${account.email}`);
            console.log(`   Password: ${account.password}`);

            const result = await testLogin(account);

            console.log(`   Status: ${result.status}`);

            if (result.status === 200) {
                const response = JSON.parse(result.body);
                console.log(`   ✅ LOGIN SUCCESSFUL!`);
                console.log(`   Token: ${response.token.substring(0, 30)}...`);
                console.log(`   User: ${response.user.name} (${response.user.userType})`);
                console.log(`   User ID: ${response.user.id}\n`);
            } else {
                const response = JSON.parse(result.body);
                console.log(`   ❌ LOGIN FAILED: ${response.message}\n`);
            }

        } catch (error) {
            console.log(`   ❌ ERROR: ${error.message}\n`);
        }
    }

    console.log('═══════════════════════════════════════════════');
    console.log('\n✅ Login testing complete!\n');
}

runTests();
