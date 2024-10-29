import express from 'express';
import { playstoreSubscriptionWebhook, addCoinPurchase } from '../../controllers/playstore/playstore.controllers.js'; // Adjust path accordingly


const router = express.Router();


router.post('/webhook', playstoreSubscriptionWebhook);


router.post('/add-coin-purchase', addCoinPurchase);

export default router;
