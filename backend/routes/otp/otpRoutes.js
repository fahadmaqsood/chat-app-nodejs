const express = require('express');
const router = express.Router();
const otpController = require('../controllers/otpController');

// Route to generate OTP
router.post('/generate_otp', otpController.generateOtp);

// Route to verify OTP
router.post('/verify_forgot_password_otp', otpController.verifyOtp);

module.exports = router;
