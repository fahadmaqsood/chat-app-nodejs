import express from 'express';


import { generateSubscriptionCode, redeemSubscriptionCode, getReferralCodeBySubscription, getReferralCountBySubscription, getReferralsBySubscription } from '../../controllers/subscription_codes/subscriptioncodes.controllers.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

// Route to generate a new subscription code
router.post('/generate', generateSubscriptionCode);


// route to redeem a subscription code
router.post('/redeem', validateTokensMiddleware, redeemSubscriptionCode);

// Route to retrieve the referral code by subscription code
router.get('/referral/:subscription_code', getReferralCodeBySubscription);



router.get('/referrals/count/:subscription_code', getReferralCountBySubscription);
router.get('/referrals/list/:subscription_code', getReferralsBySubscription);

export default router;
