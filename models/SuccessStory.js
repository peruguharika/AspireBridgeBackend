const mongoose = require('mongoose');

const SuccessStorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    role: {
        type: String,
        required: true
    },
    company: {
        type: String,
        required: true
    },
    imageUrl: {
        type: String, // URL to image
        default: ''
    },
    story: {
        type: String,
        required: true
    },
    quote: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('SuccessStory', SuccessStorySchema);
