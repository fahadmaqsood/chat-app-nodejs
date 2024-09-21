import express from 'express';
import { searchUsers } from '../../controllers/home/home.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/search-users', validateTokensMiddleware, searchUsers);


export default router;
