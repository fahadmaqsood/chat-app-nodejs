import express from 'express';
import { generateLink } from '../../controllers/share/shareController.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

router.use(validateTokensMiddleware)

router.post('/generate-link', generateLink);

//router.get('/get/notifications', getNotifications);

export default router;
