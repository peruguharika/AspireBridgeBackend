const https = require('https');
const dns = require('dns');

class NetworkChecker {
  
  // Check current public IP address
  static async getCurrentIP() {
    try {
      return new Promise((resolve, reject) => {
        const req = https.get('https://api.ipify.org?format=json', (res) => {
          let data = '';
          res.on('data', (chunk) => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed.ip);
            } catch (e) {
              reject(e);
            }
          });
        });
        req.on('error', reject);
        req.setTimeout(5000, () => {
          req.destroy();
          reject(new Error('IP check timeout'));
        });
      });
    } catch (error) {
      return 'Unknown';
    }
  }

  // Check if MongoDB Atlas is reachable
  static async checkMongoDBConnectivity() {
    return new Promise((resolve) => {
      const mongoHosts = [
        'cluster0.tzuuknm.mongodb.net',
        'ac-plz7wpe-shard-00-00.tzuuknm.mongodb.net',
        'ac-plz7wpe-shard-00-01.tzuuknm.mongodb.net',
        'ac-plz7wpe-shard-00-02.tzuuknm.mongodb.net'
      ];

      let resolved = 0;
      let reachable = 0;

      mongoHosts.forEach(host => {
        dns.lookup(host, (err) => {
          resolved++;
          if (!err) reachable++;
          
          if (resolved === mongoHosts.length) {
            resolve({
              totalHosts: mongoHosts.length,
              reachableHosts: reachable,
              connectivity: reachable > 0 ? 'partial' : 'none',
              percentage: Math.round((reachable / mongoHosts.length) * 100)
            });
          }
        });
      });
    });
  }

  // Comprehensive network diagnostic
  static async runDiagnostics() {
    console.log('\n🔍 NETWORK DIAGNOSTICS');
    console.log('======================');

    try {
      // Check current IP
      const currentIP = await this.getCurrentIP();
      console.log(`🌐 Current Public IP: ${currentIP}`);

      // Check MongoDB connectivity
      const mongoCheck = await this.checkMongoDBConnectivity();
      console.log(`📡 MongoDB Atlas Connectivity: ${mongoCheck.percentage}% (${mongoCheck.reachableHosts}/${mongoCheck.totalHosts} hosts)`);

      // Network type detection (basic)
      const networkType = this.detectNetworkType(currentIP);
      console.log(`🔗 Network Type: ${networkType}`);

      // Recommendations
      console.log('\n💡 RECOMMENDATIONS:');
      if (mongoCheck.percentage < 50) {
        console.log('   ❌ Poor MongoDB connectivity detected');
        console.log('   🔄 Try switching to mobile hotspot');
        console.log('   🛡️  Check firewall/proxy settings');
      } else {
        console.log('   ✅ Good MongoDB connectivity');
      }

      return {
        ip: currentIP,
        mongoConnectivity: mongoCheck,
        networkType: networkType,
        recommendations: mongoCheck.percentage < 50 ? 'switch_network' : 'good'
      };

    } catch (error) {
      console.error('❌ Network diagnostics failed:', error.message);
      return null;
    }
  }

  // Basic network type detection
  static detectNetworkType(ip) {
    if (!ip || ip === 'Unknown') return 'Unknown';
    
    // This is a basic detection - in reality, you'd need more sophisticated methods
    if (ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
      return 'Private/NAT';
    }
    
    // Check common mobile carrier IP ranges (simplified)
    const mobileRanges = ['49.', '117.', '106.', '27.'];
    if (mobileRanges.some(range => ip.startsWith(range))) {
      return 'Likely Mobile';
    }
    
    return 'Public/Ethernet';
  }

  // Test specific MongoDB Atlas connection
  static async testMongoConnection(connectionString) {
    const mongoose = require('mongoose');
    
    try {
      console.log('🧪 Testing MongoDB connection...');
      
      const testConnection = await mongoose.createConnection(connectionString, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 10000,
      });

      await testConnection.close();
      console.log('✅ MongoDB connection test successful');
      return true;

    } catch (error) {
      console.log('❌ MongoDB connection test failed:', error.message);
      
      if (error.message.includes('IP') || error.message.includes('whitelist')) {
        console.log('🚨 IP whitelist issue detected');
        console.log('📋 Add your IP to MongoDB Atlas Network Access');
      }
      
      return false;
    }
  }
}

module.exports = NetworkChecker;