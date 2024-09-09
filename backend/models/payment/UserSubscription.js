const mongoose = require('mongoose');

const userSubscriptionSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    subscription_type: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: true
    },
    payment_status: {
        type: String
    },
    trial_start_date: {
        type: Date
    },
    trial_end_date: {
        type: Date
    },
    next_billing_date: {
        type: Date
    },
    cancelled_at: {
        type: Date
    }
});

module.exports = mongoose.model('UserSubscription', userSubscriptionSchema);
