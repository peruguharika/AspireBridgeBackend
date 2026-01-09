const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Session = require('../models/Session');
const MasterClass = require('../models/MasterClass');
const Resource = require('../models/Resource');
const MentorPost = require('../models/MentorPost');
const Feedback = require('../models/Feedback');
const Report = require('../models/Report');
const { authenticateToken, isAdmin } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// Apply admin middleware to all routes
router.use(authenticateToken);
router.use(isAdmin);

// ==================== DASHBOARD STATISTICS ====================

// @route   GET /api/admin/stats
// @desc    Get admin dashboard statistics
// @access  Private/Admin
router.get('/stats', async (req, res) => {
  try {
    // User statistics
    const totalUsers = await User.countDocuments();
    const totalAspirants = await User.countDocuments({ userType: 'aspirant' });
    const totalAchievers = await User.countDocuments({ userType: 'achiever' });
    const pendingApprovals = await User.countDocuments({ 
      userType: 'achiever', 
      approvalStatus: 'pending' 
    });
    const approvedAchievers = await User.countDocuments({ 
      userType: 'achiever', 
      approvalStatus: 'approved' 
    });

    // Booking statistics
    const totalBookings = await Booking.countDocuments();
    const pendingBookings = await Booking.countDocuments({ status: 'pending' });
    const confirmedBookings = await Booking.countDocuments({ status: 'confirmed' });
    const completedBookings = await Booking.countDocuments({ status: 'completed' });
    const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });

    // Payment statistics
    const payments = await Payment.find({ status: 'completed' });
    const totalRevenue = payments.reduce((sum, p) => sum + p.amount, 0);
    const adminRevenue = payments.reduce((sum, p) => sum + p.adminFee, 0);
    const mentorEarnings = payments.reduce((sum, p) => sum + p.mentorAmount, 0);
    const pendingPayouts = await Payment.countDocuments({ payoutStatus: 'pending' });

    // Session statistics
    const totalSessions = await Session.countDocuments();
    const completedSessions = await Session.countDocuments({ status: 'completed' });
    const ongoingSessions = await Session.countDocuments({ status: 'ongoing' });

    // Master Class statistics
    const totalMasterClasses = await MasterClass.countDocuments();
    const upcomingMasterClasses = await MasterClass.countDocuments({ status: 'upcoming' });

    // Resource statistics
    const totalResources = await Resource.countDocuments();

    // Report statistics
    const totalReports = await Report.countDocuments();
    const openReports = await Report.countDocuments({ status: 'open' });

    // Recent activity
    const recentUsers = await User.find()
      .select('name email userType createdAt')
      .sort({ createdAt: -1 })
      .limit(5);

    const recentBookings = await Booking.find()
      .select('aspirantName mentorName date status')
      .sort({ createdAt: -1 })
      .limit(5);

    res.json({
      success: true,
      statistics: {
        users: {
          total: totalUsers,
          aspirants: totalAspirants,
          achievers: totalAchievers,
          pendingApprovals,
          approvedAchievers
        },
        bookings: {
          total: totalBookings,
          pending: pendingBookings,
          confirmed: confirmedBookings,
          completed: completedBookings,
          cancelled: cancelledBookings
        },
        payments: {
          totalRevenue,
          adminRevenue,
          mentorEarnings,
          pendingPayouts,
          transactionCount: payments.length
        },
        sessions: {
          total: totalSessions,
          completed: completedSessions,
          ongoing: ongoingSessions
        },
        masterClasses: {
          total: totalMasterClasses,
          upcoming: upcomingMasterClasses
        },
        resources: {
          total: totalResources
        },
        reports: {
          total: totalReports,
          open: openReports
        }
      },
      recentActivity: {
        users: recentUsers,
        bookings: recentBookings
      }
    });

  } catch (error) {
    console.error('Get Admin Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch statistics',
      error: error.message
    });
  }
});

// ==================== USER MANAGEMENT ====================

// @route   GET /api/admin/users
// @desc    Get all users with filters
// @access  Private/Admin
router.get('/users', async (req, res) => {
  try {
    const { userType, approvalStatus, search } = req.query;
    
    let query = {};
    if (userType) query.userType = userType;
    if (approvalStatus) query.approvalStatus = approvalStatus;
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ];
    }

    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('Get Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
});

