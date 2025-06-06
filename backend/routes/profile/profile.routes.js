import express from 'express';
import { getProfileInfo, getSelectiveProfileInfo, getProfilePosts, getProfileBlogPosts, followUser, unfollowUser, blockUser, unblockUser, getFriends } from '../../controllers/profile/profile.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/info', validateTokensMiddleware, getProfileInfo);
router.post('/selective-info', validateTokensMiddleware, getSelectiveProfileInfo);
router.post('/posts', validateTokensMiddleware, getProfilePosts);
router.post('/blog-posts', validateTokensMiddleware, getProfileBlogPosts);
router.post('/follow-user', validateTokensMiddleware, followUser);
router.post('/unfollow-user', validateTokensMiddleware, unfollowUser);

router.post('/block-user', validateTokensMiddleware, blockUser);
router.post('/unblock-user', validateTokensMiddleware, unblockUser);

router.post('/get-friends', validateTokensMiddleware, getFriends);


export default router;
