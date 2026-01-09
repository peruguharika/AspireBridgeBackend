const mongoose = require('mongoose');

const LockedTransactionSchema = new mongoose.Schema({
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true
  },
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
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  platformFee: {
    type: Number,
    required: true,
    min: 0
  },
  razorpayFee: {
    type: Number,
    required: true,
    min: 0
  },
  achieverAmount: {
    type: Number,
    required: true,
    min: 0
  },
  status: {
    type: String,
    enum: ['locked', 'released', 'refunded'],
    default: 'locked'
  },
  razorpayPaymentId: {
    type: String,
    required: true
  },
  lockedAt: {
    type: Date,
    default: Date.now
  },
  releasedAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  sessionCompletedAt: {
    type: Date
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for faster queries
LockedTransactionSchema.index({ bookingId: 1 });
LockedTransactionSchema.index({ aspirantId: 1 });
LockedTransactionSchema.index({ achieverId: 1 });
LockedTransactionSchema.index({ status: 1 });
LockedTransactionSchema.index({ lockedAt: -1 });

module.exports = mongoose.model('LockedTransaction', LockedTransactionSchema);