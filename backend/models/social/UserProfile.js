const mongoose = require('mongoose');

const userProfileSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    avatar_url: {
        type: String
    },
    bio: {
        type: String
    },
    theme_preferences: {
        type: String
    },
    mood_status: {
        type: String
    },
    privacy_settings: {
        type: String
    }
});

module.exports = mongoose.model('UserProfile', userProfileSchema);
