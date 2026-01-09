const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Payment = require('../models/Payment');
const Booking = require('../models/Booking');
const MasterClass = require('../models/MasterClass');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

// @route   POST /api/payments/create-order
// @desc    Create Razorpay order
// @access  Private
router.post('/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, bookingId, masterClassId, type } = req.body;

    if (!amount || !type) {
      return res.status(400).json({
        success: false,
        message: 'Amount and type are required'
      });
    }

    console.log(`[CreateOrder] Received: amount=${amount}, type=${type}, userId=${req.user.id}`);

    // DEV MODE: Skip Razorpay API call if credentials are not properly configured
    let order;
    const isDevelopmentMode = !process.env.RAZORPAY_KEY_SECRET ||
      process.env.RAZORPAY_KEY_SECRET === 'make_it_long_and_random' ||
      process.env.RAZORPAY_KEY_SECRET.length < 20;

    if (isDevelopmentMode) {
      // Use mock order for development
      console.log(`[CreateOrder] DEV MODE: Using mock Razorpay order`);
      order = {
        id: `order_DEV_${Date.now()}`,
        amount: amount * 100,
        currency: 'INR',
        status: 'created'
      };
      console.log(`[CreateOrder] Mock Order Created:`, order.id, "Amount:", order.amount);
    } else {
      // Create real Razorpay order
      const options = {
        amount: amount * 100, // Amount in paise
        currency: 'INR',
        receipt: `receipt_${Date.now()}`,
        payment_capture: 1
      };

      console.log(`[CreateOrder] Razorpay Options:`, options);
      order = await razorpay.orders.create(options);
      console.log(`[CreateOrder] Razorpay Order Created:`, order.id, "Amount:", order.amount);
    }

    // Calculate payment distribution
    const adminFee = Math.round(amount * 0.10); // 10%
    const gatewayFee = Math.round(amount * 0.02); // 2%
    const mentorAmount = amount - adminFee - gatewayFee; // 88%

    // Save payment record
    const payment = new Payment({
      userId: req.user.id,
      bookingId: bookingId || null,
      masterClassId: masterClassId || null,
      type,
      razorpayOrderId: order.id,
      amount,
      currency: 'INR',
      status: 'created',
      adminFee,
      gatewayFee,
      mentorAmount,
      payoutStatus: 'pending'
    });

    await payment.save();

    res.json({
      success: true,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID,
      payment
    });

  } catch (error) {
    console.error('Create Order Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create order',
      error: error.message
    });
  }
});

