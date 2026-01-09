const express = require('express');
const router = express.Router();
const { sendEmail, sendOTPEmail } = require('../services/emailService');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/email/send
// @desc    Send email
// @access  Private/Admin
router.post('/send', authenticateToken, async (req, res) => {
  try {
    const { to, subject, html, text } = req.body;

    await sendEmail({ to, subject, html, text });

    res.json({
      success: true,
      message: 'Email sent successfully'
    });

  } catch (error) {
    console.error('Send Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send email',
      error: error.message
    });
  }
});

// @route   POST /api/email/send-bulk
// @desc    Send bulk emails
// @access  Private/Admin
router.post('/send-bulk', authenticateToken, async (req, res) => {
  try {
    const { recipients, subject, html } = req.body;

    const results = [];
    for (const recipient of recipients) {
      try {
        await sendEmail({
          to: recipient,
          subject,
          html
        });
        results.push({ email: recipient, success: true });
      } catch (error) {
        results.push({ email: recipient, success: false, error: error.message });
      }
    }

    res.json({
      success: true,
      message: 'Bulk emails sent',
      results
    });

  } catch (error) {
    console.error('Send Bulk Email Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send bulk emails',
      error: error.message
    });
  }
});

module.exports = router;
