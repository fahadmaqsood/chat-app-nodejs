const mongoose = require('mongoose');

const creditCardSchema = new mongoose.Schema({
    card_id: {
        type: mongoose.Schema.Types.ObjectId,
        auto: true,
    },
    number: {
        type: String,
        required: true
    },
    name: {
        type: String,
        required: true
    },
    expiry: {
        type: String,
        required: true // Format: MM/YY or MM/YYYY
    },
    cvv: {
        type: String,
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    added_at: {
        type: Date,
        default: Date.now
    },
    last_transaction_date: {
        type: Date
    }
});

// Skipping encryption logic for now
// creditCardSchema.pre('save', function(next) {
//     // Example: encryption logic here
//     // this.number = encrypt(this.number);
//     // this.cvv = encrypt(this.cvv);
//     next();
// });

module.exports = mongoose.model('CreditCard', creditCardSchema);
