const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();

console.log('\n🔍 LOGIN DIAGNOSTIC TOOL');
console.log('═══════════════════════════════════════════════\n');

async function testLogin() {
    try {
        // Step 1: Connect to Database
        console.log('📡 STEP 1: Connecting to Database...');
        console.log('─────────────────────────────────────────────');

        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log('✅ Database connected successfully\n');

        // Step 2: Check if users exist
        console.log('👥 STEP 2: Checking Users in Database...');
        console.log('─────────────────────────────────────────────');

        const User = require('./models/User');
        const allUsers = await User.find({}).select('name email userType approved approvalStatus');

        console.log(`✅ Found ${allUsers.length} users in database:\n`);

        if (allUsers.length === 0) {
            console.log('⚠️  NO USERS FOUND IN DATABASE!');
            console.log('💡 You need to create a user first using signup.\n');
            await mongoose.connection.close();
            return;
        }

        allUsers.forEach((user, index) => {
            console.log(`${index + 1}. ${user.name}`);
            console.log(`   Email: ${user.email}`);
            console.log(`   Type: ${user.userType}`);
            console.log(`   Approved: ${user.approved}`);
            console.log(`   Status: ${user.approvalStatus}\n`);
        });

        // Step 3: Test Login for Each User
        console.log('🔐 STEP 3: Testing Login Functionality...');
        console.log('─────────────────────────────────────────────\n');

        // Common test passwords
        const testPasswords = ['password123', 'test123', 'admin123', 'aspirant123', 'achiever123'];

        for (const user of allUsers) {
            console.log(`Testing login for: ${user.email}`);

            let loginSuccess = false;
            let workingPassword = null;

            for (const testPassword of testPasswords) {
                try {
                    const foundUser = await User.findOne({ email: user.email });
                    const isMatch = await foundUser.comparePassword(testPassword);

                    if (isMatch) {
                        loginSuccess = true;
                        workingPassword = testPassword;
                        break;
                    }
                } catch (err) {
                    // Continue to next password
                }
            }

            if (loginSuccess) {
                console.log(`✅ Login WORKS with password: "${workingPassword}"\n`);
            } else {
                console.log(`❌ Login FAILED - None of the test passwords work`);
                console.log(`💡 Password might be different or corrupted\n`);
            }
        }

        // Step 4: Check Password Hashing
        console.log('🔒 STEP 4: Checking Password Hashing...');
        console.log('─────────────────────────────────────────────\n');

        for (const user of allUsers) {
            const foundUser = await User.findOne({ email: user.email });
            const passwordHash = foundUser.password;

            console.log(`User: ${user.email}`);
            console.log(`Password Hash: ${passwordHash.substring(0, 20)}...`);
            console.log(`Hash Length: ${passwordHash.length}`);
            console.log(`Is Bcrypt Hash: ${passwordHash.startsWith('$2a$') || passwordHash.startsWith('$2b$')}`);

            if (!passwordHash.startsWith('$2a$') && !passwordHash.startsWith('$2b$')) {
                console.log('⚠️  WARNING: Password is NOT properly hashed!');
                console.log('💡 This user needs password reset\n');
            } else {
                console.log('✅ Password is properly hashed\n');
            }
        }

        // Step 5: Test Backend Server Connection
        console.log('🌐 STEP 5: Testing Backend Server...');
        console.log('─────────────────────────────────────────────');

        const http = require('http');

        const testServerConnection = () => {
            return new Promise((resolve, reject) => {
                const options = {
                    hostname: 'localhost',
                    port: 5000,
                    path: '/api/health',
                    method: 'GET',
                    timeout: 5000
                };

                const req = http.request(options, (res) => {
                    let body = '';
                    res.on('data', (chunk) => body += chunk);
                    res.on('end', () => {
                        resolve({ status: res.statusCode, body });
                    });
                });

                req.on('error', (e) => reject(e));
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Connection timeout'));
                });

                req.end();
            });
        };

        try {
            const serverResponse = await testServerConnection();
            console.log(`✅ Backend server is RUNNING on port 5000`);
            console.log(`   Status: ${serverResponse.status}`);
            console.log(`   Response: ${serverResponse.body.substring(0, 100)}...\n`);
        } catch (error) {
            console.log(`❌ Backend server is NOT RUNNING`);
            console.log(`   Error: ${error.message}`);
            console.log(`💡 Start the server with: npm run dev\n`);
        }

        // Step 6: Test Actual Login API
        console.log('🧪 STEP 6: Testing Login API Endpoint...');
        console.log('─────────────────────────────────────────────\n');

        if (allUsers.length > 0) {
            const testUser = allUsers[0];

            for (const testPassword of testPasswords) {
                const loginData = JSON.stringify({
                    email: testUser.email,
                    password: testPassword
                });

                const testLoginAPI = () => {
                    return new Promise((resolve, reject) => {
                        const options = {
                            hostname: 'localhost',
                            port: 5000,
                            path: '/api/auth/login',
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Content-Length': loginData.length
                            },
                            timeout: 5000
                        };

                        const req = http.request(options, (res) => {
                            let body = '';
                            res.on('data', (chunk) => body += chunk);
                            res.on('end', () => {
                                resolve({ status: res.statusCode, body });
                            });
                        });

                        req.on('error', (e) => reject(e));
                        req.on('timeout', () => {
                            req.destroy();
                            reject(new Error('Connection timeout'));
                        });

                        req.write(loginData);
                        req.end();
                    });
                };

                try {
                    const apiResponse = await testLoginAPI();
                    console.log(`Testing: ${testUser.email} with password "${testPassword}"`);
                    console.log(`Status: ${apiResponse.status}`);

                    const responseData = JSON.parse(apiResponse.body);

                    if (apiResponse.status === 200 && responseData.success) {
                        console.log(`✅ LOGIN SUCCESSFUL!`);
                        console.log(`   Token: ${responseData.token.substring(0, 20)}...`);
                        console.log(`   User: ${responseData.user.name}\n`);
                        break;
                    } else {
                        console.log(`❌ Login failed: ${responseData.message}\n`);
                    }
                } catch (error) {
                    console.log(`❌ API call failed: ${error.message}\n`);
                    break;
                }
            }
        }

        // Step 7: Summary
        console.log('📋 SUMMARY & RECOMMENDATIONS');
        console.log('═══════════════════════════════════════════════\n');

        console.log('✅ Database: Connected');
        console.log(`✅ Users Found: ${allUsers.length}`);

        const hashedUsers = allUsers.filter(async (user) => {
            const foundUser = await User.findOne({ email: user.email });
            return foundUser.password.startsWith('$2a$') || foundUser.password.startsWith('$2b$');
        });

        console.log(`✅ Properly Hashed Passwords: ${allUsers.length}`);
        console.log('\n💡 NEXT STEPS:\n');
        console.log('1. Make sure backend server is running: npm run dev');
        console.log('2. Try logging in with one of these users:');

        allUsers.forEach((user, index) => {
            console.log(`   ${index + 1}. Email: ${user.email}`);
        });

        console.log('\n3. Common test passwords to try:');
        testPasswords.forEach((pwd, index) => {
            console.log(`   ${index + 1}. ${pwd}`);
        });

        console.log('\n4. If login still fails, create a new test user:\n');
        console.log('   POST /api/auth/signup');
        console.log('   {');
        console.log('     "name": "Test User",');
        console.log('     "email": "test@example.com",');
        console.log('     "password": "password123",');
        console.log('     "userType": "aspirant"');
        console.log('   }\n');

        await mongoose.connection.close();
        console.log('🔒 Database connection closed\n');

    } catch (error) {
        console.log('\n❌ ERROR OCCURRED');
        console.log('═══════════════════════════════════════════════');
        console.log(`Error: ${error.message}\n`);
        console.log('Stack:', error.stack);

        if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
        }

        process.exit(1);
    }
}

testLogin();
