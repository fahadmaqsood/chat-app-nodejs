import express from 'express';
import { updateUserMood } from '../../controllers/social/userController.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

router.post('/update/user-mood', validateTokensMiddleware, updateUserMood);

export default router;
