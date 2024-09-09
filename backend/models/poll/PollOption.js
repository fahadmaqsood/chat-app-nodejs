const mongoose = require('mongoose');

const pollOptionSchema = new mongoose.Schema({
    poll_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Poll',
        required: true
    },
    option_text: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('PollOption', pollOptionSchema);
