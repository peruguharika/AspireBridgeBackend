const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// ==================== MIDDLEWARE ====================
app.use(helmet()); // Security headers
app.use(compression()); // Compress responses
app.use(morgan('dev')); // Logging
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));
app.use(express.json());

// ==================== DATABASE CONNECTION ====================
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => {
    console.log('✅ MongoDB Connected Successfully');
    console.log('📊 Database:', mongoose.connection.name);
  })
  .catch((err) => {
    console.error('❌ MongoDB Connection Error:', err);
    process.exit(1);
  });

// ==================== ROUTES ====================
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const bookingRoutes = require('./routes/bookings');
const sessionRoutes = require('./routes/sessions');
const paymentRoutes = require('./routes/payments');
const emailRoutes = require('./routes/email');
const adminRoutes = require('./routes/admin');
const resourceRoutes = require('./routes/resources');
const masterClassRoutes = require('./routes/masterclass');
const mentorPostRoutes = require('./routes/mentorposts');
const feedbackRoutes = require('./routes/feedback');
const reportRoutes = require('./routes/reports');
const availabilityRoutes = require('./routes/availability');
const walletRoutes = require('./routes/wallets');
const followRoutes = require('./routes/follow');
const jobRoutes = require('./routes/jobs');
const settlementRoutes = require('./routes/settlements');
const successStoryRoutes = require('./routes/successStories');
const sessionCompletionRoutes = require('./routes/sessionCompletion');
const easebuzzRoutes = require('./routes/easebuzz');
const uploadRoutes = require('./routes/upload');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/masterclass', masterClassRoutes);
app.use('/api/mentorposts', mentorPostRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/availability', availabilityRoutes);
app.use('/api/wallets', walletRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/settlements', settlementRoutes);
app.use('/api/successStories', successStoryRoutes);
app.use('/api/sessionCompletion', sessionCompletionRoutes);
app.use('/api/easebuzz', easebuzzRoutes);
app.use('/api/upload', uploadRoutes);

// Serve static assets
app.use('/uploads', express.static('uploads'));

// ==================== HEALTH CHECK ====================
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    environment: process.env.NODE_ENV
  });
});

// ==================== ROOT ROUTE ====================
app.get('/', (req, res) => {
  res.json({
    message: 'MentorConnect API',
    version: '1.0.0',
    endpoints: {
      health: '/api/health',
      auth: '/api/auth',
      users: '/api/users',
      bookings: '/api/bookings',
      sessions: '/api/sessions',
      payments: '/api/payments',
      email: '/api/email',
      admin: '/api/admin',
      resources: '/api/resources',
      masterclass: '/api/masterclass',
      mentorposts: '/api/mentorposts',
      feedback: '/api/feedback',
      reports: '/api/reports'
    }
  });
});

// ==================== ERROR HANDLING ====================
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ==================== START SERVER ====================
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log('🚀 ================================');
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV}`);
  console.log(`🚀 API URL: http://localhost:${PORT}`);
  console.log('🚀 ================================');
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});