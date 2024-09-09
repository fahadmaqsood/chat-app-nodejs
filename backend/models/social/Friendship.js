const mongoose = require('mongoose');

const friendshipSchema = new mongoose.Schema({
    user_id_1: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    user_id_2: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'accepted', 'blocked'],
        required: true
    },
    friendship_created_date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Friendship', friendshipSchema);
