import mongoose from 'mongoose';


const subscriptionCodesSchema = new mongoose.Schema({
    paypal_subscription_id: {
        type: String,
        unique: false,
        // required: true
    }, // subscription id received from paypal


    subscription_code: {
        type: String,
        unique: true,
        required: true
    }, // Unique subscription code with SB- prefix and 6-character alphanumeric value


    referral_code: {
        type: String,
        unique: false,
        // required: true
    },


    referrals: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'SubscriptionCodes',
            default: []
        },
    ], // Array to store valid ids of other subscription codes

    months: {
        type: Number,
        required: true,
        default: 1
    }, // Number of free subscription months

    price_paid: {
        type: String,
        // required: true // Make it a required field
    }, // Price paid for the subscription

    isUsed: {
        type: Boolean,
        default: false
    }, // Field to track if the subscription is currently active or expired


    full_name: {
        type: String,
        default: ""
    },

    email: {
        type: String,
        default: ""
    },

    subscription_date: {
        type: Date,
        // required: true
    },

    next_billing_date: {
        type: Date,
        // required: true
    },


    redemption_date: {
        type: Date,
        default: null
    }, // Field to store the date of redemption (if redeemed)

    redeemed_by: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    }

}, { timestamps: true });



const subscriptionCodes = mongoose.model('SubscriptionCodes', subscriptionCodesSchema);

export default subscriptionCodes;