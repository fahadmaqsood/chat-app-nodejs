const mongoose = require('mongoose');

const followerSchema = new mongoose.Schema({
    follower_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    following_user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    followed_at: {
        type: Date,
        default: Date.now
    }
});

// Adding this to prevent duplicate follow records
followerSchema.index({ follower_user_id: 1, following_user_id: 1 }, { unique: true });

module.exports = mongoose.model('Follower', followerSchema);
