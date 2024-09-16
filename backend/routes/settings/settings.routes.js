import express from 'express';
import { changeProfileSettings, updatePrivacySettings, updateNotificationSettings } from '../../controllers/settings/settings.controllers.js';

const router = express.Router();

// Route for settings
router.post('/profile', changeProfileSettings);
router.post('/privacy', updatePrivacySettings);
router.post('/notifications', updateNotificationSettings);


export default router;
