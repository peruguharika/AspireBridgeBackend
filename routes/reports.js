const express = require('express');
const router = express.Router();
const Report = require('../models/Report');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// @route   POST /api/reports
// @desc    Create report/issue
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      userName,
      userType,
      category,
      subject,
      description,
      priority
    } = req.body;

    const report = new Report({
      userId: req.user.id,
      userName,
      userType,
      category,
      subject,
      description,
      priority: priority || 'medium',
      status: 'open'
    });

    await report.save();

    // Send email notification to admin
    await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `New Report: ${subject}`,
      html: `
        <h2>New Issue Report</h2>
        <p><strong>From:</strong> ${userName} (${userType})</p>
        <p><strong>Category:</strong> ${category}</p>
        <p><strong>Priority:</strong> ${priority}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Description:</strong></p>
        <p>${description}</p>
        <br>
        <p>Please log in to the admin panel to respond.</p>
      `
    });

    res.status(201).json({
      success: true,
      message: 'Report submitted successfully',
      report
    });

  } catch (error) {
    console.error('Create Report Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit report',
      error: error.message
    });
  }
});

// @route   GET /api/reports/user/:userId
// @desc    Get user reports
// @access  Private
router.get('/user/:userId', authenticateToken, async (req, res) => {
  try {
    const reports = await Report.find({ userId: req.params.userId })
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: reports.length,
      reports
    });

  } catch (error) {
    console.error('Get User Reports Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// @route   GET /api/reports
// @desc    Get all reports (Admin)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
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

module.exports = router;
