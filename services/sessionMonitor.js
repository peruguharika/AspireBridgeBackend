const Session = require('../models/Session');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Wallet = require('../models/Wallet');
const { sendEmail } = require('./emailService');
const Razorpay = require('razorpay');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

class SessionMonitor {
  constructor() {
    this.monitoringInterval = null;
  }

  // Start monitoring sessions
  startMonitoring() {
    console.log('🔍 Starting session monitoring service...');
    
    // Check every minute
    this.monitoringInterval = setInterval(async () => {
      await this.checkSessions();
    }, 60 * 1000);

    // Also run immediately
    this.checkSessions();
  }

  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('⏹️ Session monitoring stopped');
    }
  }

  // Main monitoring function
  async checkSessions() {
    try {
      const now = new Date();
      
      // Find sessions that need monitoring
      const sessionsToCheck = await Session.find({
        status: { $in: ['scheduled', 'ongoing'] },
        scheduledStartTime: { $lte: now }
      }).populate('bookingId');

      // Also check for feedback timeout scenarios
      const feedbackTimeoutSessions = await Session.find({
        status: 'ongoing',
        $or: [
          { 'aspirantFeedback.rating': { $exists: true } },
          { 'achieverFeedback.rating': { $exists: true } }
        ],
        scheduledEndTime: { $lt: new Date(now.getTime() - 24 * 60 * 60 * 1000) } // 24 hours after session end
      }).populate('bookingId');

      for (const session of sessionsToCheck) {
        await this.processSession(session, now);
      }

      // Process feedback timeout sessions
      for (const session of feedbackTimeoutSessions) {
        await this.handleFeedbackTimeout(session, now);
      }

    } catch (error) {
      console.error('Session monitoring error:', error);
    }
  }

  // Process individual session
  async processSession(session, now) {
    try {
      const sessionStart = new Date(session.scheduledStartTime);
      const sessionEnd = new Date(session.scheduledEndTime);
      const gracePeriodDuration = 10 * 60 * 1000; // 10 minutes in milliseconds

      // Check if session has ended
      if (now > sessionEnd) {
        await this.handleSessionEnd(session, now);
        return;
      }

      // Check if grace period should start
      if (now >= sessionStart && !session.gracePeriodStarted) {
        await this.startGracePeriod(session, now);
      }

      // Check if grace period has expired
      if (session.gracePeriodStarted) {
        const gracePeriodEnd = new Date(session.gracePeriodStarted.getTime() + gracePeriodDuration);
        
        if (now > gracePeriodEnd && !session.gracePeriodExpired) {
          await this.handleGracePeriodExpiry(session, now);
        }
      }

    } catch (error) {
      console.error(`Error processing session ${session._id}:`, error);
    }
  }

  // Start grace period for session
  async startGracePeriod(session, now) {
    try {
      // Only start grace period if no one has joined yet
      if (!session.aspirantJoined && !session.achieverJoined) {
        session.gracePeriodStarted = now;
        await session.save();
        
        console.log(`Grace period started for session ${session._id}`);
      }
    } catch (error) {
      console.error(`Error starting grace period for session ${session._id}:`, error);
    }
  }

  // Handle grace period expiry
  async handleGracePeriodExpiry(session, now) {
    try {
      session.gracePeriodExpired = true;
      
      // Determine what happened during grace period
      if (!session.aspirantJoined && !session.achieverJoined) {
        // Neither joined - full refund
        await this.handleNoShow(session, 'neither-joined');
      } else if (session.aspirantJoined && !session.achieverJoined) {
        // Only aspirant joined - full refund
        await this.handleNoShow(session, 'aspirant-only');
      } else if (!session.aspirantJoined && session.achieverJoined) {
        // Only achiever joined - achiever can complete session
        await this.handleAchieverOnlySession(session);
      }
      // If both joined, let session continue normally

      await session.save();
      console.log(`Grace period expired for session ${session._id}, pattern: ${session.attendancePattern}`);

    } catch (error) {
      console.error(`Error handling grace period expiry for session ${session._id}:`, error);
    }
  }

  // Handle session end
  async handleSessionEnd(session, now) {
    try {
      if (session.status === 'ongoing') {
        // Session was ongoing but time expired
        session.status = 'completed';
        session.actualEndTime = now;
        session.completionReason = 'time-expired';
        
        // If both participants joined, process payment
        if (session.attendancePattern === 'both-joined') {
          await this.processPaymentDistribution(session);
        } else {
          // Session completed without proper attendance - treat as no-show and refund
          console.log(`Session ${session._id} completed without attendance tracking - processing refund`);
          await this.handleNoShow(session, 'neither-joined');
        }
        
        await session.save();
        console.log(`Session ${session._id} ended due to time expiry`);
      } else if (session.status === 'scheduled') {
        // Session never started - treat as no-show
        session.status = 'no-show';
        session.actualEndTime = now;
        session.completionReason = 'never-started';
        
        console.log(`Session ${session._id} never started - processing refund`);
        await this.handleNoShow(session, 'never-started');
        
        await session.save();
        console.log(`Session ${session._id} marked as no-show (never started)`);
      }
    } catch (error) {
      console.error(`Error handling session end for ${session._id}:`, error);
    }
  }

  // Handle no-show scenarios
  async handleNoShow(session, pattern) {
    try {
      session.status = 'no-show';
      // Map pattern to valid enum values
      if (pattern === 'never-started') {
        session.attendancePattern = 'neither-joined';
      } else {
        session.attendancePattern = pattern;
      }
      session.completionReason = 'no-attendance';
      session.refundProcessed = true;

      // Process full refund
      await this.processFullRefund(session);

      // Update booking status
      await Booking.findByIdAndUpdate(session.bookingId._id, {
        status: 'cancelled',
        refundStatus: 'completed'
      });

      // Send notification emails
      await this.sendNoShowNotifications(session, pattern);

      console.log(`No-show handled for session ${session._id}, pattern: ${pattern}`);

    } catch (error) {
      console.error(`Error handling no-show for session ${session._id}:`, error);
    }
  }

  // Handle achiever-only session
  async handleAchieverOnlySession(session) {
    try {
      // Achiever waited, they can complete the session and get paid
      session.attendancePattern = 'achiever-only';
      session.completionReason = 'achiever-waited';
      
      // Allow achiever to complete session and receive payment
      // This will be handled when achiever clicks "Complete Session"
      
      console.log(`Achiever-only session ${session._id} - achiever can complete and receive payment`);

    } catch (error) {
      console.error(`Error handling achiever-only session ${session._id}:`, error);
    }
  }

  // Process full refund
  async processFullRefund(session) {
    try {
      const payment = await Payment.findOne({ 
        bookingId: session.bookingId._id, 
        status: 'completed' 
      });

      if (!payment) {
        console.log(`No payment found for session ${session._id} refund`);
        return;
      }

      // Process refund through Razorpay
      const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount * 100, // Full refund in paise
        notes: {
          reason: `Session no-show - ${session.attendancePattern}`,
          sessionId: session._id.toString()
        }
      });

      // Update payment record
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = payment.amount;
      payment.refundReason = `Session no-show - ${session.attendancePattern}`;
      await payment.save();

      console.log(`Full refund processed for session ${session._id}: ₹${payment.amount}`);

    } catch (error) {
      console.error(`Error processing refund for session ${session._id}:`, error);
    }
  }

  // Process payment distribution for completed sessions
  async processPaymentDistribution(session) {
    try {
      if (session.paymentDistributed) {
        return;
      }

      const payment = await Payment.findOne({ 
        bookingId: session.bookingId._id, 
        status: 'completed' 
      });

      if (!payment) {
        console.log(`No payment found for session ${session._id} distribution`);
        return;
      }

      const totalAmount = payment.amount;
      const adminFeePercentage = 0.10; // 10%
      const gatewayFeePercentage = 0.02; // 2%
      
      const adminFee = Math.round(totalAmount * adminFeePercentage);
      const gatewayFee = Math.round(totalAmount * gatewayFeePercentage);
      const mentorEarnings = totalAmount - adminFee - gatewayFee;

      // Update session
      session.adminFeeAmount = adminFee;
      session.mentorEarnings = mentorEarnings;
      session.paymentDistributed = true;

      // Update wallets
      await this.updateWallet(session.achieverId, 'achiever', mentorEarnings, 'session-payment', session);
      await this.updateWallet('admin', 'admin', adminFee, 'admin-fee', session);

      console.log(`Payment distributed for session ${session._id}: Admin: ₹${adminFee}, Mentor: ₹${mentorEarnings}`);

    } catch (error) {
      console.error(`Error distributing payment for session ${session._id}:`, error);
    }
  }

  // Update wallet helper
  async updateWallet(userId, userType, amount, source, session) {
    try {
      let wallet = await Wallet.findOne({ userId });
      
      if (!wallet) {
        wallet = new Wallet({
          userId,
          userType,
          balance: 0,
          totalEarnings: 0,
          totalWithdrawn: 0,
          transactions: []
        });
      }

      wallet.transactions.push({
        type: 'credit',
        amount,
        source,
        description: `Earnings from session on ${new Date(session.scheduledStartTime).toLocaleDateString()}`,
        sessionId: session._id,
        bookingId: session.bookingId._id,
        timestamp: new Date()
      });

      wallet.balance += amount;
      wallet.totalEarnings += amount;
      await wallet.save();

    } catch (error) {
      console.error(`Error updating wallet for ${userType} ${userId}:`, error);
    }
  }

  // Send no-show notification emails
  async sendNoShowNotifications(session, pattern) {
    try {
      const booking = session.bookingId;
      
      if (pattern === 'neither-joined') {
        // Send to both participants
        await sendEmail({
          to: booking.aspirantEmail,
          subject: 'Session Cancelled - Full Refund Processed',
          html: `
            <h2>Session Cancelled</h2>
            <p>Your session scheduled for ${new Date(session.scheduledStartTime).toLocaleString()} was cancelled due to no attendance from either participant.</p>
            <p><strong>Refund:</strong> A full refund of ₹${booking.amount} has been processed and will reflect in your account within 5-7 business days.</p>
            <p>We apologize for any inconvenience.</p>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });

      } else if (pattern === 'aspirant-only') {
        // Send to aspirant about refund
        await sendEmail({
          to: booking.aspirantEmail,
          subject: 'Session Cancelled - Mentor No-Show Refund',
          html: `
            <h2>Session Cancelled - Mentor No-Show</h2>
            <p>Unfortunately, your mentor did not join the session scheduled for ${new Date(session.scheduledStartTime).toLocaleString()}.</p>
            <p><strong>Refund:</strong> A full refund of ₹${booking.amount} has been processed and will reflect in your account within 5-7 business days.</p>
            <p>We sincerely apologize for this inconvenience and will work to prevent such issues in the future.</p>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }

    } catch (error) {
      console.error(`Error sending no-show notifications for session ${session._id}:`, error);
    }
  }

  // 🔄 Handle feedback timeout scenarios
  async handleFeedbackTimeout(session, now) {
    try {
      console.log(`⏰ Handling feedback timeout for session: ${session._id}`);
      
      const bothFeedbacksSubmitted = session.aspirantFeedback.rating && session.achieverFeedback.rating;
      
      if (bothFeedbacksSubmitted) {
        // Both feedbacks exist but session is still ongoing - this shouldn't happen
        console.log(`⚠️ Session ${session._id} has both feedbacks but is still ongoing - skipping timeout`);
        return;
      }
      
      // Determine refund scenario based on attendance and feedback
      const aspirantSubmitted = !!session.aspirantFeedback.rating;
      const achieverSubmitted = !!session.achieverFeedback.rating;
      
      if (session.aspirantJoined && session.achieverJoined) {
        // Both attended but incomplete feedback - partial refund logic
        if (aspirantSubmitted && !achieverSubmitted) {
          // Aspirant submitted, achiever didn't - achiever loses payment, aspirant gets refund
          await this.processFeedbackTimeoutRefund(session, 'achiever-no-feedback');
        } else if (!aspirantSubmitted && achieverSubmitted) {
          // Achiever submitted, aspirant didn't - achiever gets payment, no refund
          await this.processFeedbackTimeoutPayment(session, 'aspirant-no-feedback');
        } else if (!aspirantSubmitted && !achieverSubmitted) {
          // Neither submitted feedback - full refund
          await this.processFeedbackTimeoutRefund(session, 'neither-feedback');
        }
      } else {
        // Attendance issues - full refund
        await this.processFeedbackTimeoutRefund(session, 'attendance-and-feedback-issues');
      }
      
    } catch (error) {
      console.error(`Error handling feedback timeout for session ${session._id}:`, error);
    }
  }

  // Process refund for feedback timeout scenarios
  async processFeedbackTimeoutRefund(session, reason) {
    try {
      const Payment = require('../models/Payment');
      const Booking = require('../models/Booking');
      const LockedTransaction = require('../models/LockedTransaction');
      const Wallet = require('../models/Wallet');
      
      const booking = await Booking.findById(session.bookingId._id);
      if (!booking) {
        throw new Error('Booking not found for feedback timeout refund');
      }
      
      const payment = await Payment.findOne({ 
        bookingId: booking._id, 
        status: 'completed' 
      });
      
      if (!payment) {
        console.log(`No payment found for feedback timeout refund: ${session._id}`);
        return;
      }
      
      // Process refund through Razorpay
      const Razorpay = require('razorpay');
      const razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });
      
      const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount * 100, // Full refund in paise
        notes: {
          reason: `Feedback timeout: ${reason}`,
          sessionId: session._id.toString(),
          type: 'feedback_timeout'
        }
      });
      
      // Update payment record
      payment.status = 'refunded';
      payment.refundId = refund.id;
      payment.refundAmount = payment.amount;
      payment.refundReason = `Feedback timeout: ${reason}`;
      await payment.save();
      
      // Update session status
      session.status = 'cancelled';
      session.refundProcessed = true;
      session.completionReason = 'time-expired';
      await session.save();
      
      // Update booking status
      booking.status = 'cancelled';
      booking.refundStatus = 'completed';
      booking.refundAmount = payment.amount;
      await booking.save();
      
      // Update locked transaction
      const lockedTransaction = await LockedTransaction.findOne({ 
        bookingId: booking._id,
        status: 'locked'
      });
      
      if (lockedTransaction) {
        lockedTransaction.status = 'refunded';
        lockedTransaction.refundedAt = new Date();
        lockedTransaction.notes = `Feedback timeout: ${reason}`;
        await lockedTransaction.save();
      }
      
      // Update aspirant wallet
      const aspirantWallet = await Wallet.findOne({ userId: session.aspirantId });
      if (aspirantWallet && aspirantWallet.lockedBalance >= payment.amount) {
        aspirantWallet.lockedBalance -= payment.amount;
        aspirantWallet.transactions.push({
          type: 'credit',
          amount: 0, // Razorpay refund goes to payment method
          source: 'refund',
          description: `Refund processed - Feedback timeout: ${reason}`,
          timestamp: new Date(),
          sessionId: session._id
        });
        await aspirantWallet.save();
      }
      
      // Send notification emails
      await this.sendFeedbackTimeoutRefundEmails(session, payment, reason);
      
      console.log(`✅ Feedback timeout refund processed: ₹${payment.amount} for session ${session._id}`);
      
    } catch (error) {
      console.error('Error processing feedback timeout refund:', error);
      throw error;
    }
  }

  // Process payment for achiever when aspirant doesn't provide feedback
  async processFeedbackTimeoutPayment(session, reason) {
    try {
      console.log(`💰 Processing payment for achiever due to aspirant feedback timeout: ${session._id}`);
      
      // Mark session as completed
      session.status = 'completed';
      session.completedAt = new Date();
      session.actualEndTime = session.actualEndTime || new Date();
      session.completionReason = 'aspirant-no-feedback';
      await session.save();
      
      // Release payment to achiever using existing logic
      const { releaseLockeFundsSecure } = require('../routes/sessions');
      await releaseLockeFundsSecure(session);
      
      // Send notification emails
      await this.sendFeedbackTimeoutPaymentEmails(session, reason);
      
      console.log(`✅ Payment released to achiever due to aspirant feedback timeout: ${session._id}`);
      
    } catch (error) {
      console.error('Error processing feedback timeout payment:', error);
      throw error;
    }
  }

  // Send feedback timeout refund notification emails
  async sendFeedbackTimeoutRefundEmails(session, payment, reason) {
    try {
      const { sendEmail } = require('../services/emailService');
      const User = require('../models/User');
      
      const aspirant = await User.findById(session.aspirantId);
      const achiever = await User.findById(session.achieverId);
      
      // Email to aspirant about refund
      if (aspirant && aspirant.email) {
        await sendEmail({
          to: aspirant.email,
          subject: 'Session Cancelled - Feedback Timeout Refund - MentorConnect',
          html: `
            <h2>⏰ Session Cancelled - Feedback Timeout Refund</h2>
            <p>Dear ${aspirant.name},</p>
            <p>Your mentoring session has been cancelled due to incomplete feedback submission within the required timeframe.</p>
            <p><strong>Session Details:</strong></p>
            <ul>
              <li>Mentor: ${achiever ? achiever.name : 'N/A'}</li>
              <li>Date: ${new Date(session.scheduledStartTime).toLocaleDateString()}</li>
              <li>Reason: ${reason}</li>
            </ul>
            <p><strong>Refund Information:</strong></p>
            <ul>
              <li>Amount: ₹${payment.amount}</li>
              <li>Refund ID: ${payment.refundId}</li>
              <li>Processing Time: 5-7 business days</li>
            </ul>
            <p>💰 The full amount has been refunded to your original payment method.</p>
            <p>⚠️ Please remember to submit feedback within 24 hours of session completion to avoid automatic cancellation.</p>
            <br>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }
      
      // Email to achiever about session cancellation
      if (achiever && achiever.email) {
        await sendEmail({
          to: achiever.email,
          subject: 'Session Cancelled - Feedback Timeout - MentorConnect',
          html: `
            <h2>⏰ Session Cancelled - Feedback Timeout</h2>
            <p>Dear ${achiever.name},</p>
            <p>The mentoring session has been cancelled due to incomplete feedback submission within 24 hours.</p>
            <p><strong>Session Details:</strong></p>
            <ul>
              <li>Student: ${aspirant ? aspirant.name : 'N/A'}</li>
              <li>Date: ${new Date(session.scheduledStartTime).toLocaleDateString()}</li>
              <li>Reason: ${reason}</li>
            </ul>
            <p>The student has been issued a full refund. Please encourage timely feedback submission in future sessions.</p>
            <br>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }
      
    } catch (error) {
      console.error('Error sending feedback timeout refund emails:', error);
    }
  }

  // Send feedback timeout payment notification emails
  async sendFeedbackTimeoutPaymentEmails(session, reason) {
    try {
      const { sendEmail } = require('../services/emailService');
      const User = require('../models/User');
      
      const aspirant = await User.findById(session.aspirantId);
      const achiever = await User.findById(session.achieverId);
      
      // Email to achiever about payment
      if (achiever && achiever.email) {
        await sendEmail({
          to: achiever.email,
          subject: 'Session Completed - Payment Released - MentorConnect',
          html: `
            <h2>💰 Session Completed - Payment Released</h2>
            <p>Dear ${achiever.name},</p>
            <p>Your mentoring session has been completed and payment has been released due to the student not providing feedback within the required timeframe.</p>
            <p><strong>Session Details:</strong></p>
            <ul>
              <li>Student: ${aspirant ? aspirant.name : 'N/A'}</li>
              <li>Date: ${new Date(session.scheduledStartTime).toLocaleDateString()}</li>
              <li>Completion Reason: ${reason}</li>
            </ul>
            <p>💰 Your earnings have been credited to your MentorConnect wallet.</p>
            <br>
            <p>Thank you for your patience!</p>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }
      
      // Email to aspirant about missed feedback
      if (aspirant && aspirant.email) {
        await sendEmail({
          to: aspirant.email,
          subject: 'Session Completed - Feedback Deadline Missed - MentorConnect',
          html: `
            <h2>⚠️ Session Completed - Feedback Deadline Missed</h2>
            <p>Dear ${aspirant.name},</p>
            <p>Your mentoring session has been automatically completed because you did not submit feedback within 24 hours.</p>
            <p><strong>Session Details:</strong></p>
            <ul>
              <li>Mentor: ${achiever ? achiever.name : 'N/A'}</li>
              <li>Date: ${new Date(session.scheduledStartTime).toLocaleDateString()}</li>
            </ul>
            <p>Payment has been released to the mentor. Please remember to submit feedback promptly after future sessions.</p>
            <br>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }
      
    } catch (error) {
      console.error('Error sending feedback timeout payment emails:', error);
    }
  }
}

// Create singleton instance
const sessionMonitor = new SessionMonitor();

module.exports = sessionMonitor;