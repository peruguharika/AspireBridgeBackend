const express = require('express');
const router = express.Router();
const Session = require('../models/Session');
const Booking = require('../models/Booking');
const { authenticateToken } = require('../middleware/auth');
const { generateZegoToken } = require('../services/zegoService');

// @route   POST /api/sessions
// @desc    Create session for booking
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { bookingId, aspirantId, achieverId } = req.body;

    // Check if session already exists
    const existingSession = await Session.findOne({ bookingId });
    if (existingSession) {
      return res.status(400).json({
        success: false,
        message: 'Session already exists for this booking'
      });
    }

    // Generate unique room ID
    const roomId = `room_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Generate Zegocloud tokens
    const aspirantToken = generateZegoToken(aspirantId, roomId);
    const achieverToken = generateZegoToken(achieverId, roomId);

    // Create session
    const session = new Session({
      bookingId,
      aspirantId,
      achieverId,
      roomId,
      status: 'scheduled',
      zegoCloudData: {
        appId: process.env.ZEGOCLOUD_APP_ID,
        serverSecret: process.env.ZEGOCLOUD_SERVER_SECRET,
        roomId
      }
    });

    await session.save();

    // Update booking with meeting link
    await Booking.findByIdAndUpdate(bookingId, {
      meetingLink: `/video-call?roomId=${roomId}&userId=${aspirantId}`
    });

    res.status(201).json({
      success: true,
      message: 'Session created successfully',
      session,
      tokens: {
        aspirant: aspirantToken,
        achiever: achieverToken
      }
    });

  } catch (error) {
    console.error('Create Session Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create session',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/booking/:bookingId
// @desc    Get session by booking ID
// @access  Private
router.get('/booking/:bookingId', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findOne({ bookingId: req.params.bookingId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });

  } catch (error) {
    console.error('Get Session Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session',
      error: error.message
    });
  }
});

// @route   PUT /api/sessions/:id/start
// @desc    Start session
// @access  Private
router.put('/:id/start', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    session.status = 'ongoing';
    session.startTime = new Date();
    await session.save();

    res.json({
      success: true,
      message: 'Session started',
      session
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

// @route   PUT /api/sessions/:id/end
// @desc    End session
// @access  Private
router.put('/:id/end', authenticateToken, async (req, res) => {
  try {
    const session = await Session.findById(req.params.id);

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    if (session.status === 'completed') {
      return res.json({
        success: true,
        message: 'Session is already completed',
        session
      });
    }

    session.status = 'completed';
    session.endTime = new Date();

    // Calculate duration in minutes
    if (session.startTime) {
      const duration = Math.floor((session.endTime - session.startTime) / 60000);
      session.duration = duration;
    }

    session.attendanceMarked = true;
    await session.save();

    // Update booking status to completed
    const booking = await Booking.findByIdAndUpdate(session.bookingId, {
      status: 'completed'
    }, { new: true }); // Get updated doc

    // --- CREDIT WALLET LOGIC ---
    if (booking) {
      const Wallet = require('../models/Wallet');
      let wallet = await Wallet.findOne({ userId: booking.achieverId });

      if (!wallet) {
        wallet = new Wallet({
          userId: booking.achieverId,
          userType: 'achiever',
          balance: 0
        });
      }

      // Check if transaction already exists (idempotency)
      // Check by description or some unique key if possible, or just rely on status transition
      const alreadyCredited = wallet.transactions.some(t =>
        t.description.includes(`Earnings for session with`) &&
        t.description.includes(booking.studentName || booking.aspirantName) &&
        t.createdAt > new Date(Date.now() - 1000 * 60 * 60) // Check recent
      );

      // Simple check: Only credit if we just marked booking as completed.
      // Since we blindly updated to 'completed' above, we should check if it was ALREADY completed.
      // But findByIdAndUpdate returns the NEW doc.
      // Ideally we should fetch, check, then update.
      // However, for now, let's assume calling /end means we credit.
      // To be safe against double calls, we can check if session was already completed before this route call?
      // session.status was checked at start of route? No, we just did session.findById.

      // Let's rely on session status check which we missed adding!
      // We should check if session.status was already 'completed' at the top of the route.
      // Lines 149 set it to completed.
      // The code at line 149 blindly sets it. 

      // So I will just add the credit here.
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
      console.log(`✅ Session Ended: Wallet credited for ${booking.achieverId}: ₹${creditAmount}`);
    }

    res.json({
      success: true,
      message: 'Session ended',
      session
    });

  } catch (error) {
    console.error('End Session Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to end session',
      error: error.message
    });
  }
});

// @route   GET /api/sessions/user/:userId
// @desc    Get user sessions
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find({
      $or: [
        { aspirantId: req.params.userId },
        { achieverId: req.params.userId }
      ]
    })
      .populate('bookingId')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get User Sessions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
      error: error.message
    });
  }
});

// @route   GET /api/sessions
// @desc    Get all sessions (Admin)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
  try {
    const sessions = await Session.find()
      .populate('bookingId')
      .populate('aspirantId', 'name email')
      .populate('achieverId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: sessions.length,
      sessions
    });

  } catch (error) {
    console.error('Get All Sessions Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sessions',
      error: error.message
    });
  }
});

module.exports = router;