// @route   GET /api/admin/users/pending-approval
// @desc    Get achievers pending approval
// @access  Private/Admin
router.get('/users/pending-approval', async (req, res) => {
  try {
    const users = await User.find({
      userType: 'achiever',
      approvalStatus: 'pending'
    })
    .select('-password')
    .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: users.length,
      users
    });

  } catch (error) {
    console.error('Get Pending Users Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending users',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/users/:id/approve
// @desc    Approve achiever
// @access  Private/Admin
router.put('/users/:id/approve', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.approved = true;
    user.approvalStatus = 'approved';
    await user.save();

    // Send approval email
    await sendEmail({
      to: user.email,
      subject: 'Profile Approved - MentorConnect',
      html: `
        <h2>Congratulations! Your Profile is Approved</h2>
        <p>Dear ${user.name},</p>
        <p>Your mentor profile has been verified and approved by our admin team.</p>
        <p>Your profile is now visible to aspirants, and you can start accepting session requests.</p>
        <p>Next steps:</p>
        <ul>
          <li>Set your availability slots</li>
          <li>Complete your profile with bio and photo</li>
          <li>Start accepting mentorship requests</li>
        </ul>
        <br>
        <p>Thank you for being part of MentorConnect!</p>
        <p>Best regards,<br>MentorConnect Team</p>
      `
    });

    res.json({
      success: true,
      message: 'User approved successfully',
      user
    });

  } catch (error) {
    console.error('Approve User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to approve user',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/users/:id/reject
// @desc    Reject achiever
// @access  Private/Admin
router.put('/users/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.approved = false;
    user.approvalStatus = 'rejected';
    await user.save();

    // Send rejection email
    await sendEmail({
      to: user.email,
      subject: 'Profile Status Update - MentorConnect',
      html: `
        <h2>Profile Review Update</h2>
        <p>Dear ${user.name},</p>
        <p>Thank you for your interest in becoming a mentor on MentorConnect.</p>
        <p>After careful review, we are unable to approve your profile at this time.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
        <p>If you have any questions or would like to reapply, please contact our support team.</p>
        <br>
        <p>Best regards,<br>MentorConnect Team</p>
      `
    });

    res.json({
      success: true,
      message: 'User rejected',
      user
    });

  } catch (error) {
    console.error('Reject User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to reject user',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/users/:id
// @desc    Delete user
// @access  Private/Admin
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      message: 'User deleted successfully'
    });

  } catch (error) {
    console.error('Delete User Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
});

// ==================== BOOKING MANAGEMENT ====================

// @route   GET /api/admin/bookings
// @desc    Get all bookings
// @access  Private/Admin
router.get('/bookings', async (req, res) => {
  try {
    const bookings = await Booking.find()
      .populate('aspirantId', 'name email')
      .populate('achieverId', 'name email')
      .sort({ createdAt: -1 });

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

// @route   DELETE /api/admin/bookings/:id
// @desc    Delete booking
// @access  Private/Admin
router.delete('/bookings/:id', async (req, res) => {
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

// ==================== PAYMENT MANAGEMENT ====================

// @route   GET /api/admin/payments/pending-payouts
// @desc    Get pending payouts
// @access  Private/Admin
router.get('/payments/pending-payouts', async (req, res) => {
  try {
    const payments = await Payment.find({ 
      status: 'completed',
      payoutStatus: 'pending' 
    })
    .populate('userId', 'name email')
    .populate('bookingId')
    .sort({ createdAt: -1 });

    // Group by mentor
    const payoutsByMentor = {};
    
    for (const payment of payments) {
      const booking = await Booking.findById(payment.bookingId);
      if (booking && booking.achieverId) {
        const mentorId = booking.achieverId.toString();
        
        if (!payoutsByMentor[mentorId]) {
          const mentor = await User.findById(mentorId).select('name email');
          payoutsByMentor[mentorId] = {
            mentor,
            totalAmount: 0,
            payments: []
          };
        }
        
        payoutsByMentor[mentorId].totalAmount += payment.mentorAmount;
        payoutsByMentor[mentorId].payments.push(payment);
      }
    }

    res.json({
      success: true,
      count: Object.keys(payoutsByMentor).length,
      payouts: Object.values(payoutsByMentor)
    });

  } catch (error) {
    console.error('Get Pending Payouts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch pending payouts',
      error: error.message
    });
  }
});

// @route   POST /api/admin/payments/process-payout
// @desc    Process payout for mentor
// @access  Private/Admin
router.post('/payments/process-payout', async (req, res) => {
  try {
    const { mentorId, paymentIds, totalAmount } = req.body;

    // Update all payments
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
          <h2>Payout Processed Successfully!</h2>
          <p>Dear ${mentor.name},</p>
          <p>Your payout of <strong>₹${totalAmount}</strong> has been processed.</p>
          <p>The amount will be credited to your registered bank account within 2-3 business days.</p>
          <p><strong>Payment Details:</strong></p>
          <ul>
            <li>Amount: ₹${totalAmount}</li>
            <li>Transactions: ${paymentIds.length}</li>
            <li>Date: ${new Date().toLocaleDateString()}</li>
          </ul>
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
    console.error('Process Payout Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process payout',
      error: error.message
    });
  }
});

// ==================== CONTENT MANAGEMENT ====================

// @route   GET /api/admin/posts
// @desc    Get all mentor posts
// @access  Private/Admin
router.get('/posts', async (req, res) => {
  try {
    const posts = await MentorPost.find()
      .populate('mentorId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: posts.length,
      posts
    });

  } catch (error) {
    console.error('Get Posts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/posts/:id
// @desc    Delete mentor post
// @access  Private/Admin
router.delete('/posts/:id', async (req, res) => {
  try {
    const post = await MentorPost.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete Post Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

// @route   GET /api/admin/feedbacks
// @desc    Get all feedbacks
// @access  Private/Admin
router.get('/feedbacks', async (req, res) => {
  try {
    const feedbacks = await Feedback.find()
      .populate('fromUserId', 'name email')
      .populate('toUserId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: feedbacks.length,
      feedbacks
    });

  } catch (error) {
    console.error('Get Feedbacks Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
});

// @route   DELETE /api/admin/feedbacks/:id
// @desc    Delete feedback
// @access  Private/Admin
router.delete('/feedbacks/:id', async (req, res) => {
  try {
    const feedback = await Feedback.findByIdAndDelete(req.params.id);

    if (!feedback) {
      return res.status(404).json({
        success: false,
        message: 'Feedback not found'
      });
    }

    res.json({
      success: true,
      message: 'Feedback deleted successfully'
    });

  } catch (error) {
    console.error('Delete Feedback Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete feedback',
      error: error.message
    });
  }
});

// ==================== REPORT MANAGEMENT ====================

// @route   GET /api/admin/reports
// @desc    Get all reports
// @access  Private/Admin
router.get('/reports', async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = {};
    if (status) query.status = status;

    const reports = await Report.find(query)
      .populate('userId', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (error) {
    console.error('Get Reports Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// @route   PUT /api/admin/reports/:id/respond
// @desc    Respond to report
// @access  Private/Admin
router.put('/reports/:id/respond', async (req, res) => {
  try {
    const { response, status } = req.body;

    const report = await Report.findById(req.params.id);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    report.adminResponse = response;
    report.status = status || 'resolved';
    report.respondedAt = new Date();
    await report.save();

    // Send email to user
    const user = await User.findById(report.userId);
    if (user) {
      await sendEmail({
        to: user.email,
        subject: 'Report Update - MentorConnect',
        html: `
          <h2>Your Report Has Been Updated</h2>
          <p>Dear ${user.name},</p>
          <p><strong>Subject:</strong> ${report.subject}</p>
          <p><strong>Status:</strong> ${report.status}</p>
          <p><strong>Admin Response:</strong></p>
          <p>${response}</p>
          <br>
          <p>If you have any further questions, please don't hesitate to contact us.</p>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Response sent successfully',
      report
    });

  } catch (error) {
    console.error('Respond to Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to respond to report',
      error: error.message
    });
  }
});

module.exports = router;