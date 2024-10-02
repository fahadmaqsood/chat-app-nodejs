import mongoose from 'mongoose';

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
        doer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User' // This references the User model
        },
        additionalData: mongoose.Schema.Types.Mixed, // Additional data associated with the notification, e.g., links
        default: {}
    },
    status: {
        type: String,
        enum: ['sent', 'read'],
        default: 'sent'
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    sent_at: {
        type: Date,
        default: Date.now
    },
    read_at: {
        type: Date
    }
});

export default mongoose.model('Notification', notificationSchema);

