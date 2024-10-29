import { PubSub } from '@google-cloud/pubsub';

import CoinPurchases from '../../models/payment/CoinPurchases.js';

import { User } from '../../models/auth/user.models.js'

const pubsub = new PubSub();

// Your Google Cloud Pub/Sub subscription
const subscriptionName = 'play-store-webhook';

export const playstoreSubscriptionWebhook = async (req, res) => {
    try {

        console.log(req.body);
        // Pub/Sub messages are base64 encoded, so we decode them here
        const messageData = Buffer.from(req.body.message.data, 'base64').toString();
        const messageJson = JSON.parse(messageData);

        console.log(messageJson);

        if (Object.keys(messageJson).includes("oneTimeProductNotification")) {

            const sku = messageJson.oneTimeProductNotification.sku;
            const purchaseToken = messageJson.oneTimeProductNotification.sku;


            const currentUser = getUserIdFromPurchaseToken(purchaseToken);

            if (!currentUser) {
                await markPurchaseFailure(purchaseToken);

                return res
                    .status(404)
                    .json(new ApiResponse(404, null, "User not found."));
            }

            if (sku.startsWith("tgc_shop_") && sku.endsWith("_coins")) {
                let coins;
                try {
                    console.log("parse value: ", sku.replace("tgc_shop_", "").replace("_coins", "").trim());
                    coins = parseInt(sku.replace("tgc_shop_", "").replace("_coins").trim());
                } catch (error) {
                    console.log(error);

                    await markPurchaseFailure(purchaseToken);

                    return res.status(500).send('Error');
                }

                console.log("coins: ", coins);

                let updatedUser = await User.findByIdAndUpdate(
                    currentUser._id,
                    { user_points: currentUser.user_points + coins },
                    { new: true }
                ).select(
                    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
                );

                await markPurchaseFailure(purchaseToken);

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
    const purchase = await CoinPurchases.find({ purchaseToken }).lean();

    return purchase.user_id;
}


export const markPurchaseFailure = async (purchaseToken) => {
    const purchase = await CoinPurchases.find({ purchaseToken });

    purchase.payment_status = "failure";

    await purchase.save();
}


export const addCoinPurchase = async (req, res) => {
    const userId = req.user._id;
    const purchaseToken = req.body.purchaseToken;
    const payment_status = req.body.payment_status;


    const newPurchase = new CoinPurchases({
        userId,
        purchaseToken,
        payment_status
    });

    await newPurchase.save();
};


// export const updateCoinPurchase = async (req, res) => {
//     const userId = req.user._id;
//     const purchaseToken = req.body.purchaseToken;
//     const payment_status = req.body.payment_status;


//     const newNotification = new CoinPurchases({
//         userId,
//         purchaseToken,
//         payment_status
//     });
// };