import { ApiResponse } from '../../utils/ApiResponse.js';

import SubscriptionCodes from '../../models/subscription_codes/subscriptionCodes.js';


const generateUniqueCode = async (prefix) => {
    let code;
    let isUnique = false;
    while (!isUnique) {
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase(); // Generate random 6-character alphanumeric part
        code = `${prefix}-${randomPart}`;
        isUnique = !(await SubscriptionCodes.exists({ subscription_code: code }) || await SubscriptionCodes.exists({ referral_code: code }));
    }
    return code;
};


// Generate Subscription Code
export const generateSubscriptionCode = async (req, res) => {
    try {
        const { months, referral_code } = req.body;

        // Validate months
        if (!months) {
            return res.status(400).json(new ApiResponse(400, {}, "Missing 'months' parameter"));
        }

        const parsedMonths = parseInt(months, 10);
        if (isNaN(parsedMonths) || parsedMonths <= 0) {
            return res.status(400).json(new ApiResponse(400, {}, "Invalid or missing 'months' parameter"));
        }


        const user_subscription_code = await generateUniqueCode('SB'); // Generate unique subscription code
        const user_referral_code = await generateUniqueCode('RF'); // Generate unique referral code


        // Create new subscription code
        const newSubscription = new SubscriptionCodes({
            months: parsedMonths,
            referrals: [],

            subscription_code: user_subscription_code,
            referral_code: user_referral_code
        });


        // Check if a referral code is provided
        if (referral_code) {
            // Find the existing subscription by referral code
            const validReferral = await SubscriptionCodes.findOne({ referral_code });
            if (!validReferral) {
                return res.status(400).json(new ApiResponse(400, {}, 'Invalid referral code'));
            }

            // Push the new subscription ID into the referrals array of the valid referral code
            validReferral.referrals.push(newSubscription._id); // Push the new subscription's ID to the existing referral code
            await validReferral.save(); // Save the updated referral document
        }

        // Save to database
        await newSubscription.save();

        // Output the generated subscription and referral code
        res.status(201).json(new ApiResponse(201, {
            subscription_code: newSubscription.subscription_code,
            referral_code: newSubscription.referral_code
        }, "Subscription code generated successfully."));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server error while generating subscription code'));
    }
};

// Retrieve Referral Code by Subscription Code
export const getReferralCodeBySubscription = async (req, res) => {
    try {
        const { subscription_code } = req.params;

        // Find the subscription by code
        const subscription = await SubscriptionCodes.findOne({ subscription_code });

        if (!subscription) {
            return res.status(404).json(new ApiResponse(404, {}, 'Subscription code not found'));
        }

        // Return the referral code
        res.status(200).json(new ApiResponse(200, {
            referral_code: subscription.referral_code
        }, "Referral code retrieved successfully."));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server error while retrieving referral code'));
    }
};




// Get Referral Count by Subscription Code
export const getReferralCountBySubscription = async (req, res) => {
    try {
        const { subscription_code } = req.params;

        // Find the subscription by code
        const subscription = await SubscriptionCodes.findOne({ subscription_code });

        if (!subscription) {
            return res.status(404).json(new ApiResponse(404, {}, 'Subscription code not found'));
        }

        // Return the count of referrals
        const referralCount = subscription.referrals.length;
        res.status(200).json(new ApiResponse(200, {
            referral_count: referralCount
        }, "Referral count retrieved successfully."));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server error while retrieving referral count'));
    }
};


// Get List of Referrals by Subscription Code
export const getReferralsBySubscription = async (req, res) => {
    try {
        const { subscription_code } = req.params;

        // Find the subscription by code
        const subscription = await SubscriptionCodes.findOne({ subscription_code });

        if (!subscription) {
            return res.status(404).json(new ApiResponse(404, {}, 'Subscription code not found'));
        }

        // Retrieve the referred subscription codes
        const referredSubscriptions = await SubscriptionCodes.find({ _id: { $in: subscription.referrals } }, { subscription_code: 1 });

        // Return the list of referred subscription codes
        res.status(200).json(new ApiResponse(200, {
            referred_subscriptions: referredSubscriptions
        }, "List of referred subscription codes retrieved successfully."));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server error while retrieving referred subscriptions'));
    }
};
