const mongoose = require('mongoose');

const pollVoteSchema = new mongoose.Schema({
    poll_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    option_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PollOption',
        required: true
    },
    voted_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PollVote', pollVoteSchema);
