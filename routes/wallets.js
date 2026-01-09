const express = require('express');
const router = express.Router();
const Wallet = require('../models/Wallet');
const WithdrawalRequest = require('../models/WithdrawalRequest');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   GET /api/wallets/user/:userId
// @desc    Get user wallet
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    let wallet = await Wallet.findOne({ userId: req.params.userId });

    if (!wallet) {
      // Create wallet if it doesn't exist
      const userType = req.user.userType || 'achiever'; // Default to achiever
      wallet = new Wallet({
        userId: req.params.userId,
        userType,
        balance: 0,
        lockedBalance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        transactions: []
      });
      await wallet.save();
    }

    // Calculate available balance (balance - lockedBalance)
    const availableBalance = wallet.balance - (wallet.lockedBalance || 0);

    res.json({
      success: true,
      wallet: {
        ...wallet.toObject(),
        availableBalance: Math.max(0, availableBalance) // Ensure non-negative
      }
    });

  } catch (error) {
    console.error('Get Wallet Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch wallet',
      error: error.message
    });
  }
});

// @route   POST /api/wallets/topup
// @desc    Add money to wallet after successful payment
// @access  Private
router.post('/topup', authenticateToken, async (req, res) => {
  try {
    const { paymentId, orderId, userId, amount } = req.body;

    console.log('💰 Wallet Topup Request:', { paymentId, orderId, userId, amount });

    // Validate required fields
    if (!userId || !amount) {
      console.error('❌ Missing required fields:', { userId, amount });
      return res.status(400).json({
        success: false,
        message: 'User ID and amount are required'
      });
    }

    // Find wallet with multiple ID formats
    let wallet = await Wallet.findOne({
      $or: [
        { userId: userId },
        { userId: userId.toString() }
      ]
    });

    console.log(`🔍 Wallet lookup for userId: ${userId}, Found: ${wallet ? 'Yes' : 'No'}`);

    if (!wallet) {
      console.log('💳 Creating new wallet for user:', userId);
      wallet = new Wallet({
        userId: userId,
        userType: 'aspirant',
        balance: 0,
        lockedBalance: 0,
        totalEarnings: 0,
        totalWithdrawn: 0,
        transactions: [],
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }

    // Add amount to balance
    const oldBalance = wallet.balance || 0;
    wallet.balance = oldBalance + parseFloat(amount);

    // Ensure transactions array exists
    if (!wallet.transactions) {
      wallet.transactions = [];
    }

    // Add transaction record
    wallet.transactions.push({
      type: 'credit',
      amount: parseFloat(amount),
      description: 'Wallet Top-up',
      paymentId: paymentId || '',
      orderId: orderId || '',
      status: 'completed',
      date: new Date(),
      createdAt: new Date(),
      timestamp: new Date()
    });

    wallet.updatedAt = new Date();

    console.log(`💾 Saving wallet: Old balance: ₹${oldBalance}, New balance: ₹${wallet.balance}`);

    await wallet.save();

    console.log(`✅ Wallet topup successful: ₹${amount} added. New balance: ₹${wallet.balance}`);

    res.json({
      success: true,
      message: 'Wallet topped up successfully',
      wallet: {
        balance: wallet.balance,
        userId: wallet.userId
      },
      newBalance: wallet.balance
    });

  } catch (error) {
    console.error('❌ Wallet Topup Error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to topup wallet',
      error: error.message
    });
  }
});

// @route   POST /api/wallets/withdrawal
// @desc    Request withdrawal
// @access  Private
router.post('/withdrawal', authenticateToken, async (req, res) => {
  try {
    const { amount, bankDetails } = req.body;
    const userId = req.user.id;

    // Validation
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid withdrawal amount'
      });
    }

    if (!bankDetails || !bankDetails.accountHolderName || !bankDetails.accountNumber || !bankDetails.ifscCode) {
      return res.status(400).json({
        success: false,
        message: 'Complete bank details are required'
      });
    }

    // Validate IFSC code format
    const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
    if (!ifscRegex.test(bankDetails.ifscCode)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid IFSC code format'
      });
    }

    // Get user wallet
    const wallet = await Wallet.findOne({ userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient wallet balance'
      });
    }

    // Calculate processing fee (2% or minimum ₹10)
    const processingFee = Math.max(Math.round(amount * 0.02), 10);
    const netAmount = amount - processingFee;

    // Encrypt sensitive bank details
    const { encryptBankDetails } = require('../utils/encryption');
    const encryptedBankDetails = encryptBankDetails({
      accountHolderName: bankDetails.accountHolderName,
      accountNumber: bankDetails.accountNumber,
      ifscCode: bankDetails.ifscCode,
      bankName: bankDetails.bankName || 'Not specified',
      upiId: bankDetails.upiId
    });

    // Create withdrawal request
    const withdrawalRequest = new WithdrawalRequest({
      userId,
      walletId: wallet._id,
      amount,
      bankDetails: encryptedBankDetails,
      processingFee,
      netAmount,
      status: 'pending'
    });

    await withdrawalRequest.save();

    // DO NOT deduct amount from wallet yet - wait for admin approval
    // The amount will be deducted only after admin approves the withdrawal

    console.log(`✅ Withdrawal request created: ${withdrawalRequest._id}`);
    console.log(`💰 Amount: ₹${amount} (Net: ₹${netAmount}) - Status: pending admin approval`);

    // Send email notification to user
    const User = require('../models/User');
    const user = await User.findById(userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: 'Withdrawal Request Submitted - MentorConnect',
        html: `
          <h2>💰 Withdrawal Request Submitted</h2>
          <p>Dear ${user.name},</p>
          <p>Your withdrawal request has been submitted successfully and is pending admin approval.</p>
          <p><strong>Request Details:</strong></p>
          <ul>
            <li>Amount Requested: ₹${amount}</li>
            <li>Processing Fee: ₹${processingFee}</li>
            <li>Net Amount: ₹${netAmount}</li>
            <li>Bank Account: ${bankDetails.accountHolderName}</li>
            <li>Account Number: ${bankDetails.accountNumber}</li>
            <li>Status: Pending Admin Approval</li>
          </ul>
          <p>Our admin team will review your request within 24 hours. You will receive an email notification once your request is approved or if any additional information is needed.</p>
          <br>
          <p>Thank you for your patience!</p>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Withdrawal request submitted successfully',
      withdrawalRequest: {
        id: withdrawalRequest._id,
        amount: withdrawalRequest.amount,
        processingFee: withdrawalRequest.processingFee,
        netAmount: withdrawalRequest.netAmount,
        status: withdrawalRequest.status
      }
    });

  } catch (error) {
    console.error('Withdrawal Request Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process withdrawal request',
      error: error.message
    });
  }
});

// @route   GET /api/wallets/withdrawals/:userId
// @desc    Get user withdrawal history
// @access  Private
router.get('/withdrawals/:userId', authenticateToken, async (req, res) => {
  try {
    const withdrawals = await WithdrawalRequest.find({ userId: req.params.userId })
      .sort({ requestedAt: -1 });

    res.json({
      success: true,
      count: withdrawals.length,
      withdrawals
    });

  } catch (error) {
    console.error('Get Withdrawals Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch withdrawals',
      error: error.message
    });
  }
});

// @route   PUT /api/wallets/bank-details/:userId
// @desc    Update bank details
// @access  Private
router.put('/bank-details/:userId', authenticateToken, async (req, res) => {
  try {
    const { bankDetails } = req.body;

    // Validate IFSC code format
    if (bankDetails.ifscCode) {
      const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;
      if (!ifscRegex.test(bankDetails.ifscCode)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid IFSC code format'
        });
      }
    }

    const wallet = await Wallet.findOne({ userId: req.params.userId });
    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found'
      });
    }

    wallet.bankDetails = {
      ...wallet.bankDetails,
      ...bankDetails,
      verified: false // Reset verification when details change
    };

    await wallet.save();

    res.json({
      success: true,
      message: 'Bank details updated successfully',
      bankDetails: wallet.bankDetails
    });

  } catch (error) {
    console.error('Update Bank Details Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update bank details',
      error: error.message
    });
  }
});

// Withdrawal processing is now handled in admin routes after approval

// @route   GET /api/wallets/admin/overview
// @desc    Get admin wallet overview
// @access  Private/Admin
router.get('/admin/overview', authenticateToken, async (req, res) => {
  try {
    // Get admin wallet
    const adminWallet = await Wallet.findOne({ userType: 'admin' });

    // Get all withdrawal requests
    const pendingWithdrawals = await WithdrawalRequest.find({ status: 'pending' });
    const processingWithdrawals = await WithdrawalRequest.find({ status: 'processing' });

    // Calculate total platform earnings
    const totalAdminFees = adminWallet ? adminWallet.totalEarnings : 0;
    const totalPendingWithdrawals = pendingWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    const totalProcessingWithdrawals = processingWithdrawals.reduce((sum, w) => sum + w.amount, 0);

    res.json({
      success: true,
      overview: {
        adminWallet: adminWallet || { balance: 0, totalEarnings: 0 },
        totalAdminFees,
        pendingWithdrawals: {
          count: pendingWithdrawals.length,
          totalAmount: totalPendingWithdrawals
        },
        processingWithdrawals: {
          count: processingWithdrawals.length,
          totalAmount: totalProcessingWithdrawals
        }
      }
    });

  } catch (error) {
    console.error('Admin Overview Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin overview',
      error: error.message
    });
  }
});

// @route   POST /api/wallets/razorpay-webhook
// @desc    Handle Razorpay payout webhooks
// @access  Public (but verified)
router.post('/razorpay-webhook', async (req, res) => {
  try {
    const { event, payload } = req.body;

    console.log(`📡 Razorpay webhook received: ${event}`);

    if (event === 'payout.processed' || event === 'payout.failed' || event === 'payout.reversed') {
      const payout = payload.payout.entity;
      const payoutId = payout.id;

      console.log(`🔄 Processing payout webhook: ${payoutId} - Status: ${payout.status}`);

      // Find the withdrawal request
      const withdrawalRequest = await WithdrawalRequest.findOne({ razorpayPayoutId: payoutId });

      if (withdrawalRequest) {
        // Update withdrawal status based on payout status
        if (payout.status === 'processed') {
          withdrawalRequest.status = 'completed';
          withdrawalRequest.completedAt = new Date();
          console.log(`✅ Withdrawal ${withdrawalRequest._id} marked as completed`);
        } else if (payout.status === 'failed' || payout.status === 'reversed') {
          withdrawalRequest.status = 'failed';
          withdrawalRequest.failureReason = payout.failure_reason || 'Payout failed';

          // Refund the amount back to user's wallet
          const wallet = await Wallet.findById(withdrawalRequest.walletId);
          if (wallet) {
            wallet.balance += withdrawalRequest.amount;
            wallet.totalWithdrawn -= withdrawalRequest.amount;

            // Add refund transaction
            wallet.transactions.push({
              type: 'credit',
              amount: withdrawalRequest.amount,
              source: 'withdrawal',
              description: `Withdrawal refund - ${withdrawalRequest.failureReason}`,
              timestamp: new Date()
            });

            await wallet.save();
            console.log(`💰 Refunded ₹${withdrawalRequest.amount} back to wallet`);
          }
        }

        await withdrawalRequest.save();

        console.log(`📊 Withdrawal ${withdrawalRequest._id} updated in settlements dashboard`);
      } else {
        console.log(`⚠️ No withdrawal request found for payout ID: ${payoutId}`);
      }
    }

    res.status(200).json({ success: true });

  } catch (error) {
    console.error('❌ Razorpay webhook error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// @route   GET /api/wallets/settlements-info
// @desc    Get information about Razorpay settlements
// @access  Private/Admin
router.get('/settlements-info', authenticateToken, async (req, res) => {
  try {
    const completedWithdrawals = await WithdrawalRequest.find({
      status: 'completed',
      razorpayPayoutId: { $exists: true }
    }).sort({ completedAt: -1 }).limit(10);

    const processingWithdrawals = await WithdrawalRequest.find({
      status: 'processing',
      razorpayPayoutId: { $exists: true }
    }).sort({ processedAt: -1 });

    const totalPayouts = await WithdrawalRequest.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalAmount: { $sum: '$netAmount' }, count: { $sum: 1 } } }
    ]);

    res.json({
      success: true,
      settlementsInfo: {
        completedPayouts: {
          count: completedWithdrawals.length,
          totalAmount: totalPayouts[0]?.totalAmount || 0,
          totalCount: totalPayouts[0]?.count || 0,
          recent: completedWithdrawals
        },
        processingPayouts: {
          count: processingWithdrawals.length,
          items: processingWithdrawals
        },
        razorpayDashboardInfo: {
          url: 'https://dashboard.razorpay.com/app/settlements',
          section: 'Settlements > Payouts',
          note: 'All withdrawal transactions are visible in your Razorpay dashboard under Settlements'
        }
      }
    });

  } catch (error) {
    console.error('Settlements Info Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settlements info',
      error: error.message
    });
  }
});

// @route   POST /api/wallets/pay-from-wallet
// @desc    Pay for a booking using wallet balance
// @access  Private
router.post('/pay-from-wallet', authenticateToken, async (req, res) => {
  try {
    const { amount, bookingId, achieverId, description } = req.body;
    const userId = req.user.id;

    // Find wallet
    const wallet = await Wallet.findOne({ userId });

    if (!wallet) {
      return res.status(404).json({
        success: false,
        message: 'Wallet not found. Please add money first.'
      });
    }

    // Check balance
    if (wallet.balance < amount) {
      return res.status(400).json({
        success: false,
        message: `Insufficient balance. Available: ₹${wallet.balance}`,
        availableBalance: wallet.balance
      });
    }

    // Deduct money
    wallet.balance -= amount;

    // Add transaction record
    wallet.transactions.push({
      type: 'debit',
      amount,
      source: 'booking',
      description: description || 'Payment for mentorship session',
      bookingId,
      createdAt: new Date()
    });

    await wallet.save();

    // Update booking status if bookingId is provided
    if (bookingId) {
      const Booking = require('../models/Booking');
      await Booking.findByIdAndUpdate(bookingId, {
        paymentStatus: 'completed',
        status: 'confirmed',
        paymentId: `WALLET_${Date.now()}`
      });
    }

    res.json({
      success: true,
      message: 'Payment successful from wallet',
      newBalance: wallet.balance
    });

  } catch (error) {
    console.error('Wallet payment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process wallet payment',
      error: error.message
    });
  }
});


module.exports = router;