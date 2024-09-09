const mongoose = require('mongoose');

const notificationPreferenceSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        unique: true // if user each user have one pref
    },
    receive_push_notifications: {
        type: Boolean,
        default: true
    },
    receive_email_notifications: {
        type: Boolean,
        default: true
    },
    receive_in_app_notifications: {
        type: Boolean,
        default: true
    },
    receive_sms_notifications: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('NotificationPreference', notificationPreferenceSchema);
