const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  userType: {
    type: String,
    enum: ['aspirant', 'achiever', 'admin'],
    required: true
  },
  // Aspirant specific fields
  examType: { // Can be used as Exam Name
    type: String,
    default: ''
  },
  examCategory: { // e.g. UPSC, SSC
    type: String,
    default: ''
  },
  examSubCategory: {
    type: String,
    default: ''
  },
  // Achiever specific fields
  rank: {
    type: String,
    default: ''
  },
  year: {
    type: String,
    default: ''
  },
  bio: {
    type: String,
    default: ''
  },
  photoUrl: {
    type: String,
    default: ''
  },
  documentUrl: { // For storing scorecard/certificate
    type: String,
    default: ''
  },
  approved: {
    type: Boolean,
    default: false
  },
  approvalStatus: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  // Common fields
  phone: {
    type: String,
    default: ''
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  otpVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: {
    type: Date,
    default: Date.now
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

// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
UserSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);