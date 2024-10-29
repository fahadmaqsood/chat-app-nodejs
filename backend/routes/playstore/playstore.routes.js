import express from 'express';
import { playstoreSubscriptionWebhook, addCoinPurchase } from '../../controllers/playstore/playstore.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/webhook', playstoreSubscriptionWebhook);


router.post('/add-coin-purchase', validateTokensMiddleware, addCoinPurchase);

export default router;
