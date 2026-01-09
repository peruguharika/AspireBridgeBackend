const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const LockedTransaction = require('../models/LockedTransaction');
const Wallet = require('../models/Wallet');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// @route   POST /api/sessions/:sessionId/complete
// @desc    Mark session as completed and release locked funds
// @access  Private
router.post('/:sessionId/complete', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const { rating, feedback } = req.body;

    // Get session details
    const session = await Session.findById(sessionId)
      .populate('aspirantId', 'name email')
      .populate('achieverId', 'name email');

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Verify user is part of this session
    if (session.aspirantId._id.toString() !== req.user.id && 
        session.achieverId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to complete this session'
      });
    }

    // Update session status
    session.status = 'completed';
    session.completedAt = new Date();
    if (rating) session.rating = rating;
    if (feedback) session.feedback = feedback;
    await session.save();

    // 🔓 RELEASE LOCKED FUNDS
    await releaseLockeFunds(session);

    res.json({
      success: true,
      message: 'Session completed successfully and funds released',
      session
    });

  } catch (error) {
    console.error('Complete Session Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete session',
      error: error.message
    });
  }
});

// 🔓 Helper function: Release locked funds after session completion
async function releaseLockeFunds(session) {
  try {
    console.log(`🔓 Releasing locked funds for session: ${session._id}`);

    // Find the booking associated with this session
    const booking = await Booking.findOne({ 
      aspirantId: session.aspirantId._id,
      achieverId: session.achieverId._id,
      date: session.date
    });

    if (!booking) {
      console.error('No booking found for session:', session._id);
      return;
    }

    // Find locked transaction
    const lockedTransaction = await LockedTransaction.findOne({ 
      bookingId: booking._id,
      status: 'locked'
    });

    if (!lockedTransaction) {
      console.error('No locked transaction found for booking:', booking._id);
      return;
    }

    // 💰 PERFORM INTERNAL SPLIT (Ledger Update Only)
    await performInternalSplit(lockedTransaction, session);

    // Update locked transaction status
    lockedTransaction.status = 'released';
    lockedTransaction.releasedAt = new Date();
    lockedTransaction.sessionCompletedAt = new Date();
    await lockedTransaction.save();

    console.log(`✅ Funds released successfully for session: ${session._id}`);

  } catch (error) {
    console.error('Error releasing locked funds:', error);
    throw error;
  }
}

// 💰 Helper function: Perform internal split (Ledger update only)
async function performInternalSplit(lockedTransaction, session) {
  try {
    console.log(`💰 Performing internal split for transaction: ${lockedTransaction._id}`);
    console.log(`📊 Split: Platform ₹${lockedTransaction.platformFee} | Razorpay ₹${lockedTransaction.razorpayFee} | Achiever ₹${lockedTransaction.achieverAmount}`);

    // 1️⃣ Get/Create Admin Wallet
    let adminWallet = await Wallet.findOne({ userType: 'admin' });
    if (!adminWallet) {
      // Create admin wallet if doesn't exist
      const User = require('../models/User');
      const adminUser = await User.findOne({ userType: 'admin' });
      
      adminWallet = new Wallet({
        userId: adminUser ? adminUser._id : null,
        userType: 'admin',
        balance: 0,
        totalEarnings: 0
      });
    }

    // Credit admin wallet with platform fee
    adminWallet.balance += lockedTransaction.platformFee;
    adminWallet.totalEarnings += lockedTransaction.platformFee;
    adminWallet.transactions.push({
      type: 'credit',
      amount: lockedTransaction.platformFee,
      source: 'admin-fee',
      description: `Platform fee from session: ${session.aspirantId.name} → ${session.achieverId.name}`,
      timestamp: new Date(),
      sessionId: session._id
    });
    await adminWallet.save();

    // 🏦 TRIGGER RAZORPAY SETTLEMENT SYNC
    // This will check for new settlements and update records
    try {
      const razorpaySettlementService = require('../services/razorpaySettlementService');
      // Trigger settlement sync in background (don't wait for it)
      setTimeout(async () => {
        try {
          await razorpaySettlementService.syncSettlements();
          console.log('✅ Settlement sync triggered after admin fee credit');
        } catch (error) {
          console.error('❌ Settlement sync error:', error);
        }
      }, 5000); // Wait 5 seconds to allow Razorpay to process
    } catch (error) {
      console.error('❌ Error triggering settlement sync:', error);
    }

    // 2️⃣ Get/Create Achiever Wallet
    let achieverWallet = await Wallet.findOne({ userId: lockedTransaction.achieverId });
    if (!achieverWallet) {
      achieverWallet = new Wallet({
        userId: lockedTransaction.achieverId,
        userType: 'achiever',
        balance: 0,
        totalEarnings: 0
      });
    }

    // Credit achiever wallet with their share
    achieverWallet.balance += lockedTransaction.achieverAmount;
    achieverWallet.totalEarnings += lockedTransaction.achieverAmount;
    achieverWallet.transactions.push({
      type: 'credit',
      amount: lockedTransaction.achieverAmount,
      source: 'session',
      description: `Session earnings from ${session.aspirantId.name} on ${session.date}`,
      timestamp: new Date(),
      sessionId: session._id
    });
    await achieverWallet.save();

    // 3️⃣ Update Aspirant Wallet (Remove from locked balance)
    const aspirantWallet = await Wallet.findOne({ userId: lockedTransaction.aspirantId });
    if (aspirantWallet) {
      aspirantWallet.lockedBalance -= lockedTransaction.amount;
      aspirantWallet.transactions.push({
        type: 'debit',
        amount: lockedTransaction.amount,
        source: 'session_completed',
        description: `Session payment released to ${session.achieverId.name}`,
        timestamp: new Date(),
        sessionId: session._id
      });
      await aspirantWallet.save();
    }

    // 4️⃣ Send notification emails
    await sendCompletionEmails(lockedTransaction, session);

    console.log(`✅ Internal split completed:`);
    console.log(`   Admin earned: ₹${lockedTransaction.platformFee}`);
    console.log(`   Achiever earned: ₹${lockedTransaction.achieverAmount}`);
    console.log(`   Razorpay fee: ₹${lockedTransaction.razorpayFee} (kept in platform account)`);

  } catch (error) {
    console.error('Error performing internal split:', error);
    throw error;
  }
}

