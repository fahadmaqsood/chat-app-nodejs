import { PubSub } from '@google-cloud/pubsub';

import PlayStoreTransactions from '../../models/payment/PlayStoreTransactions.js';

import { User } from '../../models/auth/user.models.js'

import { isAppOpenForUser, emitIndicatorsSocketEvent } from "../../socket/indicators.js";

import { addNotification } from "../../controllers/notification/notificationController.js";

import { ApiResponse } from '../../utils/ApiResponse.js';

import mongoose from 'mongoose';

const pubsub = new PubSub();

// Your Google Cloud Pub/Sub subscription
const subscriptionName = 'play-store-webhook';

const subscriptionIdToMonths = {
    "tgc_monthly_subscription": 1,
    "tgc_annual_subscription": 12,
};

export const playstoreSubscriptionWebhook = async (req, res) => {
    try {
        // Pub/Sub messages are base64 encoded, so we decode them here
        const messageData = Buffer.from(req.body.message.data, 'base64').toString();
        const messageJson = JSON.parse(messageData);

        console.log(messageJson);

        if (Object.keys(messageJson).includes("oneTimeProductNotification")) {

            const sku = messageJson.oneTimeProductNotification.sku;
            const purchaseToken = messageJson.oneTimeProductNotification.purchaseToken;

            const purchaseUserId = await getUserIdFromPurchaseToken(purchaseToken.trim());

            if (!purchaseUserId) {
                console.log("Purchase for token: " + purchaseToken + " has not been recorded yet.");

                await markPurchaseFailure(purchaseToken);

                return res
                    .status(404)
                    .json(new ApiResponse(404, null, "Record for that purchase token not found."));
            }

            // console.log("purchaseUserId: ", purchaseUserId);

            const currentUser = await User.findById(purchaseUserId);

            if (!currentUser) {
                await markPurchaseFailure(purchaseToken);

                return res
                    .status(404)
                    .json(new ApiResponse(404, null, "User not found."));
            }

            if (sku.startsWith("tgc_shop_") && sku.endsWith("_coins")) {
                let coins;
                try {
                    let parseValue = sku.replace("tgc_shop_", "").replace("_coins", "").trim();
                    // console.log(`parse value: '${parseValue}'`);
                    coins = parseInt(parseValue);
                } catch (error) {
                    console.log(error);

                    await markPurchaseFailure(purchaseToken);

                    return res.status(500).send('Error');
                }

                console.log(`coins: '${coins}', type: ${typeof (coins)}`);
                console.log(`currentUser.user_points: ${currentUser.user_points}, ${typeof (currentUser.user_points)}`);

                let coinsAfterUpdate = currentUser.user_points + coins;

                console.log(`coinsAfterUpdate: '${coinsAfterUpdate}', type: ${typeof (coinsAfterUpdate)}`);

                let updatedUser = await User.findByIdAndUpdate(
                    currentUser._id,
                    { user_points: coinsAfterUpdate },
                    { new: true }
                ).select(
                    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
                );

                await markPurchaseSuccess(purchaseToken);

                emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                emitIndicatorsSocketEvent(currentUser._id, "COIN_PURCHASE_SUCCESS");

                try {
                    await addNotification(currentUser._id, "👛 Coin Purchase Successful!", `${coins} coins added to your account.`);
                } catch (error) {
                    console.log("couldn't send notification to the user");
                }

                return res.status(200).send('OK');
            }


            return res.status(501).send(`${sku} not supported on our server yet.`);
        } else if (Object.keys(messageJson).includes("subscriptionNotification")) {

            const notification = messageJson.subscriptionNotification;

            const purchaseToken = notification.purchaseToken;
            const subscriptionId = notification.subscriptionId;

            const months = subscriptionIdToMonths[subscriptionId];

            const purchaseUserId = await getUserIdFromPurchaseToken(purchaseToken.trim());

            if (!purchaseUserId) {
                console.log("Purchase for token: " + purchaseToken + " has not been recorded yet.");

                return res
                    .status(404)
                    .json(new ApiResponse(404, null, "Record for that purchase token not found."));
            }


            const currentUser = await User.findById(purchaseUserId);

            if (!currentUser) {
                await markPurchaseFailure(purchaseToken);

                return res
                    .status(404)
                    .json(new ApiResponse(404, null, "User not found."));
            }


            // await markPurchaseFailure(purchaseToken);

            // Handle different notification types
            switch (notification.notificationType) {
                case 1: // SUBSCRIPTION_RECOVERED
                    console.log('Subscription recovered:', notification);

                    currentUser.subscription_status = "active";

                    break;
                case 3: // SUBSCRIPTION_CANCELED
                case 10: // SUBSCRIPTION_PAUSED
                case 13: // SUBSCRIPTION_EXPIRED
                    console.log('Subscription expired/canceled/paused:', notification);

                    currentUser.subscription_status = "inactive";

                    sendNotification(currentUser, "Your subscription was expired", "You won't be able to access your account from now on.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                    break;
                case 2: // SUBSCRIPTION_RENEWED
                case 4: // SUBSCRIPTION_PURCHASED
                case 7: // SUBSCRIPTION_RESTARTED
                    console.log('Subscription purchased/renewed/restarted:', notification);

                    currentUser.subscription_status = "active";
                    currentUser.last_renew_date = new Date();
                    currentUser.subscription_type = months == 1 ? 'monthly' : 'yearly';
                    currentUser.next_billing_date = calculateNextBillingDate(months);


                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                    emitIndicatorsSocketEvent(currentUser._id, "SUBSCRIPTION_START_SUCCESS");

                    break;
                case 5: // SUBSCRIPTION_ON_HOLD
                case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
                    console.log('Subscription in grace period/on hold:', notification);

                    currentUser.subscription_status = "hold";

                    sendNotification(currentUser, "Your subscription is on hold", "Try to pay fees before your account gets blocked.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                    break;
                case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
                    console.log('Subscription price change confirmed:', notification);
                    break;
                case 9: // SUBSCRIPTION_DEFERRED
                    console.log('Subscription deferred:', notification);
                    break;
                case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
                    console.log('Subscription pause schedule changed:', notification);
                    break;
                case 12: // SUBSCRIPTION_REVOKED
                    console.log('Subscription revoked:', notification);

                    currentUser.subscription_status = "inactive";

                    sendNotification(currentUser, "Your subscription was revoked", "Your payment provider revoked your subscription.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");


                    break;
                case 20: // SUBSCRIPTION_PENDING_PURCHASE_CANCELED
                    console.log('Pending purchase canceled:', notification);

                    await markPurchaseCanceled(purchaseToken);

                    break;
                default:
                    console.log('Unknown notification type:', notification.notificationType);
            }


            await currentUser.save();


            return res.status(200).send('Done.');
        }


        // await markPurchaseFailure(purchaseToken);

        // Respond to Google that the message was received
        res.status(501).send("Don't know what kind of purchase that is.");
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).send('Error');
    }
}

function calculateNextBillingDate(months) {
    let next_billing_date;
    if (months == 12) {
        // Yearly subscription: add 1 year
        next_billing_date = new Date();
        next_billing_date.setFullYear(next_billing_date.getFullYear() + 1);
    } else {
        // Monthly subscription: add 1 month
        next_billing_date = new Date();
        next_billing_date.setMonth(next_billing_date.getMonth() + 1);
    }

    return next_billing_date;
}


async function sendNotification(currentUser, title, message) {
    try {
        await addNotification(currentUser._id, title, message);
    } catch (error) {
        console.log("couldn't send notification to the user");
    }
}

export const getUserIdFromPurchaseToken = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    // console.log(`purchase: ${purchase}`)

    if (purchase)
        return purchase.user_id;
    else
        return null;
}


export const markPurchaseFailure = async (purchaseToken) => {
    try {
        const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

        purchase.payment_status = "failure";

        await purchase.save();
    } catch (error) {

    }
}

export const markPurchaseSuccess = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    purchase.payment_status = "success";

    await purchase?.save();
}

export const markPurchaseCanceled = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    purchase.payment_status = "canceled";

    await purchase?.save();
}


export const addCoinPurchase = async (req, res) => {
    try {
        const userId = req.user._id;
        const purchaseToken = req.body.purchaseToken;


        const newPurchase = new PlayStoreTransactions({
            user_id: userId,
            purchaseToken,
            payment_status: "pending"
        });

        await newPurchase.save();

        res.status(201).json(new ApiResponse(201, {}, "Pending purchase added successfully."));
    }
    catch (error) {
        console.log(error);
        res.status(500).json(new ApiResponse(500, {}, "An error occurred while adding this purchase"));
    }
};


// export const updateCoinPurchase = async (req, res) => {
//     const userId = req.user._id;
//     const purchaseToken = req.body.purchaseToken;
//     const payment_status = req.body.payment_status;


//     const newNotification = new PlayStoreTransactions({
//         userId,
//         purchaseToken,
//         payment_status
//     });
// };