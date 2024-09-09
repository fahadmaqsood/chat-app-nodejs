import express from 'express';
import { createNotification, getNotifications } from '../../controllers/notification/notificationController.js';

const router = express.Router();

router.post('/create', createNotification);

router.get('/get/notifications', getNotifications);

export default router;
