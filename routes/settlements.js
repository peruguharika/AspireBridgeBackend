const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const razorpaySettlementService = require('../services/razorpaySettlementService');
const Settlement = require('../models/Settlement');
const { authenticateToken, isAdmin } = require('../middleware/auth');

// @route   POST /api/settlements/webhook
// @desc    Handle Razorpay settlement webhooks
// @access  Public (but verified with signature)
router.post('/webhook', async (req, res) => {
  try {
    const webhookSignature = req.headers['x-razorpay-signature'];
    const webhookBody = JSON.stringify(req.body);

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || process.env.RAZORPAY_KEY_SECRET)
      .update(webhookBody)
      .digest('hex');

    if (webhookSignature !== expectedSignature) {
      console.error('❌ Invalid webhook signature');
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid signature' 
      });
    }

    console.log('📡 Razorpay settlement webhook received:', req.body.event);

    // Process the webhook
    const result = await razorpaySettlementService.handleSettlementWebhook(req.body);

    res.json(result);

  } catch (error) {
    console.error('❌ Settlement webhook error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Webhook processing failed',
      error: error.message 
    });
  }
});

// @route   GET /api/settlements/sync
// @desc    Manually sync settlements from Razorpay
// @access  Private/Admin
router.get('/sync', authenticateToken, isAdmin, async (req, res) => {
  try {
    console.log('🔄 Manual settlement sync requested by admin');
    
    const syncedCount = await razorpaySettlementService.syncSettlements();
    
    res.json({
      success: true,
      message: `Synced ${syncedCount} settlements from Razorpay`,
      syncedCount
    });

  } catch (error) {
    console.error('❌ Manual settlement sync error:', error);
    res.status(500).json({
      success: false,
      message: 'Settlement sync failed',
      error: error.message
    });
  }
});

// @route   GET /api/settlements/summary
// @desc    Get settlement summary for admin dashboard
// @access  Private/Admin
router.get('/summary', authenticateToken, isAdmin, async (req, res) => {
  try {
    const summary = await razorpaySettlementService.getSettlementSummary();
    
    res.json({
      success: true,
      summary
    });

  } catch (error) {
    console.error('❌ Settlement summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get settlement summary',
      error: error.message
    });
  }
});

// @route   GET /api/settlements/list
// @desc    Get all settlements with pagination
// @access  Private/Admin
router.get('/list', authenticateToken, isAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const settlements = await Settlement.find()
      .sort({ settlementDate: -1 })
      .skip(skip)
      .limit(limit)
      .populate('adminWalletId', 'userId userType');

    const total = await Settlement.countDocuments();

    res.json({
      success: true,
      settlements,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Settlement list error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get settlements',
      error: error.message
    });
  }
});

module.exports = router;