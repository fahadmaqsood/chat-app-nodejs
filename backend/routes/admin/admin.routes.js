import express from 'express';
import { reportUser } from '../../controllers/reports/userReport.controllers.js';

import { loginAdmin, addAdmin, removeAdmin, changeRole, resetPassword } from '../../controllers/admin/admin.controllers.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.post('/login', loginAdmin);


router.post('/add-admin', addAdmin);

router.post('/remove-admin', removeAdmin);

router.post('/change-role', changeRole);

router.post('/reset-password', resetPassword);






export default router;
