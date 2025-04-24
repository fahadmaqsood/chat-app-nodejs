import express from 'express';
import { reportUser } from '../../controllers/reports/userReport.controllers.js';

import { loginAdmin } from '../../controllers/admin/admin.controllers.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.post('/login', loginAdmin);




export default router;
