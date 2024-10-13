import axios from 'axios';
import qs from 'querystring'; // To format body for PayPal token request
import { ApiResponse } from '../../utils/ApiResponse.js';


import SubscriptionCodes from '../../models/subscription_codes/subscriptionCodes.js';
import { generateUniqueCode } from '../subscription_codes/subscriptioncodes.controllers.js';



// Your PayPal client credentials
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;


const planIDs = {
    "P-3JP97424FK586314NM4F3ZJQ": 1 //monthly subscription
};


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


async function getSubscriptionCode(months, price_paid, full_name, email, subscription_date, next_billing_date) {
    const user_subscription_code = await generateUniqueCode('SB'); // Generate unique subscription code
    const user_referral_code = await generateUniqueCode('RF'); // Generate unique referral code


    // Create new subscription code
    const newSubscription = new SubscriptionCodes({
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