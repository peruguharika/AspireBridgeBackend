const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  aspirantId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  achieverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  aspirantName: {
    type: String,
    required: true
  },
  aspirantEmail: {
    type: String,
    required: true
  },
  mentorName: {
    type: String,
    required: true
  },
  mentorExam: {
    type: String,
    default: ''
  },
  date: {
    type: String,
    required: true
  },
  time: {
    type: String,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'completed', 'cancelled'],
    default: 'pending'
  },
  paymentId: {
    type: String,
    default: ''
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  amount: {
    type: Number,
    default: 500
  },
  refundStatus: {
    type: String,
    enum: ['none', 'processing', 'completed'],
    default: 'none'
  },
  refundAmount: {
    type: Number,
    default: 0
  },
  sessionStatus: {
    type: String,
    enum: ['scheduled', 'active', 'completed'],
    default: 'scheduled'
  },
  sessionStartedAt: {
    type: Date
  },
  cancelledAt: {
    type: Date
  },
  cancelledBy: {
    type: String,
    enum: ['aspirant', 'achiever'],
    default: null
  },
  meetingLink: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Booking', BookingSchema);
