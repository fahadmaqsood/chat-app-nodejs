import express from 'express';
import { getProfileInfo, getProfilePosts } from '../../controllers/profile/profile.controllers.js'; // Adjust path accordingly

const router = express.Router();

// Route to generate OTP
router.post('/info', getProfileInfo);

// Route to verify OTP
router.post('/posts', getProfilePosts);

export default router;
