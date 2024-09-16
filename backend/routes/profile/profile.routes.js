import express from 'express';
import { getProfileInfo, getProfilePosts } from '../../controllers/profile/profile.controllers.js'; // Adjust path accordingly

const router = express.Router();

// Route to generate OTP
router.post('/info', generateOtp);

// Route to verify OTP
router.post('/posts', verifyOtp);

export default router;
