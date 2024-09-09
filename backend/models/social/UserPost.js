const mongoose = require('mongoose');

const userPostSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: true
    },
    media_url: {
        type: String
    },
    mood_status: {
        type: String
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date
    }
});

module.exports = mongoose.model('UserPost', userPostSchema);
