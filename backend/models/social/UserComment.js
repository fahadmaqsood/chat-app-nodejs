const mongoose = require('mongoose');

const userCommentSchema = new mongoose.Schema({
    post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserPost',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parent_comment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserComment',
        default: null 
    },
    comment_text: {
        type: String,
        required: true
    },
    comment_content: {
        type: String, 
        default: null 
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: null 
    }
});

// Export the UserComment model
module.exports = mongoose.model('UserComment', userCommentSchema);
