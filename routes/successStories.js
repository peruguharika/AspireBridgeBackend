const express = require('express');
const router = express.Router();
const SuccessStory = require('../models/SuccessStory');
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/successstories
// @desc    Get all success stories
// @access  Private (or Public)
router.get('/', authenticateToken, async (req, res) => {
    try {
        console.log('📖 [GET] Fetching all success stories...');
        const stories = await SuccessStory.find().sort({ createdAt: -1 });
        console.log(`✅ [GET] Found ${stories.length} stories.`);
        res.json(stories);
    } catch (err) {
        console.error('❌ [GET] Error:', err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/successstories
// @desc    Add a success story
// @access  Private (Authenticated Users)
router.post('/', authenticateToken, async (req, res) => {
    try {
        console.log('📝 [POST] Adding new success story:', req.body.name);
        const newStory = new SuccessStory(req.body);
        const story = await newStory.save();
        console.log('✅ [POST] Story saved with ID:', story._id);
        res.json(story);
    } catch (err) {
        console.error('❌ [POST] Error:', err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
