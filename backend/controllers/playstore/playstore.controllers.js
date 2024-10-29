import { PubSub } from '@google-cloud/pubsub';

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

        // Access notification attributes, e.g., notificationType, purchaseToken
        const notificationType = req.body.message?.attributes?.notificationType;
        const purchaseToken = messageJson.purchaseToken;

        console.log(notificationType);


        if (notificationType == "SUBSCRIPTION_PURCHASED") {

        } else if (notificationType == "SUBSCRIPTION_RENEWED") {

        } else if (notificationType == "SUBSCRIPTION_CANCELED") {

        } else {

        }

        // Process based on notification type (purchase, renewal, cancellation, etc.)
        console.log(`Received notification type: ${notificationType}`);
        console.log(`Purchase token: ${purchaseToken}`);

        // Respond to Google that the message was received
        res.status(200).send('OK');
    } catch (error) {
        console.error('Error processing message:', error);
        res.status(500).send('Error');
    }
}