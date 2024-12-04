import express from 'express';
import { sendCallSocketNotification, createNotification, getNotifications, sendCallNotification } from '../../controllers/notification/notificationController.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

router.use(validateTokensMiddleware)

router.post('/create', createNotification);

router.get('/get/notifications', getNotifications);

router.post('/send-call-notification', sendCallNotification);

router.post('/send-call-socket-notification', sendCallSocketNotification);

export default router;
