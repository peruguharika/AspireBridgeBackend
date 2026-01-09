const nodemailer = require('nodemailer');

// Create transporter with fallback configuration
let transporter;

try {
  transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    },
    // Add these for better compatibility
    tls: {
      rejectUnauthorized: false
    }
  });

  // Verify transporter configuration
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email configuration error:', error);
      console.log('📧 Email service will run in mock mode');
    } else {
      console.log('✅ Email server is ready to send messages');
    }
  });
} catch (error) {
  console.error('❌ Failed to create email transporter:', error);
  console.log('📧 Email service will run in mock mode');

  // Create a mock transporter for development
  transporter = {
    sendMail: async (options) => {
      console.log('📧 [MOCK EMAIL]');
      console.log('To:', options.to);
      console.log('Subject:', options.subject);
      console.log('Content:', options.text || 'HTML content');
      return { messageId: 'mock-' + Date.now() };
    }
  };
}

/**
 * Send email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email
 * @param {string} options.subject - Email subject
 * @param {string} options.html - HTML content
 * @param {string} options.text - Plain text content (optional)
 */
const sendEmail = async (options) => {
  try {
    const mailOptions = {
      from: process.env.EMAIL_FROM || 'MentorConnect <noreply@mentorconnect.com>',
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text || ''
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('❌ Email send error:', error.message);
    // Don't throw error in development, just log it
    return { success: false, error: error.message };
  }
};

/**
 * Send OTP email
 * @param {string} email - Recipient email
 * @param {string} otp - OTP code
 */
const sendOTPEmail = async (email, otp) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
          background-color: #f9f9f9;
        }
        .header {
          background-color: #2563eb;
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .content {
          background-color: white;
          padding: 30px;
          border-radius: 0 0 8px 8px;
        }
        .otp-box {
          background-color: #eff6ff;
          border: 2px dashed #2563eb;
          padding: 20px;
          text-align: center;
          font-size: 32px;
          font-weight: bold;
          letter-spacing: 8px;
          margin: 20px 0;
          border-radius: 8px;
          color: #2563eb;
        }
        .footer {
          text-align: center;
          margin-top: 20px;
          font-size: 12px;
          color: #666;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>MentorConnect</h1>
        </div>
        <div class="content">
          <h2>Email Verification</h2>
          <p>Thank you for signing up with MentorConnect!</p>
          <p>Your One-Time Password (OTP) for email verification is:</p>
          <div class="otp-box">${otp}</div>
          <p><strong>This OTP will expire in 10 minutes.</strong></p>
          <p>If you didn't request this OTP, please ignore this email.</p>
          <br>
          <p>Best regards,<br>MentorConnect Team</p>
        </div>
        <div class="footer">
          <p>© 2024 MentorConnect. All rights reserved.</p>
          <p>This is an automated email. Please do not reply.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    MentorConnect - Email Verification
    
    Your OTP for email verification is: ${otp}
    
    This OTP will expire in 10 minutes.
    
    If you didn't request this OTP, please ignore this email.
  `;

  return await sendEmail({
    to: email,
    subject: 'Email Verification - MentorConnect',
    html,
    text
  });
};

/**
 * Send booking confirmation email
 */
const sendBookingConfirmation = async (email, bookingDetails) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #10b981; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
        .details { background-color: white; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .detail-row { padding: 10px 0; border-bottom: 1px solid #eee; }
        .detail-row:last-child { border-bottom: none; }
        .footer { text-align: center; margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✅ Booking Confirmed!</h1>
        </div>
        <div class="content">
          <p>Your mentorship session has been confirmed.</p>
          <div class="details">
            <div class="detail-row"><strong>Mentor:</strong> ${bookingDetails.mentorName}</div>
            <div class="detail-row"><strong>Date:</strong> ${bookingDetails.date}</div>
            <div class="detail-row"><strong>Time:</strong> ${bookingDetails.time}</div>
            <div class="detail-row"><strong>Amount:</strong> ₹${bookingDetails.amount}</div>
          </div>
          <p>You can join the session from your dashboard at the scheduled time.</p>
          <p>Best regards,<br>MentorConnect Team</p>
        </div>
        <div class="footer">
          <p>© 2024 MentorConnect. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
    MentorConnect - Booking Confirmed!
    
    Your mentorship session has been confirmed.
    
    Mentor: ${bookingDetails.mentorName}
    Date: ${bookingDetails.date}
    Time: ${bookingDetails.time}
    Amount: ₹${bookingDetails.amount}
    
    You can join the session from your dashboard at the scheduled time.
  `;

  return await sendEmail({
    to: email,
    subject: 'Booking Confirmed - MentorConnect',
    html,
    text
  });
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (email, name, userType) => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to MentorConnect! 🎉</h1>
        </div>
        <div class="content">
          <p>Hi ${name},</p>
          <p>Thank you for joining MentorConnect as ${userType === 'achiever' ? 'an Achiever' : 'an Aspirant'}!</p>
          <p>We're excited to have you on board and help you achieve your goals.</p>
          <a href="#" class="button">Get Started</a>
          <p>Best regards,<br>The MentorConnect Team</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: 'Welcome to MentorConnect! 🎉',
    html
  });
};

/**
 * Send password reset email
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #ef4444; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background-color: white; padding: 30px; border-radius: 0 0 8px 8px; }
        .button { display: inline-block; background-color: #ef4444; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset Request</h1>
        </div>
        <div class="content">
          <p>You requested to reset your password.</p>
          <p>Click the button below to reset your password:</p>
          <a href="${resetUrl}" class="button">Reset Password</a>
          <p>Or copy this link: ${resetUrl}</p>
          <p><strong>This link will expire in 1 hour.</strong></p>
          <p>If you didn't request this, please ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return await sendEmail({
    to: email,
    subject: 'Password Reset - MentorConnect',
    html
  });
};

module.exports = {
  sendEmail,
  sendOTPEmail,
  sendBookingConfirmation,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  transporter
};