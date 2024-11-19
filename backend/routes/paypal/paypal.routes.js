import express from 'express';
import { logSubscription, liveSubscriptionWebhook, sandboxSubscriptionWebhook } from '../../controllers/paypal/paypal.controllers.js'; // Adjust path accordingly


const router = express.Router();


router.post('/log-subscription', logSubscription);

router.post('/sandbox-subscriptions-webhook', sandboxSubscriptionWebhook);
router.post('/live-subscriptions-webhook', liveSubscriptionWebhook);

export default router;