// 📧 Helper function: Send completion emails
async function sendCompletionEmails(lockedTransaction, session) {
  try {
    // Email to achiever about earnings
    if (session.achieverId && session.achieverId.email) {
      await sendEmail({
        to: session.achieverId.email,
        subject: 'Session Completed - Earnings Released! - MentorConnect',
        html: `
          <h2>🎉 Session Completed - Earnings Released!</h2>
          <p>Dear ${session.achieverId.name},</p>
          <p>Great news! Your mentoring session has been completed and your earnings have been credited to your wallet.</p>
          <p><strong>Session Details:</strong></p>
          <ul>
            <li>Student: ${session.aspirantId.name}</li>
            <li>Date: ${new Date(session.date).toLocaleDateString()}</li>
            <li>Duration: ${session.duration || 60} minutes</li>
          </ul>
          <p><strong>Earnings Breakdown:</strong></p>
          <ul>
            <li>Total Payment: ₹${lockedTransaction.amount}</li>
            <li>Platform Fee (10%): ₹${lockedTransaction.platformFee}</li>
            <li>Gateway Fee (2%): ₹${lockedTransaction.razorpayFee}</li>
            <li><strong>Your Earnings: ₹${lockedTransaction.achieverAmount}</strong></li>
          </ul>
          <p>💰 The amount has been credited to your MentorConnect wallet. You can request a withdrawal anytime from your dashboard.</p>
          <br>
          <p>Thank you for being an amazing mentor!</p>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    // Email to aspirant about session completion
    if (session.aspirantId && session.aspirantId.email) {
      await sendEmail({
        to: session.aspirantId.email,
        subject: 'Session Completed Successfully! - MentorConnect',
        html: `
          <h2>✅ Session Completed Successfully!</h2>
          <p>Dear ${session.aspirantId.name},</p>
          <p>Your mentoring session has been completed successfully!</p>
          <p><strong>Session Details:</strong></p>
          <ul>
            <li>Mentor: ${session.achieverId.name}</li>
            <li>Date: ${new Date(session.date).toLocaleDateString()}</li>
            <li>Duration: ${session.duration || 60} minutes</li>
            <li>Amount Paid: ₹${lockedTransaction.amount}</li>
          </ul>
          <p>💡 <strong>Next Steps:</strong></p>
          <ul>
            <li>Rate your mentor and provide feedback</li>
            <li>Book another session if you found it helpful</li>
            <li>Explore other mentors in your field</li>
          </ul>
          <br>
          <p>Thank you for using MentorConnect!</p>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

  } catch (error) {
    console.error('Error sending completion emails:', error);
  }
}

module.exports = router;