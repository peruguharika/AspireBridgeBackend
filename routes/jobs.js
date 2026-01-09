const express = require('express');
const router = express.Router();
const Job = require('../models/Job');
const { authenticateToken } = require('../middleware/auth');

// @route   GET /api/jobs
// @desc    Get all jobs
// @access  Private (or Public)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const jobs = await Job.find().sort({ postedAt: -1 });
        res.json({
            success: true,
            count: jobs.length,
            jobs
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, message: 'Server Error' });
    }
});

// @route   POST /api/jobs
// @desc    Add a job
// @access  Private (Admin)
router.post('/', authenticateToken, async (req, res) => {
    try {
        // Ideally check if user is admin
        const newJob = new Job(req.body);
        const job = await newJob.save();
        res.json(job);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router;
