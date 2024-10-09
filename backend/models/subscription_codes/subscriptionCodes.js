import mongoose from 'mongoose';


const subscriptionCodesSchema = new mongoose.Schema({
    subscription_code: {
        type: String,
        unique: true,
        required: true
    }, // Unique subscription code with SB- prefix and 6-character alphanumeric value


    referral_code: {
        type: String,
        unique: true,
        required: true
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
        type: Number,  // Mongoose uses 'Number' type to represent floating-point values
        required: true // Make it a required field
    }, // Price paid for the subscription

    isUsed: {
        type: Boolean,
        default: false
    }, // Field to track if the subscription is currently active or expired


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