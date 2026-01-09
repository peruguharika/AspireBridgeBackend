const Razorpay = require('razorpay');
const Settlement = require('../models/Settlement');
const Wallet = require('../models/Wallet');

class RazorpaySettlementService {
  constructor() {
    this.razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });
  }

  /**
   * Fetch settlements from Razorpay and sync with our database
   */
  async syncSettlements() {
    try {
      console.log('🔄 Syncing Razorpay settlements...');
      
      // Get settlements from Razorpay (last 30 days)
      const fromDate = new Date();
      fromDate.setDate(fromDate.getDate() - 30);
      
      const settlements = await this.razorpay.settlements.all({
        from: Math.floor(fromDate.getTime() / 1000),
        to: Math.floor(Date.now() / 1000),
        count: 100
      });

      console.log(`📊 Found ${settlements.items.length} settlements from Razorpay`);

      for (const settlement of settlements.items) {
        await this.processSettlement(settlement);
      }

      console.log('✅ Settlement sync completed');
      return settlements.items.length;

    } catch (error) {
      console.error('❌ Settlement sync error:', error);
      throw error;
    }
  }

  /**
   * Process individual settlement from Razorpay
   */
  async processSettlement(razorpaySettlement) {
    try {
      // Check if settlement already exists
      const existingSettlement = await Settlement.findOne({ 
        settlementId: razorpaySettlement.id 
      });

      if (existingSettlement) {
        // Update existing settlement if status changed
        if (existingSettlement.status !== razorpaySettlement.status) {
          existingSettlement.status = razorpaySettlement.status;
          existingSettlement.processedAt = razorpaySettlement.status === 'processed' 
            ? new Date(razorpaySettlement.processed_at * 1000) 
            : null;
          existingSettlement.utr = razorpaySettlement.utr || existingSettlement.utr;
          await existingSettlement.save();
          
          console.log(`🔄 Updated settlement ${razorpaySettlement.id} status: ${razorpaySettlement.status}`);
        }
        return existingSettlement;
      }

      // Get admin wallet
      const adminWallet = await Wallet.findOne({ userType: 'admin' });
      if (!adminWallet) {
        console.error('❌ Admin wallet not found for settlement');
        return null;
      }

      // Create new settlement record
      const settlement = new Settlement({
        settlementId: razorpaySettlement.id,
        amount: razorpaySettlement.amount / 100, // Convert from paise to rupees
        fees: razorpaySettlement.fees / 100,
        tax: razorpaySettlement.tax / 100,
        netAmount: (razorpaySettlement.amount - razorpaySettlement.fees - razorpaySettlement.tax) / 100,
        status: razorpaySettlement.status,
        settlementDate: new Date(razorpaySettlement.created_at * 1000),
        processedAt: razorpaySettlement.status === 'processed' 
          ? new Date(razorpaySettlement.processed_at * 1000) 
          : null,
        utr: razorpaySettlement.utr,
        adminWalletId: adminWallet._id,
        webhookData: razorpaySettlement
      });

      await settlement.save();

      // If settlement is processed, update admin wallet
      if (razorpaySettlement.status === 'processed') {
        await this.updateAdminWalletForSettlement(settlement);
      }

      console.log(`✅ Created settlement record: ${razorpaySettlement.id} - ₹${settlement.netAmount}`);
      return settlement;

    } catch (error) {
      console.error(`❌ Error processing settlement ${razorpaySettlement.id}:`, error);
      throw error;
    }
  }

  /**
   * Update admin wallet when settlement is processed
   */
  async updateAdminWalletForSettlement(settlement) {
    try {
      const adminWallet = await Wallet.findById(settlement.adminWalletId);
      if (!adminWallet) {
        console.error('❌ Admin wallet not found');
        return;
      }

      // Add settlement transaction to admin wallet
      adminWallet.transactions.push({
        type: 'debit',
        amount: settlement.netAmount,
        source: 'admin-fee',
        description: `Razorpay settlement processed - UTR: ${settlement.utr}`,
        timestamp: settlement.processedAt || new Date(),
        razorpayTransactionId: settlement.settlementId
      });

      // Update total withdrawn (money that went to bank)
      adminWallet.totalWithdrawn += settlement.netAmount;

      await adminWallet.save();

      console.log(`💰 Admin wallet updated for settlement: ₹${settlement.netAmount} transferred to bank`);

    } catch (error) {
      console.error('❌ Error updating admin wallet for settlement:', error);
      throw error;
    }
  }

  /**
   * Get settlement status for admin dashboard
   */
  async getSettlementSummary() {
    try {
      const settlements = await Settlement.find().sort({ settlementDate: -1 });
      
      const summary = {
        totalSettlements: settlements.length,
        totalAmount: settlements.reduce((sum, s) => sum + s.amount, 0),
        totalFees: settlements.reduce((sum, s) => sum + s.fees + s.tax, 0),
        totalNetAmount: settlements.reduce((sum, s) => sum + s.netAmount, 0),
        processedSettlements: settlements.filter(s => s.status === 'processed').length,
        pendingSettlements: settlements.filter(s => s.status === 'created').length,
        recentSettlements: settlements.slice(0, 10)
      };

      return summary;

    } catch (error) {
      console.error('❌ Error getting settlement summary:', error);
      throw error;
    }
  }

  /**
   * Handle Razorpay settlement webhook
   */
  async handleSettlementWebhook(webhookData) {
    try {
      console.log('📡 Processing settlement webhook:', webhookData.event);

      if (webhookData.event === 'settlement.processed') {
        const settlement = webhookData.payload.settlement.entity;
        await this.processSettlement(settlement);
        
        console.log(`✅ Settlement webhook processed: ${settlement.id}`);
        return { success: true, message: 'Settlement webhook processed' };
      }

      return { success: true, message: 'Webhook event not handled' };

    } catch (error) {
      console.error('❌ Settlement webhook error:', error);
      throw error;
    }
  }
}

module.exports = new RazorpaySettlementService();