import express from 'express';

import { scheduleSession, getSessionsByDate, getSessionDetails, editSession, deleteSession } from '../../controllers/user-sessions/userSessions.controllers.js';

import { sendMessage } from '../../controllers/chat-app/message.controllers.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

// Route to generate a new subscription code
router.post('/schedule', validateTokensMiddleware, scheduleSession);


// route to redeem a subscription code
router.get('/get-sessions-by-date', validateTokensMiddleware, getSessionsByDate);

// Route to retrieve the referral code by subscription code
router.get('/details/:sessionId', getSessionDetails);


router.post('/edit/:sessionId', validateTokensMiddleware, editSession);

router.delete('/delete/:sessionId', validateTokensMiddleware, deleteSession);


export default router;
