import mongoose from 'mongoose';

const PlayStoreTransactionsSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    purchaseToken: {
        type: String,
        required: true,
        unique: true // Ensure uniqueness for each transaction
    },
    payment_status: {
        type: String,
        enum: ['pending', 'done', 'failure'],
        required: true,
        default: 'pending' // Optional: Default status on transaction creation
    },
}, {
    timestamps: true
});

export default mongoose.model('PlayStoreTransactions', PlayStoreTransactionsSchema);