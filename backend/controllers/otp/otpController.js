const Otp = require('../models/Otp');

// Controller for generating OTP
exports.generateOtp = async (req, res) => {
    const { email, phone } = req.body;

    try {
        // you can use your custom logic to generate OTP
        const otp = '1234';

        // Create a new OTP record
        const newOtp = new Otp({
            email,
            phone,
            otp
        });
        await newOtp.save();

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Controller for verifying OTP
exports.verifyOtp = async (req, res) => {
    const { email, phone, otp } = req.body;

    try {
        // Find the OTP record
        const otpRecord = await Otp.findOne({ email, phone, otp });

        if (otpRecord) {
            // OTP is valid
            res.status(200).json({ valid: true });
        } else {
            // OTP is invalid
            res.status(400).json({ valid: false });
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};
