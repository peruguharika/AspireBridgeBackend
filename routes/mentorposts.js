const express = require('express');
const router = express.Router();
const MentorPost = require('../models/MentorPost');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/mentorposts
// @desc    Create mentor post
// @access  Private (Achievers only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { mentorName, content, mediaUrl, mediaType } = req.body;

    console.log('📝 [POST] Creating mentor post by:', req.user.id);

    const post = new MentorPost({
      mentorId: req.user.id,
      mentorName,
      content,
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || 'none'
    });

    await post.save();
    console.log('✅ [POST] Mentor post saved:', post._id);

    res.status(201).json({
      success: true,
      message: 'Post created successfully',
      post
    });

  } catch (error) {
    console.error('Create Post Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create post',
      error: error.message
    });
  }
});

// @route   GET /api/mentorposts
// @desc    Get all mentor posts
// @access  Public
router.get('/', async (req, res) => {
  try {
    console.log('📖 [GET] Fetching mentor posts...');
    const { mentorId } = req.query;

    let query = {};
    if (mentorId) query.mentorId = mentorId;

    const posts = await MentorPost.find(query)
      .populate('mentorId', 'name email examType')
      .sort({ createdAt: -1 });

    console.log(`✅ [GET] Found ${posts.length} mentor posts.`);
    // Return array directly to match Android ApiService expectation
    res.json(posts);

  } catch (error) {
    console.error('Get Posts Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch posts',
      error: error.message
    });
  }
});

// @route   POST /api/mentorposts/:id/like
// @desc    Like/Unlike post
// @access  Private
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const post = await MentorPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user.id;
    const likedIndex = post.likedBy.indexOf(userId);

    if (likedIndex > -1) {
      post.likedBy.splice(likedIndex, 1);
      post.likes = Math.max(0, post.likes - 1);
    } else {
      post.likedBy.push(userId);
      post.likes += 1;
    }

    await post.save();

    res.json({
      success: true,
      likes: post.likes,
      isLiked: likedIndex === -1
    });

  } catch (error) {
    console.error('Like Post Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like post',
      error: error.message
    });
  }
});

// @route   DELETE /api/mentorposts/:id
// @desc    Delete post
// @access  Private (Owner or Admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await MentorPost.findById(req.params.id);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    if (post.mentorId.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    await MentorPost.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Post deleted successfully'
    });

  } catch (error) {
    console.error('Delete Post Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post',
      error: error.message
    });
  }
});

module.exports = router;