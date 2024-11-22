import express from 'express';
import { getEntries, getSpecificEntry, addEntry, editEntry } from '../../controllers/personal-diary/personalDiary.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.get('/get-entries', validateTokensMiddleware, getEntries);

router.get('/get-specific-entry', validateTokensMiddleware, getSpecificEntry);

router.post('/add-entry', validateTokensMiddleware, addEntry);

router.post('/edit-entry', validateTokensMiddleware, editEntry);

export default router;
