const mongoose = require('mongoose');

const pollSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    poll_question: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    expires_at: {
        type: Date
    }
});

module.exports = mongoose.model('Poll', pollSchema);
