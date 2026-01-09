const express = require('express');
const router = express.Router();
const Resource = require('../models/Resource');
const { authenticateToken } = require('../middleware/auth');

// @route   POST /api/resources
// @desc    Create new resource
// @access  Private (Achievers only)
router.post('/', authenticateToken, async (req, res) => {
  try {
    const {
      title,
      description,
      category,
      examType,
      uploaderName,
      fileUrl,
      fileType,
      fileSize
    } = req.body;

    const resource = new Resource({
      title,
      description,
      category,
      uploadedBy: req.user.id,
      uploaderName,
      examType,
      fileUrl: fileUrl || '#',
      fileType: fileType || 'PDF',
      fileSize: fileSize || 0
    });

    await resource.save();

    res.status(201).json({
      success: true,
      message: 'Resource uploaded successfully',
      resource
    });

  } catch (error) {
    console.error('Create Resource Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload resource',
      error: error.message
    });
  }
});

// @route   GET /api/resources
// @desc    Get all resources
// @access  Public
router.get('/', async (req, res) => {
  try {
    const { category, examType, search } = req.query;
    
    let query = { isApproved: true };
    
    if (category && category !== 'All') {
      query.category = category;
    }
    
    if (examType) {
      query.examType = { $regex: examType, $options: 'i' };
    }
    
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { examType: { $regex: search, $options: 'i' } }
      ];
    }

    const resources = await Resource.find(query)
      .populate('uploadedBy', 'name email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      count: resources.length,
      resources
    });

  } catch (error) {
    console.error('Get Resources Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resources',
      error: error.message
    });
  }
});

// @route   GET /api/resources/:id
// @desc    Get single resource
// @access  Public
router.get('/:id', async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id)
      .populate('uploadedBy', 'name email');

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    res.json({
      success: true,
      resource
    });

  } catch (error) {
    console.error('Get Resource Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch resource',
      error: error.message
    });
  }
});

// @route   POST /api/resources/:id/like
// @desc    Like/Unlike resource
// @access  Private
router.post('/:id/like', authenticateToken, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    const userId = req.user.id;
    const likedIndex = resource.likedBy.indexOf(userId);

    if (likedIndex > -1) {
      // Unlike
      resource.likedBy.splice(likedIndex, 1);
      resource.likes = Math.max(0, resource.likes - 1);
    } else {
      // Like
      resource.likedBy.push(userId);
      resource.likes += 1;
    }

    await resource.save();

    res.json({
      success: true,
      message: likedIndex > -1 ? 'Resource unliked' : 'Resource liked',
      likes: resource.likes,
      isLiked: likedIndex === -1
    });

  } catch (error) {
    console.error('Like Resource Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like resource',
      error: error.message
    });
  }
});

// @route   POST /api/resources/:id/download
// @desc    Track resource download
// @access  Private
router.post('/:id/download', authenticateToken, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    const userId = req.user.id;
    
    if (!resource.downloadedBy.includes(userId)) {
      resource.downloadedBy.push(userId);
    }
    
    resource.downloads += 1;
    await resource.save();

    res.json({
      success: true,
      message: 'Download tracked',
      downloads: resource.downloads
    });

  } catch (error) {
    console.error('Track Download Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track download',
      error: error.message
    });
  }
});

// @route   DELETE /api/resources/:id
// @desc    Delete resource
// @access  Private (Owner or Admin)
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const resource = await Resource.findById(req.params.id);

    if (!resource) {
      return res.status(404).json({
        success: false,
        message: 'Resource not found'
      });
    }

    // Check if user is owner or admin
    if (resource.uploadedBy.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this resource'
      });
    }

    await Resource.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Resource deleted successfully'
    });

  } catch (error) {
    console.error('Delete Resource Error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete resource',
      error: error.message
    });
  }
});

module.exports = router;