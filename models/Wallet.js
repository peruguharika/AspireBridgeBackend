const mongoose = require('mongoose');

const WalletSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  userType: {
    type: String,
    enum: ['aspirant', 'achiever', 'admin'],
    required: true
  },
  balance: {
    type: Number,
    default: 0,
    min: 0
  },
  lockedBalance: {
    type: Number,
    default: 0,
    min: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  totalWithdrawn: {
    type: Number,
    default: 0
  },
  transactions: [{
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    amount: {
      type: Number,
      required: true
    },
    source: {
      type: String,
      enum: ['session-payment', 'refund', 'withdrawal', 'admin-fee', 'topup', 'booking'],
      required: true
    },
    description: {
      type: String,
      required: true
    },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Session'
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    paymentId: {
      type: String
    },
    orderId: {
      type: String
    },
    razorpayTransactionId: {
      type: String
    },
    razorpayTransferId: {
      type: String
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  bankDetails: {
    accountHolderName: {
      type: String
    },
    accountNumber: {
      type: String
    },
    ifscCode: {
      type: String
    },
    bankName: {
      type: String
    },
    verified: {
      type: Boolean,
      default: false
    }
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
// Index for faster queries
// WalletSchema.index({ userId: 1 }); // Removed to avoid Duplicate Schema Index error (already unique: true)
WalletSchema.index({ userType: 1 });

module.exports = mongoose.model('Wallet', WalletSchema);