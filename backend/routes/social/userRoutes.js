import express from 'express';
import { updateUserMood } from '../../controllers/social/userController.js';

const router = express.Router();

router.post('/update/user-mood', updateUserMood);

export default router;
