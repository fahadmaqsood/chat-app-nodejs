import express from 'express';
import { generateOtp, verifyOtp, changeCurrentPassword } from '../../controllers/otp/otpController.js'; // Adjust path accordingly

const router = express.Router();

// Route to generate OTP
router.post('/generate_otp', generateOtp);

// Route to verify OTP
router.post('/verify_forgot_password_otp', verifyOtp);


// Route to change password
router.post("/change_password", changeCurrentPassword);

export default router;
