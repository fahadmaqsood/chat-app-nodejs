const mongoose = require('mongoose');

const coinPurchasesSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    purchaseToken: {
        type: String,
        required: true
    },
    payment_status: {
        type: String,
        enum: ['pending', 'done', 'failure'],
        required: true
    },
}, {
    timestamps: true
});

module.exports = mongoose.model('CoinPurchases', coinPurchasesSchema);
