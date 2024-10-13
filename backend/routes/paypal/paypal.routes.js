import express from 'express';
import { logSubscription } from '../../controllers/paypal/paypal.controllers.js'; // Adjust path accordingly


const router = express.Router();


router.post('/log-subscription', logSubscription);


export default router;
