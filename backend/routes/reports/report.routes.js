import express from 'express';
import { reportUser, getReportsByUser, updateReportStatus } from '../../controllers/reports/userReport.controllers.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.post('/report-user', validateTokensMiddleware, reportUser);


// route to redeem a subscription code
router.get('/get-reports-by-user', validateTokensMiddleware, getReportsByUser);



export default router;
