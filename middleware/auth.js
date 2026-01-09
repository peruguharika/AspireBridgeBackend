const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authenticate JWT token
 */
const authenticateToken = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Check if admin token
    if (decoded.role === 'admin') {
      req.user = {
        id: 'admin',
        email: decoded.email,
        role: 'admin'
      };
      return next();
    }

    // Get user from database
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      userType: user.userType,
      name: user.name
    };
    
    next();

  } catch (error) {
    console.error('Auth Middleware Error:', error);
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(403).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(403).json({
        success: false,
        message: 'Token expired'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message
    });
  }
};

/**
 * Check if user is admin
 */
const isAdmin = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
};

/**
 * Check if user is achiever
 */
const isAchiever = (req, res, next) => {
  if (req.user && req.user.userType === 'achiever') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Achiever access required'
    });
  }
};

/**
 * Check if user is aspirant
 */
const isAspirant = (req, res, next) => {
  if (req.user && req.user.userType === 'aspirant') {
    next();
  } else {
    res.status(403).json({
      success: false,
      message: 'Aspirant access required'
    });
  }
};

module.exports = {
  authenticateToken,
  isAdmin,
  isAchiever,
  isAspirant
};