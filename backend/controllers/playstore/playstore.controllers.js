import { PubSub } from '@google-cloud/pubsub';

import PlayStoreTransactions from '../../models/payment/PlayStoreTransactions.js';

import { User } from '../../models/auth/user.models.js';

import { _increaseUserPoints } from '../../controllers/auth/user.controllers.js';

import { isAppOpenForUser, emitIndicatorsSocketEvent } from "../../socket/indicators.js";

import { addNotification } from "../../controllers/notification/notificationController.js";

import { ApiResponse } from '../../utils/ApiResponse.js';

import mongoose from 'mongoose';

import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';

async function loadAppleVerify() {
    const appleReceiptVerify = await import('node-apple-receipt-verify');
    const { EmptyError, ServiceUnavailableError } = appleReceiptVerify;

    // Use them here
}
await loadAppleVerify();


// const { EmptyError, ServiceUnavailableError } = appleReceiptVerify;

// appleReceiptVerify.config({
//     secret: process.env.APP_STORE_APP_SHARED_KEY, // Your shared secret from App Store Connect
//     environment: ["sandbox"], // Can be 'production' or 'sandbox'
//     verbose: true, // Enables verbose logging for debugging
//     extended: true, // Provides extended information for subscriptions
//     ignoreExpired: false,
// });



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

                // await markPurchaseFailure(purchaseToken);

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

                    if (months == 1) {
                        _increaseUserPoints(currentUser._id, currentUser.user_points, 10);

                        sendNotification(currentUser, "👛 You just got 10 coins!", "Enjoy your monthly free coins.");
                        emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                    }

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

                    if (months == 1) {
                        _increaseUserPoints(currentUser._id, currentUser.user_points, 10);

                        sendNotification(currentUser, "👛 You just got 10 coins!", "Enjoy your monthly free coins.");
                        emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                    }


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


// validation handler (In this case - subscription Validation)
export const validateAppStorePayment = async (req, res) => {
    const receiptData = req.body.receiptData;
    try {
        // Validate the receipt
        const products = await appleReceiptVerify.validate({ receipt: receiptData });
        return res.status(200).json({
            success: true,
            message: "Subscription validation successful",
            products,
        });
    } catch (error) {
        if (error instanceof EmptyError) {
            return res.status(400).json({ success: false, message: "Receipt data is empty" });
        } else if (error instanceof ServiceUnavailableError) {
            return res.status(503).json({
                success: false,
                message: "Service unavailable, try again later",
            });
        } else {
            return res.status(500).json({
                success: false,
                message: "An error occurred during receipt validation",
                error: error.message,
            });
        }
    }
};


export const appStoreSubscriptionWebhook = async (req, res) => {
    try {
        const signedPayload = req.body.signedPayload;

        const decodedPayload = jwt.decode(signedPayload, { complete: true }).payload;

        const notificationType = decodedPayload.notificationType;

        console.log(decodedPayload);

        const data = decodedPayload.data;

        console.log("Transaction data:", jwt.decode(data.signedTransactionInfo));

        const { transactionId, originalTransactionId, bundleId, productId, purchaseDate, originalPurchaseDate, quantity, type, inAppOwnershipType, signedDate } = jwt.decode(data.signedTransactionInfo);

        console.log("Apple Notification Type:", notificationType);

        const purchaseUserId = await getUserIdFromPurchaseToken(originalTransactionId);
        const currentUser = await User.findById(purchaseUserId);

        if (!currentUser) {
            return res.status(404).json(new ApiResponse(404, null, "User not found."));
        }


        if (type == "Consumable" && inAppOwnershipType == "PURCHASED") {
            const sku = productId;

            if (sku.startsWith("tgc_shop_") && sku.endsWith("_coins")) {
                let coins;
                try {
                    let parseValue = sku.replace("tgc_shop_", "").replace("_coins", "").trim();
                    coins = parseInt(parseValue);
                } catch (error) {
                    console.log("Error parsing coins:", error);
                    return res.status(500).send("Invalid SKU");
                }

                const coinsAfterUpdate = currentUser.user_points + coins;

                await User.findByIdAndUpdate(
                    currentUser._id,
                    { user_points: coinsAfterUpdate },
                    { new: true }
                ).select("-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry");

                emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                emitIndicatorsSocketEvent(currentUser._id, "COIN_PURCHASE_SUCCESS");

                try {
                    await addNotification(currentUser._id, "👛 Coin Purchase Successful!", `${coins} coins added to your account.`);
                } catch (error) {
                    console.log("Couldn't send notification");
                }

                return res.status(200).send("Coin purchase processed");
            }

            console.log(`Unknown one-time product SKU: ${sku}`);
            return res.status(501).send("Unsupported one-time purchase product.");
        }

        switch (notificationType) {
            case 'DID_RENEW':
            case 'SUBSCRIBED':
                currentUser.subscription_status = "active";
                currentUser.last_renew_date = new Date(Number(purchaseDate));
                currentUser.subscription_type = productId.includes("monthly") ? "monthly" : "yearly";
                currentUser.next_billing_date = calculateNextBillingDate(productId.includes("monthly") ? 1 : 12);

                if (productId.includes("monthly")) {
                    _increaseUserPoints(currentUser._id, currentUser.user_points, 10);
                    sendNotification(currentUser, "👛 You just got 10 coins!", "Enjoy your monthly free coins.");
                }

                emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                emitIndicatorsSocketEvent(currentUser._id, "SUBSCRIPTION_START_SUCCESS");
                break;

            case 'CANCEL':
            case 'DID_FAIL_TO_RENEW':
                currentUser.subscription_status = "inactive";
                sendNotification(currentUser, "Your subscription was cancelled", "You won't be able to access premium features.");
                emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");
                break;




            default:
                console.log("Unhandled Apple notification:", notificationType);
        }

        await currentUser.save();

        return res.status(200).send("Received Apple notification");
    } catch (error) {
        console.error("Error handling Apple notification:", error);
        return res.status(500).send("Error");
    }
};



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