import express from 'express';


import { generateSubscriptionCode, getReferralCodeBySubscription, getReferralCountBySubscription, getReferralsBySubscription } from '../../controllers/subscription_codes/subscriptioncodes.controllers.js';

const router = express.Router();

// Route to generate a new subscription code
router.post('/generate', generateSubscriptionCode);

// Route to retrieve the referral code by subscription code
router.get('/referral/:subscription_code', getReferralCodeBySubscription);



router.get('/referrals/count/:subscription_code', getReferralCountBySubscription);
router.get('/referrals/list/:subscription_code', getReferralsBySubscription);

export default router;
