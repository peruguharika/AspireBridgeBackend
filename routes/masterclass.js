const express = require('express');
const router = express.Router();
const MasterClass = require('../models/MasterClass');
const Session = require('../models/Session');
const { authenticateToken } = require('../middleware/auth');
const { sendEmail } = require('../services/emailService');

// @route   POST /api/masterclass
// @desc    Create master class
// @access  Private (Achievers only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      achieverName,
      examType,
      date,
      time,
      duration,
      price
    } = req.body;

    // Check if achiever has completed 5 sessions
    const completedSessions = await Session.countDocuments({
      achieverId: req.user.id,
      status: 'completed'
    });

    if (completedSessions < 5) {
      return res.status(403).json({
        success: false,
        message: 'You need to complete 5 sessions before creating a master class',
        completedSessions
      });
    }

    const masterClass = new MasterClass({
      title,
      description,
      achieverId: req.user.id,
      achieverName,
      examType,
      date,
      time,
      duration,
      price,
      maxParticipants: 5,
      currentParticipants: []
    });

    await masterClass.save();

    res.status(201).json({
      success: true,
      message: 'Master class created successfully',
      masterClass
    });

  } catch (error) {
    console.error('Create Master Class Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create master class',
      error: error.message
    });
  }
});

// @route   GET /api/masterclass
// @desc    Get all master classes
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { status, achieverId } = req.query;
    
    let query = {};
    if (status) query.status = status;
    if (achieverId) query.achieverId = achieverId;

    const masterClasses = await MasterClass.find(query)
      .populate('achieverId', 'name email examType')
      .populate('currentParticipants', 'name email')
      .sort({ date: 1 });

    res.json({
      success: true,
      count: masterClasses.length,
      masterClasses
    });

  } catch (error) {
    console.error('Get Master Classes Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch master classes',
      error: error.message
    });
  }
});

// @route   GET /api/masterclass/:id
// @desc    Get single master class
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const masterClass = await MasterClass.findById(req.params.id)
      .populate('achieverId', 'name email examType')
      .populate('currentParticipants', 'name email');

    if (!masterClass) {
      return res.status(404).json({
        success: false,
        message: 'Master class not found'
      });
    }

    res.json({
      success: true,
      masterClass
    });

  } catch (error) {
    console.error('Get Master Class Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch master class',
      error: error.message
    });
  }
});

// @route   POST /api/masterclass/:id/enroll
// @desc    Enroll in master class
// @access  Private
router.post('/:id/enroll', authenticateToken, async (req, res) => {
  try {
    const masterClass = await MasterClass.findById(req.params.id);

    if (!masterClass) {
      return res.status(404).json({
        success: false,
        message: 'Master class not found'
      });
    }

    // Check if already enrolled
    if (masterClass.currentParticipants.includes(req.user.id)) {
      return res.status(400).json({
        success: false,
        message: 'You are already enrolled in this master class'
      });
    }

    // Check if full
    if (masterClass.currentParticipants.length >= masterClass.maxParticipants) {
      return res.status(400).json({
        success: false,
        message: 'This master class is full'
      });
    }

    masterClass.currentParticipants.push(req.user.id);
    await masterClass.save();

    // Send confirmation emails
    const User = require('../models/User');
    const user = await User.findById(req.user.id);
    const achiever = await User.findById(masterClass.achieverId);

    if (user) {
      await sendEmail({
        to: user.email,
        subject: 'Master Class Enrollment Confirmed - MentorConnect',
        html: `
          <h2>Enrollment Confirmed!</h2>
          <p>Dear ${user.name},</p>
          <p>You have successfully enrolled in the master class: <strong>${masterClass.title}</strong></p>
          <p><strong>Details:</strong></p>
          <ul>
            <li>Instructor: ${masterClass.achieverName}</li>
            <li>Date: ${masterClass.date}</li>
            <li>Time: ${masterClass.time}</li>
            <li>Duration: ${masterClass.duration} minutes</li>
          </ul>
          <p>You will receive the meeting link shortly before the session starts.</p>
          <br>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    if (achiever) {
      await sendEmail({
        to: achiever.email,
        subject: 'New Enrollment in Your Master Class - MentorConnect',
        html: `
          <h2>New Enrollment!</h2>
          <p>Dear ${achiever.name},</p>
          <p><strong>${user.name}</strong> has enrolled in your master class: <strong>${masterClass.title}</strong></p>
          <p>Current enrollment: ${masterClass.currentParticipants.length}/${masterClass.maxParticipants}</p>
          <br>
          <p>Best regards,<br>MentorConnect Team</p>
        `
      });
    }

    res.json({
      success: true,
      message: 'Enrolled successfully',
      masterClass
    });

  } catch (error) {
    console.error('Enroll Master Class Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to enroll',
      error: error.message
    });
  }
});

// @route   PUT /api/masterclass/:id
// @desc    Update master class
// @access  Private (Owner only)
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const masterClass = await MasterClass.findById(req.params.id);

    if (!masterClass) {
      return res.status(404).json({
        success: false,
        message: 'Master class not found'
      });
    }

    // Check ownership
    if (masterClass.achieverId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const updates = req.body;
    Object.keys(updates).forEach(key => {
      masterClass[key] = updates[key];
    });

    await masterClass.save();

    res.json({
      success: true,
      message: 'Master class updated successfully',
      masterClass
    });

  } catch (error) {
    console.error('Update Master Class Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update master class',
      error: error.message
    });
  }
});

// @route   DELETE /api/masterclass/:id
// @desc    Delete master class
// @access  Private (Owner or Admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const masterClass = await MasterClass.findById(req.params.id);

    if (!masterClass) {
      return res.status(404).json({
        success: false,
        message: 'Master class not found'
      });
    }

    // Check ownership or admin
    if (masterClass.achieverId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await MasterClass.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Master class deleted successfully'
    });

  } catch (error) {
    console.error('Delete Master Class Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete master class',
      error: error.message
    });
  }
});

module.exports = router;
