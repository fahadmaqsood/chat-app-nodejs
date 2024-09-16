import express from 'express';
import { changeProfileSettings, updatePrivacySettings, updateNotificationSettings } from '../../controllers/settings/settings.controllers.js';

const router = express.Router();

// Route for settings
router.post('/profile', changeProfileSettings);
router.get('/privacy', updatePrivacySettings);
router.get('/notifications', updateNotificationSettings);


export default router;
