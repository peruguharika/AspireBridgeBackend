const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// @route   POST /api/bookings
// @desc    Create new booking
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      aspirantId,
      achieverId,
      aspirantName,
      aspirantEmail,
      mentorName,
      mentorExam,
      date,
      time,
      message,
      amount,
      paymentId,
      orderId
    } = req.body;

    // Validation
    if (!aspirantId || !achieverId || !date || !time) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Create booking
    const booking = new Booking({
      aspirantId,
      achieverId,
      aspirantName,
      aspirantEmail,
      mentorName,
      mentorExam,
      date,
      time,
      message,
      amount: amount || 500,
      status: paymentId ? 'confirmed' : 'pending',
      paymentStatus: paymentId ? 'completed' : 'pending',
      paymentId: paymentId || '',
      orderId: orderId || ''
    });

    await booking.save();

    // Send email notification to achiever
    const achiever = await User.findById(achieverId);
    if (achiever && achiever.email) {
      await sendEmail({
        to: achiever.email,
        subject: 'New Booking Request - MentorConnect',
        html: `
          <h2>New Booking Request</h2>
          <p>You have received a new booking request from <strong>${aspirantName}</strong></p>
          <p><strong>Date:</strong> ${date}</p>
          <p><strong>Time:</strong> ${time}</p>
          <p><strong>Message:</strong> ${message}</p>
          <p>Please log in to your dashboard to accept or decline this request.</p>
          <br>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    // Update Availability Slot (Mark as Booked)
    const Availability = require('../models/Availability');
    const availability = await Availability.findOne({ userId: achieverId });
    if (availability) {
      const slotIndex = availability.specificSlots.findIndex(slot => {
        const slotDateStr = slot.date.toISOString().split('T')[0];
        // Handle potential date format differences (e.g. if req.body.date is ISO or YYYY-MM-DD)
        const bookingDateStr = date.split('T')[0];
        return slotDateStr === bookingDateStr && slot.startTime === time;
      });

      if (slotIndex !== -1) {
        availability.specificSlots[slotIndex].isBooked = true;
        availability.specificSlots[slotIndex].bookingId = booking._id;
        await availability.save();
        console.log(`✅ Slot marked booked for ${achieverId} at ${date} ${time}`);
      } else {
        console.log(`⚠️ Slot not found for booking update: ${achieverId} ${date} ${time}`);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      booking
    });

  } catch (error) {
    console.error('Create Booking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create booking',
      error: error.message
    });
  }
});

// @route   GET /api/bookings/user/:userId
// @desc    Get bookings for a user
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { userType } = req.query;

    let bookings;
    if (userType === 'aspirant') {
      bookings = await Booking.find({ aspirantId: userId }).sort({ createdAt: -1 });
    } else if (userType === 'achiever') {
      bookings = await Booking.find({ achieverId: userId }).sort({ createdAt: -1 });
    } else {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type'
      });
    }

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('Get Bookings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// @route   GET /api/bookings/:id
// @desc    Get single booking
// @access  Private
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      booking
    });

  } catch (error) {
    console.error('Get Booking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch booking',
      error: error.message
    });
  }
});

// @route   POST /api/bookings/:bookingId/start-session
// @desc    Start a session (mark as active) - Only achiever can start
// @access  Private
router.post('/:bookingId/start-session', authenticateToken, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findById(bookingId);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    // Only achiever (mentor) can start the session
    if (booking.achieverId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Only the mentor can start the session'
      });
    }

    // Check if already active
    if (booking.sessionStatus === 'active') {
      return res.json({
        success: true,
        message: 'Session is already active',
        booking
      });
    }

    // Mark session as active
    booking.sessionStatus = 'active';
    booking.sessionStartedAt = new Date();
    await booking.save();

    console.log(`✅ Session started: ${bookingId} by achiever ${userId}`);

    res.json({
      success: true,
      message: 'Session started successfully',
      booking: {
        _id: booking._id,
        sessionStatus: booking.sessionStatus,
        sessionStartedAt: booking.sessionStartedAt
      }
    });

  } catch (error) {
    console.error('Start Session Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to start session',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:id/status
// @desc    Update booking status
// @access  Private
router.put('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status'
      });
    }

    const booking = await Booking.findById(req.params.id);
    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    const previousStatus = booking.status;
    booking.status = status;
    if (req.body.paymentId) {
      booking.paymentId = req.body.paymentId;
      booking.paymentStatus = 'completed';
    }
    booking.updatedAt = Date.now();

    if (status === 'cancelled') {
      booking.cancelledAt = new Date();
      booking.cancelledBy = req.body.cancelledBy || 'aspirant';
      booking.refundStatus = 'processing';
    }

    // Handle Completed Session -> Credit Wallet
    if (status === 'completed' && previousStatus !== 'completed') {
      // Find Achiever Wallet
      const Wallet = require('../models/Wallet');
      let wallet = await Wallet.findOne({ userId: booking.achieverId });

      if (!wallet) {
        // Create wallet if not exists (fallback)
        wallet = new Wallet({
          userId: booking.achieverId,
          userType: 'achiever',
          balance: 0
        });
      }

      // Credit full amount (platform fee logic can be added here if needed)
      const creditAmount = booking.amount;

      wallet.balance += creditAmount;
      wallet.totalEarnings += creditAmount;
      wallet.transactions.push({
        type: 'credit',
        amount: creditAmount,
        source: 'session-payment',
        description: `Earnings for session with ${booking.studentName || booking.aspirantName}`
      });

      await wallet.save();
      console.log(`✅ Wallet credited for ${booking.achieverId}: ₹${creditAmount}`);
    }

    await booking.save();

    // Send email notifications
    const AspirantUser = require('../models/User'); // Use matching require name
    const aspirant = await AspirantUser.findById(booking.aspirantId);
    const achiever = await AspirantUser.findById(booking.achieverId);

    if (status === 'confirmed' && aspirant) {
      await sendEmail({
        to: aspirant.email,
        subject: 'Booking Confirmed - MentorConnect',
        html: `
          <h2>Booking Confirmed!</h2>
          <p>Your booking with <strong>${booking.mentorName}</strong> has been confirmed.</p>
          <p><strong>Date:</strong> ${booking.date}</p>
          <p><strong>Time:</strong> ${booking.time}</p>
          <p>You can join the session from your dashboard at the scheduled time.</p>
          <br>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    if (status === 'cancelled') {
      const recipient = booking.cancelledBy === 'aspirant' ? achiever : aspirant;
      if (recipient) {
        await sendEmail({
          to: recipient.email,
          subject: 'Booking Cancelled - MentorConnect',
          html: `
            <h2>Booking Cancelled</h2>
            <p>The booking scheduled for <strong>${booking.date}</strong> at <strong>${booking.time}</strong> has been cancelled.</p>
            ${booking.cancelledBy === 'achiever' ? '<p>A full refund will be processed within 5-7 business days.</p>' : ''}
            <br>
            <p>Best regards,<br>MentorConnect Team</p>
          `
        });
      }
    }

    res.json({
      success: true,
      message: 'Booking status updated successfully',
      booking
    });

  } catch (error) {
    console.error('Update Booking Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update booking status',
      error: error.message
    });
  }
});

// @route   GET /api/bookings
// @desc    Get all bookings (Admin)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    const bookings = await Booking.find().sort({ createdAt: -1 });

    res.json({
      success: true,
      count: bookings.length,
      bookings
    });

  } catch (error) {
    console.error('Get All Bookings Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch bookings',
      error: error.message
    });
  }
});

// @route   DELETE /api/bookings/:id
// @desc    Delete booking (Admin)
// @access  Private/Admin
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const booking = await Booking.findByIdAndDelete(req.params.id);

    if (!booking) {
      return res.status(404).json({
        success: false,
        message: 'Booking not found'
      });
    }

    res.json({
      success: true,
      message: 'Booking deleted successfully'
    });

  } catch (error) {
    console.error('Delete Booking Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete booking',
      error: error.message
    });
  }
});

module.exports = router;