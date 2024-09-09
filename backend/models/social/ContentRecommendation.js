const mongoose = require('mongoose');

const contentRecommendationSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content_type: {
        type: String,
        enum: ['news', 'article', 'post'],
        required: true
    },
    content_url: {
        type: String,
        required: true
    },
    mood_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserMood'
    },
    recommended_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('ContentRecommendation', contentRecommendationSchema);
