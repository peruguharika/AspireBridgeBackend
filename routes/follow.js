const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/follow/:userId
// @desc    Follow a user
// @access  Private
router.post('/:userId', authenticateToken, async (req, res) => {
  try {
    const userToFollow = req.params.userId;
    const currentUser = req.user.id;

    if (userToFollow === currentUser) {
      return res.status(400).json({
        success: false,
        message: 'You cannot follow yourself'
      });
    }

    // Check if user exists
    const targetUser = await User.findById(userToFollow);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Add to following list of current user
    const user = await User.findById(currentUser);
    if (!user.following) user.following = [];
    
    if (!user.following.includes(userToFollow)) {
      user.following.push(userToFollow);
      await user.save();
    }

    // Add to followers list of target user
    if (!targetUser.followers) targetUser.followers = [];
    
    if (!targetUser.followers.includes(currentUser)) {
      targetUser.followers.push(currentUser);
      await targetUser.save();
    }

    res.json({
      success: true,
      message: 'User followed successfully'
    });

  } catch (error) {
    console.error('Follow Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to follow user',
      error: error.message
    });
  }
});

// @route   DELETE /api/follow/:userId
// @desc    Unfollow a user
// @access  Private
router.delete('/:userId', authenticateToken, async (req, res) => {
  try {
    const userToUnfollow = req.params.userId;
    const currentUser = req.user.id;

    // Remove from following list of current user
    const user = await User.findById(currentUser);
    if (user.following) {
      user.following = user.following.filter(id => id.toString() !== userToUnfollow);
      await user.save();
    }

    // Remove from followers list of target user
    const targetUser = await User.findById(userToUnfollow);
    if (targetUser && targetUser.followers) {
      targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUser);
      await targetUser.save();
    }

    res.json({
      success: true,
      message: 'User unfollowed successfully'
    });

  } catch (error) {
    console.error('Unfollow Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to unfollow user',
      error: error.message
    });
  }
});

// @route   GET /api/follow/:userId/followers
// @desc    Get user's followers
// @access  Public
router.get('/:userId/followers', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('followers', 'name email userType examCleared rank year')
      .select('followers');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      followers: user.followers || []
    });

  } catch (error) {
    console.error('Get Followers Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get followers',
      error: error.message
    });
  }
});

// @route   GET /api/follow/:userId/following
// @desc    Get users that this user is following
// @access  Public
router.get('/:userId/following', async (req, res) => {
  try {
    const user = await User.findById(req.params.userId)
      .populate('following', 'name email userType examCleared rank year')
      .select('following');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      following: user.following || []
    });

  } catch (error) {
    console.error('Get Following Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get following',
      error: error.message
    });
  }
});

// @route   GET /api/follow/:userId/status/:targetUserId
// @desc    Check if user is following another user
// @access  Private
router.get('/:userId/status/:targetUserId', authenticateToken, async (req, res) => {
  try {
    const user = await User.findById(req.params.userId).select('following');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const isFollowing = user.following && user.following.includes(req.params.targetUserId);

    res.json({
      success: true,
      isFollowing
    });

  } catch (error) {
    console.error('Check Follow Status Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check follow status',
      error: error.message
    });
  }
});

module.exports = router;