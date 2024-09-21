import express from 'express';
import { getProfileInfo, getSelectiveProfileInfo, getProfilePosts } from '../../controllers/profile/profile.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/info', validateTokensMiddleware, getProfileInfo);
router.post('/selective-info', validateTokensMiddleware, getSelectiveProfileInfo);
router.post('/posts', validateTokensMiddleware, getProfilePosts);

export default router;
