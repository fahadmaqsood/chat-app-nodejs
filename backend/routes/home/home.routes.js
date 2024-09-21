import express from 'express';
import { searchUsers, sendCloseFriendRequest, getCloseFriendRequests, getSentCloseFriendRequests, rejectCloseFriendRequest, acceptCloseFriendRequest } from '../../controllers/home/home.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/search-users', validateTokensMiddleware, searchUsers);


router.post('/send-close-friend-request', validateTokensMiddleware, sendCloseFriendRequest);
router.get('/get-sent-close-friend-requests', validateTokensMiddleware, getSentCloseFriendRequests);
router.get('/get-close-friend-requests', validateTokensMiddleware, getCloseFriendRequests);
router.post('/accept-close-friend-request', validateTokensMiddleware, acceptCloseFriendRequest);
router.post('/reject-close-friend-request', validateTokensMiddleware, rejectCloseFriendRequest);


export default router;
