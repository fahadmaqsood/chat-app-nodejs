import express from 'express';
import { searchUsers, sendCloseFriendRequest, getSentCloseFriendRequests, rejectCloseFriendRequest, acceptCloseFriendRequest } from '../../controllers/home/home.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/search-users', validateTokensMiddleware, searchUsers);


router.post('/send-close-friend-request', validateTokensMiddleware, sendCloseFriendRequest);
router.get('/get-sent-close-friend-requests', validateTokensMiddleware, getSentCloseFriendRequests);
router.post('/accept-close-friend-request', validateTokensMiddleware, acceptCloseFriendRequest);
router.post('/reject-close-friend-request', validateTokensMiddleware, rejectCloseFriendRequest);


export default router;
