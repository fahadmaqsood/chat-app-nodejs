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

            await markPurchaseFailure(purchaseToken);

            return res.status(501).send('Not implemented yet.');
        }


        await markPurchaseFailure(purchaseToken);

        // Respond to Google that the message was received
        res.status(501).send("Don't know what kind of purchase that is.");
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).send('Error');
    }
}


export const getUserIdFromPurchaseToken = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    // console.log(`purchase: ${purchase}`)

    return purchase.user_id;
}


export const markPurchaseFailure = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    purchase.payment_status = "failure";

    await purchase.save();
}

export const markPurchaseSuccess = async (purchaseToken) => {
    const purchase = await PlayStoreTransactions.findOne({ purchaseToken });

    purchase.payment_status = "success";

    await purchase.save();
}


export const addCoinPurchase = async (req, res) => {
    try {
        const userId = req.user._id;
        const purchaseToken = req.body.purchaseToken;


        const newPurchase = new PlayStoreTransactions({
            user_id: new mongoose.Schema.Types.ObjectId(userId),
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