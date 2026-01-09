const express = require('express');
const router = express.Router();
const Feedback = require('../models/Feedback');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/feedback
// @desc    Submit feedback
// @access  Private
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      sessionId,
      bookingId,
      toUserId,
      fromUserType,
      rating,
      feedback
    } = req.body;

    const newFeedback = new Feedback({
      sessionId,
      bookingId,
      fromUserId: req.user.id,
      toUserId,
      fromUserType,
      rating,
      feedback
    });

    await newFeedback.save();

    res.status(201).json({
      success: true,
      message: 'Feedback submitted successfully',
      feedback: newFeedback
    });

  } catch (error) {
    console.error('Submit Feedback Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit feedback',
      error: error.message
    });
  }
});

// @route   GET /api/feedback/user/:userId
// @desc    Get feedbacks for a user
// @access  Public
router.get('/user/:userId', async (req, res) => {
  try {
    const feedbacks = await Feedback.find({ toUserId: req.params.userId })
      .populate('fromUserId', 'name email')
      .sort({ createdAt: -1 });

    const avgRating = feedbacks.length > 0
      ? feedbacks.reduce((sum, f) => sum + f.rating, 0) / feedbacks.length
      : 0;

    res.json({
      success: true,
      count: feedbacks.length,
      averageRating: avgRating.toFixed(1),
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

// @route   GET /api/feedback
// @desc    Get all feedbacks (Admin)
// @access  Private/Admin
router.get('/', authenticateToken, async (req, res) => {
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
    console.error('Get All Feedbacks Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch feedbacks',
      error: error.message
    });
  }
});

module.exports = router;