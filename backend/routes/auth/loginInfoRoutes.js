import express from 'express';
import { getAllLoginInfo, getLoginInfoByUserId } from '../../controllers/auth/loginInfoController.js';

const router = express.Router();

router.get('/', getAllLoginInfo);

router.get('/:userId', getLoginInfoByUserId);

export default router;
