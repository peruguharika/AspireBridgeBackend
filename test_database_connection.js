const mongoose = require('mongoose');
const NetworkChecker = require('./utils/networkChecker');
require('dotenv').config();

console.log('\n🔍 DATABASE CONNECTION DIAGNOSTIC TOOL');
console.log('=====================================\n');

async function testDatabaseConnection() {
    try {
        // Step 1: Check Internet Connectivity
        console.log('📡 STEP 1: Checking Internet Connectivity...');
        console.log('─────────────────────────────────────────────');

        const diagnostics = await NetworkChecker.runDiagnostics();

        if (!diagnostics) {
            console.log('❌ No internet connection detected!');
            console.log('⚠️  DATABASE REQUIRES INTERNET CONNECTION');
            console.log('💡 Please connect to internet and try again.\n');
            return;
        }

        console.log('\n✅ Internet connection detected!\n');

        // Step 2: Check MongoDB URI Configuration
        console.log('🔧 STEP 2: Checking MongoDB Configuration...');
        console.log('─────────────────────────────────────────────');

        const mongoUri = process.env.MONGODB_URI;

        if (!mongoUri) {
            console.log('❌ MONGODB_URI not found in .env file!');
            console.log('💡 Please add MONGODB_URI to your .env file\n');
            return;
        }

        // Parse MongoDB URI to show connection details (without password)
        const uriParts = mongoUri.match(/mongodb\+srv:\/\/([^:]+):([^@]+)@([^\/]+)\/([^?]+)/);
        if (uriParts) {
            console.log('✅ MongoDB URI configured:');
            console.log(`   📌 Username: ${uriParts[1]}`);
            console.log(`   📌 Host: ${uriParts[3]}`);
            console.log(`   📌 Database: ${uriParts[4]}`);
            console.log(`   📌 Password: ${'*'.repeat(10)} (hidden)`);
        }

        // Step 3: Test DNS Resolution for MongoDB Atlas
        console.log('\n🌐 STEP 3: Testing MongoDB Atlas DNS Resolution...');
        console.log('─────────────────────────────────────────────');

        const mongoCheck = await NetworkChecker.checkMongoDBConnectivity();
        console.log(`📊 MongoDB Hosts Reachable: ${mongoCheck.reachableHosts}/${mongoCheck.totalHosts}`);
        console.log(`📊 Connectivity: ${mongoCheck.percentage}%`);

        if (mongoCheck.percentage < 50) {
            console.log('⚠️  Poor MongoDB connectivity detected!');
            console.log('💡 Recommendations:');
            console.log('   - Check your firewall settings');
            console.log('   - Try using a different network (mobile hotspot)');
            console.log('   - Verify MongoDB Atlas Network Access settings\n');
        } else {
            console.log('✅ Good MongoDB Atlas connectivity!\n');
        }

        // Step 4: Attempt Actual Database Connection
        console.log('🔌 STEP 4: Attempting Database Connection...');
        console.log('─────────────────────────────────────────────');
        console.log('⏳ Connecting to MongoDB Atlas...');

        const connectionOptions = {
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 15000,
            connectTimeoutMS: 15000,
            socketTimeoutMS: 15000,
        };

        await mongoose.connect(mongoUri, connectionOptions);

        console.log('✅ Successfully connected to MongoDB!');
        console.log(`📊 Database Name: ${mongoose.connection.name}`);
        console.log(`📊 Connection State: ${getConnectionState(mongoose.connection.readyState)}`);
        console.log(`📊 Host: ${mongoose.connection.host}`);

        // Step 5: Test Database Operations
        console.log('\n🧪 STEP 5: Testing Database Operations...');
        console.log('─────────────────────────────────────────────');

        // List collections
        const collections = await mongoose.connection.db.listCollections().toArray();
        console.log(`✅ Found ${collections.length} collections in database:`);
        collections.forEach((col, index) => {
            console.log(`   ${index + 1}. ${col.name}`);
        });

        // Test a simple query (count documents in a collection)
        if (collections.length > 0) {
            const firstCollection = collections[0].name;
            const count = await mongoose.connection.db.collection(firstCollection).countDocuments();
            console.log(`\n✅ Sample Query Test: ${firstCollection} has ${count} documents`);
        }

        // Step 6: Final Summary
        console.log('\n📋 FINAL SUMMARY');
        console.log('═════════════════════════════════════════════');
        console.log('✅ Internet Connection: WORKING');
        console.log('✅ MongoDB Configuration: VALID');
        console.log('✅ DNS Resolution: WORKING');
        console.log('✅ Database Connection: SUCCESSFUL');
        console.log('✅ Database Operations: FUNCTIONAL');
        console.log('\n🎉 ALL CHECKS PASSED!');
        console.log('💡 Your database is properly configured and requires internet connection to work.\n');

        // Close connection
        await mongoose.connection.close();
        console.log('🔒 Connection closed gracefully.\n');

    } catch (error) {
        console.log('\n❌ DATABASE CONNECTION FAILED!');
        console.log('═════════════════════════════════════════════');
        console.log(`Error: ${error.message}\n`);

        // Provide specific error guidance
        if (error.message.includes('ENOTFOUND') || error.message.includes('getaddrinfo')) {
            console.log('🔍 Issue: DNS Resolution Failed');
            console.log('💡 Solutions:');
            console.log('   1. Check your internet connection');
            console.log('   2. Verify DNS settings');
            console.log('   3. Try using a different network (mobile hotspot)');
            console.log('   4. Check if MongoDB Atlas is accessible from your region\n');
        } else if (error.message.includes('authentication failed')) {
            console.log('🔍 Issue: Authentication Failed');
            console.log('💡 Solutions:');
            console.log('   1. Verify username and password in .env file');
            console.log('   2. Check MongoDB Atlas user credentials');
            console.log('   3. Ensure database user has proper permissions\n');
        } else if (error.message.includes('IP') || error.message.includes('whitelist') || error.message.includes('not allowed')) {
            console.log('🔍 Issue: IP Address Not Whitelisted');
            console.log('💡 Solutions:');
            console.log('   1. Add your current IP to MongoDB Atlas Network Access');
            console.log('   2. Or allow access from anywhere (0.0.0.0/0) for testing');
            console.log(`   3. Your current IP: ${diagnostics?.ip || 'Unknown'}\n`);
        } else if (error.message.includes('timeout')) {
            console.log('🔍 Issue: Connection Timeout');
            console.log('💡 Solutions:');
            console.log('   1. Check your internet speed and stability');
            console.log('   2. Try using a different network');
            console.log('   3. Check firewall/proxy settings');
            console.log('   4. Verify MongoDB Atlas is not experiencing downtime\n');
        } else {
            console.log('🔍 Issue: Unknown Error');
            console.log('💡 Please check the error message above for more details.\n');
        }

        console.log('⚠️  IMPORTANT: This database REQUIRES an active internet connection!');
        console.log('   MongoDB Atlas is a cloud-hosted database service.\n');

        process.exit(1);
    }
}

function getConnectionState(state) {
    const states = {
        0: 'Disconnected',
        1: 'Connected',
        2: 'Connecting',
        3: 'Disconnecting'
    };
    return states[state] || 'Unknown';
}

// Run the test
testDatabaseConnection();
