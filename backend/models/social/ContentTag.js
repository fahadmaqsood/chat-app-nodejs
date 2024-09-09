const mongoose = require('mongoose');

const contentTagSchema = new mongoose.Schema({
    content_type: {
        type: String,
        enum: ['news', 'article', 'post'],
        required: true
    },
    content_url: {
        type: String,
        required: true
    },
    mood: {
        type: String
    }
});

module.exports = mongoose.model('ContentTag', contentTagSchema);
