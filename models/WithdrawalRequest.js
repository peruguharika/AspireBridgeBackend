const mongoose = require('mongoose');

const WithdrawalRequestSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  walletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 1
  },
  bankDetails: {
    accountHolderName: {
      type: String,
      required: true
    },
    accountNumber: {
      type: String,
      required: true
    },
    ifscCode: {
      type: String,
      required: true
    },
    bankName: {
      type: String,
      required: true
    }
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending'
  },
  razorpayPayoutId: {
    type: String
  },
  razorpayFundAccountId: {
    type: String
  },
  processingFee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number // Amount after deducting processing fee
  },
  requestedAt: {
    type: Date,
    default: Date.now
  },
  processedAt: {
    type: Date
  },
  completedAt: {
    type: Date
  },
  failureReason: {
    type: String
  },
  adminNotes: {
    type: String
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvedAt: {
    type: Date
  },
  rejectedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  rejectedAt: {
    type: Date
  },
  rejectionReason: {
    type: String
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

// Index for faster queries
WithdrawalRequestSchema.index({ userId: 1 });
WithdrawalRequestSchema.index({ status: 1 });
WithdrawalRequestSchema.index({ requestedAt: -1 });

module.exports = mongoose.model('WithdrawalRequest', WithdrawalRequestSchema);