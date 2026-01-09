const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure uploads directory exists
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// Storage Strategy
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        // Unique filename: fieldname-timestamp.ext
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// File Filter (Images/PDF)
const fileFilter = (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf') {
        cb(null, true);
    } else {
        cb(new Error('Only images and PDF files are allowed!'), false);
    }
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// @route   POST /api/upload
// @desc    Upload a file
// @access  Public (or Private)
router.post('/', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send({ message: 'Please upload a file' });
        }

        // Return the URL
        // Assumes server serves 'uploads' folder at root
        // const fileUrl = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
        // For Android emulator (10.0.2.2) or device, absolute URL is best.
        // But relative path is safer for DB storage if base URL changes.
        // Let's store relative path or full URL. Users prefer Full URL for simplicity in frontend.

        let baseUrl = `${req.protocol}://${req.get('host')}`;

        // If connecting from emulator to localhost, host might be localhost:5000
        // Use relative path '/uploads/...' and let frontend append baseurl? 
        // No, let's return full URL.

        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`;

        res.status(200).json({
            success: true,
            message: 'File uploaded successfully',
            fileUrl: fileUrl,
            filePath: req.file.path
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).send({ message: 'Could not upload the file', error: error.message });
    }
});

module.exports = router;
