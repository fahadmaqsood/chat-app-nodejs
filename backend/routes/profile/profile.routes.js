import express from 'express';
import { getProfileInfo, getProfilePosts } from '../../controllers/profile/profile.controllers.js'; // Adjust path accordingly

const router = express.Router();


router.post('/info', getProfileInfo);
router.post('/posts', getProfilePosts);

export default router;
