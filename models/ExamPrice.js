const mongoose = require('mongoose');

const ExamPriceSchema = new mongoose.Schema({
  category: {
    type: String,
    required: true,
    trim: true
  },
  subCategory: {
    type: String,
    required: true,
    trim: true,
    unique: true
  },
  hourlyRate: {
    type: Number,
    required: true,
    min: 0
  },
  description: {
    type: String,
    default: ''
  },
  isActive: {
    type: Boolean,
    default: true
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
ExamPriceSchema.index({ category: 1, subCategory: 1 });

module.exports = mongoose.model('ExamPrice', ExamPriceSchema);