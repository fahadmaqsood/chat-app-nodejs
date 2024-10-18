import Notification from '../../models/notification/Notifications.js';
import { User } from '../../models/auth/user.models.js'

import { ApiResponse } from '../../utils/ApiResponse.js';

import firebaseAdmin from 'firebase-admin';

import fs from 'fs/promises';

const serviceAccount = JSON.parse(await fs.readFile(process.env.FIREBASE_SERVICE_KEY_PATH, 'utf8'));


const firebase = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
});


function sendNotification(deviceToken, title, message, payload) {
    // // This registration token comes from the client FCM SDKs.
    // const registrationToken = 'YOUR_REGISTRATION_TOKEN';

    const message_data = {
        notification: {
            title: title,
            body: message
        },
        data: {
            "doer": payload["doer"]
        },
        token: deviceToken
    };

    // Send a message to the device corresponding to the provided
    // registration token.
    firebaseAdmin.messaging().send(message_data)
        .then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });
}


export const addNotification = async (user_id, title, message, payload) => {
    try {

        let user = await User.findById(user_id);

        if (!user) {
            throw new Error("User doesn't exist");
        }

        const newNotification = new Notification({
            user_id,
            title,
            message,
            payload
        });



        await newNotification.save();

        sendNotification(user.firebaseToken, title, message, payload);

        return newNotification;

    } catch (error) {
        throw error;
    }
}


export const createNotification = async (req, res) => {
    try {
        const { user_id, title, message, payload } = req.body;

        if (!user_id || !title || !message) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const userExists = await User.findById(user_id);
        if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });

        let newNotification = await addNotification(user_id, title, message, payload);

        res.status(201).json(new ApiResponse(201, newNotification, "Notification created successfully"));

    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getNotifications = async (req, res) => {
    const { limit = 10, start_from = 0 } = req.query;

    let user_id = req.user._id;

    try {
        // const userExists = await User.findById(user_id);
        // if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });

        const notifications = await Notification.find({ user_id })
            .skip(parseInt(start_from))
            .limit(limit)
            .sort({ created_at: -1 })
            .populate('payload.doer', 'name username avatar');

        res.status(201).json(new ApiResponse(201, { notifications }, ""));

    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};