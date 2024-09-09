const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    payload: {
        type: mongoose.Schema.Types.Mixed, // Additional data associated with the notification, e.g., links
        default: {}
    },
    status: {
        type: String,
        enum: ['pending', 'sent', 'read'],
        default: 'pending'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    sent_at: {
        type: Date
    },
    read_at: {
        type: Date
    }
});

module.exports = mongoose.model('Notification', notificationSchema);