// @route   POST /api/payments/verify
// @desc    Verify Razorpay payment
// @access  Private
router.post('/verify', authenticateToken, async (req, res) => {
  try {
    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;

    // Verify signature
    const sign = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSign = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(sign.toString())
      .digest('hex');

    if (razorpaySignature === expectedSign) {
      // Payment verified successfully
      const payment = await Payment.findOne({ razorpayOrderId });

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment record not found'
        });
      }

      payment.razorpayPaymentId = razorpayPaymentId;
      payment.razorpaySignature = razorpaySignature;
      payment.status = 'completed';
      await payment.save();

      // Update booking payment status
      if (payment.bookingId) {
        const booking = await Booking.findById(payment.bookingId);
        if (booking) {
          booking.paymentStatus = 'completed';
          booking.paymentId = razorpayPaymentId;
          await booking.save();
        }
      }

      // Update master class enrollment
      if (payment.masterClassId) {
        const masterClass = await MasterClass.findById(payment.masterClassId);
        if (masterClass && !masterClass.currentParticipants.includes(payment.userId)) {
          masterClass.currentParticipants.push(payment.userId);
          await masterClass.save();
        }
      }

      // Send confirmation email
      const user = await User.findById(payment.userId);
      if (user) {
        await sendEmail({
          to: user.email,
          subject: 'Payment Successful - MentorConnect',
          html: `
            <h2>Payment Successful!</h2>
            <p>Your payment of <strong>₹${payment.amount}</strong> has been processed successfully.</p>
            <p><strong>Payment ID:</strong> ${razorpayPaymentId}</p>
            <p><strong>Order ID:</strong> ${razorpayOrderId}</p>
            <br>
            <p>Thank you for using MentorConnect!</p>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }

      res.json({
        success: true,
        message: 'Payment verified successfully',
        payment
      });

    } else {
      // Invalid signature
      const payment = await Payment.findOne({ razorpayOrderId });
      if (payment) {
        payment.status = 'failed';
        await payment.save();
      }

      res.status(400).json({
        success: false,
        message: 'Invalid payment signature'
      });
    }

  } catch (error) {
    console.error('Verify Payment Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify payment',
      error: error.message
    });
  }
});

// @route   POST /api/payments/refund
// @desc    Process refund
// @access  Private/Admin
router.post('/refund', authenticateToken, async (req, res) => {
  try {
    const { paymentId, amount, reason } = req.body;

    const payment = await Payment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Create refund in Razorpay
    const refund = await razorpay.payments.refund(payment.razorpayPaymentId, {
      amount: (amount || payment.amount) * 100, // Amount in paise
      notes: {
        reason: reason || 'Booking cancelled'
      }
    });

    // Update payment record
    payment.status = 'refunded';
    payment.refundId = refund.id;
    payment.refundAmount = amount || payment.amount;
    await payment.save();

    // Update booking
    if (payment.bookingId) {
      const booking = await Booking.findById(payment.bookingId);
      if (booking) {
        booking.refundStatus = 'completed';
        booking.refundAmount = amount || payment.amount;
        await booking.save();
      }
    }

    res.json({
      success: true,
      message: 'Refund processed successfully',
      refund
    });

  } catch (error) {
    console.error('Refund Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process refund',
      error: error.message
    });
  }
});

// @route   GET /api/payments/user/:userId
// @desc    Get user payments
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.params.userId })
      .populate('bookingId')
      .populate('masterClassId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: payments.length,
      payments
    });

  } catch (error) {
    console.error('Get User Payments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

// @route   GET /api/payments/mentor/:mentorId/earnings
// @desc    Get mentor earnings
// @access  Private
router.get('/mentor/:mentorId/earnings', authenticateToken, async (req, res) => {
  try {
    const { mentorId } = req.params;

    // Get all completed bookings for this mentor
    const completedBookings = await Booking.find({
      achieverId: mentorId,
      status: 'completed',
      paymentStatus: 'completed'
    });

    // Get all payments for these bookings
    const bookingIds = completedBookings.map(b => b._id);
    const payments = await Payment.find({
      bookingId: { $in: bookingIds },
      status: 'completed'
    });

    // Calculate earnings
    const totalEarnings = payments.reduce((sum, p) => sum + p.mentorAmount, 0);
    const pendingPayout = payments
      .filter(p => p.payoutStatus === 'pending')
      .reduce((sum, p) => sum + p.mentorAmount, 0);
    const completedPayout = payments
      .filter(p => p.payoutStatus === 'completed')
      .reduce((sum, p) => sum + p.mentorAmount, 0);

    // Get master class earnings
    const masterClasses = await MasterClass.find({
      achieverId: mentorId,
      status: 'completed'
    });

    const masterClassIds = masterClasses.map(mc => mc._id);
    const masterClassPayments = await Payment.find({
      masterClassId: { $in: masterClassIds },
      status: 'completed'
    });

    const masterClassEarnings = masterClassPayments.reduce((sum, p) => sum + p.mentorAmount, 0);

    res.json({
      success: true,
      earnings: {
        totalEarnings: totalEarnings + masterClassEarnings,
        sessionEarnings: totalEarnings,
        masterClassEarnings,
        pendingPayout,
        completedPayout,
        totalSessions: completedBookings.length,
        totalMasterClasses: masterClasses.length
      },
      payments,
      masterClassPayments
    });

  } catch (error) {
    console.error('Get Mentor Earnings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch earnings',
      error: error.message
    });
  }
});

// @route   POST /api/payments/payout
// @desc    Process mentor payout
// @access  Private/Admin
router.post('/payout', authenticateToken, async (req, res) => {
  try {
    const { mentorId, amount, paymentIds } = req.body;

    // Update payment records
    await Payment.updateMany(
      { _id: { $in: paymentIds } },
      {
        payoutStatus: 'completed',
        payoutDate: new Date()
      }
    );

    // Send email to mentor
    const mentor = await User.findById(mentorId);
    if (mentor) {
      await sendEmail({
        to: mentor.email,
        subject: 'Payout Processed - MentorConnect',
        html: `
          <h2>Payout Processed!</h2>
          <p>Your payout of <strong>₹${amount}</strong> has been processed successfully.</p>
          <p>The amount will be credited to your registered account within 2-3 business days.</p>
          <br>
          <p>Thank you for being a valuable mentor!</p>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Payout processed successfully'
    });

  } catch (error) {
    console.error('Payout Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout',
      error: error.message
    });
  }
});

// @route   GET /api/payments
// @desc    Get all payments (Admin)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('userId', 'name email userType')
      .populate('bookingId')
      .populate('masterClassId')
      .sort({ createdAt: -1 });

    // Calculate statistics
    const totalRevenue = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.amount, 0);

    const adminRevenue = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.adminFee, 0);

    const mentorPayouts = payments
      .filter(p => p.status === 'completed')
      .reduce((sum, p) => sum + p.mentorAmount, 0);

    res.json({
      success: true,
      count: payments.length,
      statistics: {
        totalRevenue,
        adminRevenue,
        mentorPayouts,
        pendingPayouts: payments.filter(p => p.payoutStatus === 'pending').length,
        completedPayouts: payments.filter(p => p.payoutStatus === 'completed').length
      },
      payments
    });

  } catch (error) {
    console.error('Get All Payments Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: error.message
    });
  }
});

module.exports = router;