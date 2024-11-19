import axios from 'axios';
import qs from 'querystring'; // To format body for PayPal token request
import { ApiResponse } from '../../utils/ApiResponse.js';


import SubscriptionCodes from '../../models/subscription_codes/subscriptionCodes.js';
import { generateUniqueCode } from '../subscription_codes/subscriptioncodes.controllers.js';


import { isAppOpenForUser, emitIndicatorsSocketEvent } from "../../socket/indicators.js";

import { addNotification } from "../../controllers/notification/notificationController.js";

import {
    sendEmail,
    paypalSubscriptionCodeMailgenContent
} from "../../utils/mail.js";


import paypal from 'paypal-rest-sdk';

//const paypal = require('paypal-rest-sdk');



// Your PayPal client credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_TYPE == "live" ? process.env.PAYPAL_LIVE_CLIENT_ID : process.env.PAYPAL_SANDBOX_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_TYPE == "live" ? process.env.PAYPAL_LIVE_CLIENT_SECRET : process.env.PAYPAL_SANDBOX_CLIENT_SECRET;



paypal.configure({
    'mode': process.env.PAYPAL_TYPE,  // live
    'client_id': PAYPAL_CLIENT_ID,
    'client_secret': PAYPAL_CLIENT_SECRET,
});

// const planIDs = {
//     "P-3JP97424FK586314NM4F3ZJQ": 1 //monthly subscription
// };


const planIDs = {
    "P-3TT806721S364024MM4CW7AY": 12, // annual
    "P-09626795MH982183KM3SL7IY": 1, // monthly
}


