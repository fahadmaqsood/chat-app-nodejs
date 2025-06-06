import express from 'express';
import { appStoreSubscriptionWebhook, verifyAppStoreReceipt, addCoinPurchase } from '../../controllers/playstore/playstore.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();


router.post('/webhook_sandbox', appStoreSubscriptionWebhook);

router.post('/verify-appstore-receipt', validateTokensMiddleware, verifyAppStoreReceipt);


router.post('/add-coin-purchase', validateTokensMiddleware, addCoinPurchase);

export default router;
