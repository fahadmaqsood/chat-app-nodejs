const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
    },
    phone: {
        type: String,
        required: true,
    },
    otp: {
        type: String,
        required: true,
    },
    generation_date: {
        type: Date,
        default: Date.now,
    },
});

const Otp = mongoose.model('Otp', otpSchema);

module.exports = Otp;