// Function to get PayPal access token
async function getPayPalAccessToken() {
    const auth = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString('base64');

    try {
        const response = await axios.post('https://api-m.sandbox.paypal.com/v1/oauth2/token',
            qs.stringify({ grant_type: 'client_credentials' }),
            {
                headers: {
                    Authorization: `Basic ${auth}`,
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        );
        return response.data.access_token; // Return access token
    } catch (error) {
        console.error('Error getting PayPal access token:', error.response.data);
        throw new Error('Unable to authenticate with PayPal.');
    }
}









// Function to validate subscription with PayPal
async function validateSubscription(subscriptionID) {
    const accessToken = await getPayPalAccessToken(); // Get the access token

    try {
        const response = await axios.get(`https://api-m.sandbox.paypal.com/v1/billing/subscriptions/${subscriptionID}`, {
            headers: {
                Authorization: `Bearer ${accessToken}`, // Bearer token for PayPal API
                'Content-Type': 'application/json',
            },
        });
        return response.data; // Return PayPal's subscription data
    } catch (error) {
        console.error('Error validating subscription:', error.response.data);
        throw new Error('Unable to validate subscription.');
    }
}


async function getSubscriptionCode(paypal_subscription_id, months, price_paid, full_name, email, subscription_date, next_billing_date) {


    // Check if subscription with the given paypal_subscription_id already exists
    const existingSubscription = await SubscriptionCodes.findOne({ paypal_subscription_id });

    if (existingSubscription) {
        // If the subscription exists, return the existing subscription code and referral code
        return {
            user_subscription_code: existingSubscription.subscription_code,
            user_referral_code: existingSubscription.referral_code
        };
    }


    const user_subscription_code = await generateUniqueCode('SB'); // Generate unique subscription code
    const user_referral_code = await generateUniqueCode('RF'); // Generate unique referral code


    // Create new subscription code
    const newSubscription = new SubscriptionCodes({
        paypal_subscription_id: paypal_subscription_id,

        months: months,
        referrals: [],

        subscription_code: user_subscription_code,
        referral_code: user_referral_code,
        price_paid: price_paid,

        full_name,
        email,
        subscription_date,
        next_billing_date
    });


    // Save to database
    await newSubscription.save();

    return { user_subscription_code, user_referral_code };
}


async function updateSubscriptionCode(paypal_subscription_id, months, price_paid, full_name, email, subscription_date, next_billing_date) {
    // Check if subscription with the given paypal_subscription_id exists
    const existingSubscription = await SubscriptionCodes.findOne({ paypal_subscription_id });

    if (existingSubscription) {
        // If subscription exists, update the record with new values
        existingSubscription.months = months;
        existingSubscription.price_paid = price_paid;
        existingSubscription.full_name = full_name;
        existingSubscription.email = email;
        existingSubscription.subscription_date = subscription_date;
        existingSubscription.next_billing_date = next_billing_date;


        if (existingSubscription.redeemed_by) {

            const currentUser = await User.findById(existingSubscription.redeemed_by);

            currentUser.subscription_status = 'active';
            currentUser.subscription_type = months == 1 ? 'monthly' : 'yearly';
            currentUser.next_billing_date = next_billing_date;

            await currentUser.save();

            sendNotification(currentUser, "Your subscription was expired", "You won't be able to access your account from now on.");
            emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

        }



        // Save the updated record to the database
        await existingSubscription.save();

        // Return the updated subscription code and referral code
        return {
            user_subscription_code: existingSubscription.subscription_code,
            user_referral_code: existingSubscription.referral_code
        };
    } else {
        // If no subscription exists, return an error or handle accordingly
        throw new Error('Subscription not found');
    }
}





export const logSubscription = async (req, res) => {
    const { subscriptionID } = req.body;


    try {
        // Validate the subscription with PayPal
        const subscriptionData = await validateSubscription(subscriptionID);

        // Log subscription data or store it in a database
        console.log('Subscription data:', subscriptionData);


        if (subscriptionData.status == "ACTIVE" && Object.keys(planIDs).includes(subscriptionData.plan_id)) {

            const subscriber = subscriptionData.subscriber;

            const email_address = subscriber.email_address;
            const full_name = subscriber.name.given_name + " " + subscriber.name.surname;
            const shipping_address = subscriber.shipping_address;

            console.log(shipping_address.address.country_code);

            const subscription_start_date = subscriptionData.start_time;
            const next_billing_time = subscriptionData.billing_info.next_billing_time;

            const price_paid = subscriptionData.shipping_amount.value + " " + subscriptionData.shipping_amount.currency_code;


            const { user_subscription_code, user_referral_code } = await getSubscriptionCode(planIDs[subscriptionData.plan_id], price_paid, full_name, email_address, new Date(subscription_start_date), new Date(next_billing_time));

            // Respond to the client
            res.status(200).json(new ApiResponse(200, {
                user_subscription_code,
                user_referral_code
            }, "Subscription validated successfully"));
        } else {
            res.status(403).json(new ApiResponse(403, {
                subscriptionData, // Return subscription details

            }, "Either subscription was unsuccessful or the money wasn't paid to us."));
        }





    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Failed to validate subscription.' });
    }
}




const PAYPAL_SANDBOX_WEBHOOK_ID = process.env.PAYPAL_SANDBOX_WEBHOOK_ID;
const PAYPAL_LIVE_WEBHOOK_ID = process.env.PAYPAL_LIVE_WEBHOOK_ID;

export const sandboxSubscriptionWebhook = async (req, res) => {
    const webhookEvent = req.body;

    console.log("webhookEvent: ", JSON.stringify(req.body));

    // Verify webhook signature (optional but recommended)
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookId = PAYPAL_SANDBOX_WEBHOOK_ID; // Replace with the Webhook ID from PayPal dashboard

    const expectedSignature = {
        transmissionId,
        transmissionTime,
        certUrl,
        authAlgo,
        transmissionSig,
        webhookId,
        eventBody: req.body
    };



    paypal.notification.webhookEvent.verify(req.headers, req.body, webhookId, async function (response) {
        // if (error) {
        //     console.error('Webhook signature verification failed:', error);
        //     return res.sendStatus(400); // Bad Request if verification fails
        // }

        console.log("response: " + response);
        console.log("response: " + response.verification_status);

        // if (response.verification_status === 'SUCCESS') {
        console.log('Webhook Verified Successfully:', webhookEvent);


        const subscriptionId = webhookEvent.resource.id;


        console.log('subscriptionId:', subscriptionId);

        let existingSubscription;

        let planId;
        let startTime;
        let next_billing_time;

        let full_name;
        let email_address;
        let shipping_address;

        let price_paid;



        // Handle the webhook event here, e.g., updating your order status in the database
        switch (webhookEvent.event_type) {

            case 'BILLING.SUBSCRIPTION.CREATED':

                console.log(`New subscription created: ${subscriptionId}`);


                break;

            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                // Handle subscription activation

                // Mark subscription as active in your system, grant access to the user

                planId = webhookEvent.resource.plan_id;
                startTime = webhookEvent.resource.start_time;
                next_billing_time = webhookEvent.resource.billing_info.next_billing_time;



                console.log(`Subscription activated: ${subscriptionId}, Plan: ${planId}, Start: ${startTime}`);


                email_address = webhookEvent.resource.subscriber.email_address;
                full_name = webhookEvent.resource.subscriber.name.given_name + " " + webhookEvent.resource.subscriber.name.surname;
                shipping_address = webhookEvent.resource.subscriber.shipping_address;


                price_paid = webhookEvent.resource.shipping_amount.value + " " + webhookEvent.resource.shipping_amount.currency_code;

                const {
                    user_subscription_code,
                    user_referral_code
                } = await getSubscriptionCode(
                    subscriptionId,
                    planIDs[planId],
                    price_paid,
                    full_name,
                    email_address,
                    new Date(startTime),
                    new Date(next_billing_time)
                );

                // Send mail with the password reset link. It should be the link of the frontend url with token
                await sendEmail({
                    email: email_address,
                    subject: "Teen Global Connect Subscription Voucher",
                    mailgenContent: paypalSubscriptionCodeMailgenContent(
                        full_name,
                        planIDs[planId] == 1 ? "Monthly" : "Yearly",
                        user_subscription_code
                    ),
                });

                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
                const cancellationTime = webhookEvent.resource.update_time;

                console.log(`Subscription cancelled: ${subscriptionId}, Time: ${cancellationTime}`);
                // Update subscription status in your database

                break;

            case 'BILLING.SUBSCRIPTION.EXPIRED':
                console.log(`Subscription expired: ${subscriptionId}`);

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "inactive";

                    await currentUser.save();

                    sendNotification(currentUser, "Your subscription was expired", "You won't be able to access your account from now on.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }

                break;

            case 'PAYMENT.SALE.COMPLETED':
                const paymentAmount = webhookEvent.resource.amount.total;
                const paymentCurrency = webhookEvent.resource.amount.currency;
                console.log(`Payment completed: ${paymentAmount} ${paymentCurrency}`);
                // Extend subscription period, save payment info
                break;

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                // Handle failed subscription payment
                console.log('Payment failed:', resource);
                // Notify user of failed payment, retry payment, offer alternative methods

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    sendNotification(currentUser, "Payment Failed", "Please resolve issues with your paypal account.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }


                break;

            case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
                // Handle subscription re-activation
                console.log(`Subscription re-activated: ${subscriptionId}`);
                // Mark subscription as active again, restore access, notify the user

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "active";

                    await currentUser.save();

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }

                break;

            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                // Handle subscription suspension
                console.log('Subscription suspended:', subscriptionId);
                // Temporarily suspend access, notify the user, guide them on reactivation

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "inactive";

                    await currentUser.save();

                    sendNotification(currentUser, "Your subscription was suspended", "Paypal couldn't send us your subscription payment.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }


                break;

            case 'BILLING.SUBSCRIPTION.UPDATED':
                // Handle subscription updates (e.g., plan change)
                console.log('Subscription updated:', subscriptionId);
                // Update subscription details in your system, notify the user

                planId = webhookEvent.resource.plan_id;
                startTime = webhookEvent.resource.start_time;
                next_billing_time = webhookEvent.resource.billing_info.next_billing_time;



                console.log(`Subscription updated: ${subscriptionId}, Plan: ${planId}, Start: ${startTime}`);


                email_address = webhookEvent.resource.subscriber.email_address;
                full_name = webhookEvent.resource.subscriber.name.given_name + " " + webhookEvent.resource.subscriber.name.surname;
                shipping_address = webhookEvent.resource.subscriber.shipping_address;


                price_paid = webhookEvent.resource.shipping_amount.value + " " + webhookEvent.resource.shipping_amount.currency_code;


                await updateSubscriptionCode(
                    subscriptionId,
                    planIDs[planId],
                    price_paid,
                    full_name,
                    email_address,
                    new Date(startTime),
                    new Date(next_billing_time)
                );

                break;

            default:
                // Handle unknown or other events
                console.log('Unhandled event type:', event_type);
                break;
        }

        res.status(200).send('Webhook received');
        // } else {
        // console.error('Webhook signature verification failed');
        // res.status(400).send('Webhook verification failed');
        // }
    });
}





export const liveSubscriptionWebhook = async (req, res) => {
    const webhookEvent = req.body;

    console.log("webhookEvent: ", JSON.stringify(req.body));

    // Verify webhook signature (optional but recommended)
    const transmissionId = req.headers['paypal-transmission-id'];
    const transmissionTime = req.headers['paypal-transmission-time'];
    const certUrl = req.headers['paypal-cert-url'];
    const authAlgo = req.headers['paypal-auth-algo'];
    const transmissionSig = req.headers['paypal-transmission-sig'];
    const webhookId = PAYPAL_LIVE_WEBHOOK_ID; // Replace with the Webhook ID from PayPal dashboard

    const expectedSignature = {
        transmissionId,
        transmissionTime,
        certUrl,
        authAlgo,
        transmissionSig,
        webhookId,
        eventBody: req.body
    };



    paypal.notification.webhookEvent.verify(req.headers, req.body, webhookId, async function (response) {
        // if (error) {
        //     console.error('Webhook signature verification failed:', error);
        //     return res.sendStatus(400); // Bad Request if verification fails
        // }

        console.log("response: " + response);
        console.log("response: " + response.verification_status);

        // if (response.verification_status === 'SUCCESS') {
        console.log('Webhook Verified Successfully:', webhookEvent);


        const subscriptionId = webhookEvent.resource.id;


        console.log('subscriptionId:', subscriptionId);

        let existingSubscription;

        let planId;
        let startTime;
        let next_billing_time;

        let full_name;
        let email_address;
        let shipping_address;

        let price_paid;



        // Handle the webhook event here, e.g., updating your order status in the database
        switch (webhookEvent.event_type) {

            case 'BILLING.SUBSCRIPTION.CREATED':

                console.log(`New subscription created: ${subscriptionId}`);


                break;

            case 'BILLING.SUBSCRIPTION.ACTIVATED':
                // Handle subscription activation

                // Mark subscription as active in your system, grant access to the user

                planId = webhookEvent.resource.plan_id;
                startTime = webhookEvent.resource.start_time;
                next_billing_time = webhookEvent.resource.billing_info.next_billing_time;



                console.log(`Subscription activated: ${subscriptionId}, Plan: ${planId}, Start: ${startTime}`);


                email_address = webhookEvent.resource.subscriber.email_address;
                full_name = webhookEvent.resource.subscriber.name.given_name + " " + webhookEvent.resource.subscriber.name.surname;
                shipping_address = webhookEvent.resource.subscriber.shipping_address;


                price_paid = webhookEvent.resource.shipping_amount.value + " " + webhookEvent.resource.shipping_amount.currency_code;

                const {
                    user_subscription_code,
                    user_referral_code
                } = await getSubscriptionCode(
                    subscriptionId,
                    planIDs[planId],
                    price_paid,
                    full_name,
                    email_address,
                    new Date(startTime),
                    new Date(next_billing_time)
                );

                // Send mail with the password reset link. It should be the link of the frontend url with token
                await sendEmail({
                    email: email_address,
                    subject: "Teen Global Connect Subscription Voucher",
                    mailgenContent: paypalSubscriptionCodeMailgenContent(
                        full_name,
                        planIDs[planId] == 1 ? "Monthly" : "Yearly",
                        user_subscription_code
                    ),
                });

                break;

            case 'BILLING.SUBSCRIPTION.CANCELLED':
                const cancellationTime = webhookEvent.resource.update_time;

                console.log(`Subscription cancelled: ${subscriptionId}, Time: ${cancellationTime}`);
                // Update subscription status in your database

                break;

            case 'BILLING.SUBSCRIPTION.EXPIRED':
                console.log(`Subscription expired: ${subscriptionId}`);

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "inactive";

                    await currentUser.save();

                    sendNotification(currentUser, "Your subscription was expired", "You won't be able to access your account from now on.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }

                break;

            case 'PAYMENT.SALE.COMPLETED':
                const paymentAmount = webhookEvent.resource.amount.total;
                const paymentCurrency = webhookEvent.resource.amount.currency;
                console.log(`Payment completed: ${paymentAmount} ${paymentCurrency}`);
                // Extend subscription period, save payment info
                break;

            case 'BILLING.SUBSCRIPTION.PAYMENT.FAILED':
                // Handle failed subscription payment
                console.log('Payment failed:', resource);
                // Notify user of failed payment, retry payment, offer alternative methods

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    sendNotification(currentUser, "Payment Failed", "Please resolve issues with your paypal account.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }


                break;

            case 'BILLING.SUBSCRIPTION.RE-ACTIVATED':
                // Handle subscription re-activation
                console.log(`Subscription re-activated: ${subscriptionId}`);
                // Mark subscription as active again, restore access, notify the user

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "active";

                    await currentUser.save();

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }

                break;

            case 'BILLING.SUBSCRIPTION.SUSPENDED':
                // Handle subscription suspension
                console.log('Subscription suspended:', subscriptionId);
                // Temporarily suspend access, notify the user, guide them on reactivation

                existingSubscription = await SubscriptionCodes.findOne({ subscriptionId });

                if (existingSubscription.redeemed_by) {

                    const currentUser = await User.findById(existingSubscription.redeemed_by);

                    currentUser.subscription_status = "inactive";

                    await currentUser.save();

                    sendNotification(currentUser, "Your subscription was suspended", "Paypal couldn't send us your subscription payment.");
                    emitIndicatorsSocketEvent(currentUser._id, "REFRESH_USER_EVENT");

                } else {
                    console.log("User not found for subscription expiry (paypal)");
                }


                break;

            case 'BILLING.SUBSCRIPTION.UPDATED':
                // Handle subscription updates (e.g., plan change)
                console.log('Subscription updated:', subscriptionId);
                // Update subscription details in your system, notify the user

                planId = webhookEvent.resource.plan_id;
                startTime = webhookEvent.resource.start_time;
                next_billing_time = webhookEvent.resource.billing_info.next_billing_time;



                console.log(`Subscription updated: ${subscriptionId}, Plan: ${planId}, Start: ${startTime}`);


                email_address = webhookEvent.resource.subscriber.email_address;
                full_name = webhookEvent.resource.subscriber.name.given_name + " " + webhookEvent.resource.subscriber.name.surname;
                shipping_address = webhookEvent.resource.subscriber.shipping_address;


                price_paid = webhookEvent.resource.shipping_amount.value + " " + webhookEvent.resource.shipping_amount.currency_code;


                await updateSubscriptionCode(
                    subscriptionId,
                    planIDs[planId],
                    price_paid,
                    full_name,
                    email_address,
                    new Date(startTime),
                    new Date(next_billing_time)
                );

                break;

            default:
                // Handle unknown or other events
                console.log('Unhandled event type:', event_type);
                break;
        }

        res.status(200).send('Webhook received');
        // } else {
        // console.error('Webhook signature verification failed');
        // res.status(400).send('Webhook verification failed');
        // }
    });
}


async function sendNotification(currentUser, title, message) {
    try {
        await addNotification(currentUser._id, title, message);
    } catch (error) {
        console.log("couldn't send notification to the user");
    }
}