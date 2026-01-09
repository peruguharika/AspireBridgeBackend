const mongoose = require('mongoose');

const SettlementSchema = new mongoose.Schema({
  settlementId: {
    type: String,
    required: true,
    unique: true // Razorpay settlement ID
  },
  amount: {
    type: Number,
    required: true
  },
  fees: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'processed', 'failed'],
    default: 'created'
  },
  settlementDate: {
    type: Date,
    required: true
  },
  processedAt: {
    type: Date
  },
  utr: {
    type: String // Unique Transaction Reference from bank
  },
  adminWalletId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Wallet',
    required: true
  },
  transactionIds: [{
    type: String // Razorpay transaction IDs included in this settlement
  }],
  webhookData: {
    type: mongoose.Schema.Types.Mixed // Store complete webhook payload
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
SettlementSchema.index({ settlementId: 1 });
SettlementSchema.index({ status: 1 });
SettlementSchema.index({ settlementDate: 1 });

module.exports = mongoose.model('Settlement', SettlementSchema);