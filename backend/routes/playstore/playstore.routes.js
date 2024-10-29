import express from 'express';
import { playstoreSubscriptionWebhook } from '../../controllers/playstore/playstore.controllers.js'; // Adjust path accordingly


const router = express.Router();


router.post('/webhook', playstoreSubscriptionWebhook);

export default router;
