import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});


import Notification from '../../models/notification/Notifications.js';
import { User } from '../../models/auth/user.models.js'

import { ApiResponse } from '../../utils/ApiResponse.js';

import firebaseAdmin from 'firebase-admin';

import fs from 'fs/promises';
import { isAppOpenForUser, emitIndicatorsSocketEvent } from "../../socket/indicators.js";

const serviceAccount = JSON.parse(await fs.readFile(process.env.FIREBASE_SERVICE_KEY_PATH, 'utf8'));


const firebase = firebaseAdmin.initializeApp({
    credential: firebaseAdmin.credential.cert(serviceAccount),
});

export async function sendNotification(deviceToken, title, message, payload) {
    // // This registration token comes from the client FCM SDKs.
    // const registrationToken = 'YOUR_REGISTRATION_TOKEN';

    const message_data = {
        notification: {
            title: title,
            body: message
        },
        data: {
            type: payload["type"] || ""
        },
        token: deviceToken
    };

    // Send a message to the device corresponding to the provided
    // registration token.
    await firebaseAdmin.messaging().send(message_data)
        .then((response) => {
            // Response is a message ID string.
            console.log('Successfully sent message:', response);
        })
        .catch((error) => {
            console.log('Error sending message:', error);
        });
}


async function sendNotificationToMany(deviceTokens, title, message, payload, isCall = false) {
    let message_data = {};

    console.log(deviceTokens);

    if (isCall) {
        message_data = {
            data: payload,
            tokens: deviceTokens // Pass multiple device tokens
        };
    } else {
        message_data = {
            notification: {
                title: title,
                body: message
            },
            data: {
                // "doer": payload["doer"]
            },
            tokens: deviceTokens // Pass multiple device tokens
        };
    }

    // Send a message to all the device tokens provided in the array
    await firebaseAdmin.messaging().sendEachForMulticast(message_data)
        .then((response) => {
            // Response provides details of how many messages were sent successfully
            console.log(response);
            console.log(`${response.successCount} messages were sent successfully`);
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        failedTokens.push(deviceTokens[idx]);
                    }
                });
                console.log('List of tokens that caused failures:', failedTokens);
            }
        })
        .catch((error) => {
            console.log('Error sending messages:', error);
        });
}


export const addNotificationForMany = async (user_ids, title, message, payload, isCall = false) => {
    try {
        // Find all users whose IDs are in the user_ids array
        const users = await User.find({
            _id: { $in: user_ids }
        });

        if (users.length === 0) {
            throw new Error("No users found");
        }

        if (!isCall) {
            // Create an array of notifications to insert
            const notifications = users.map(user => ({
                user_id: user._id,
                title,
                message,
                payload
            }));

            // Insert all notifications in a single operation
            const newNotifications = await Notification.insertMany(notifications);
        }

        // Collect all firebase tokens of users
        const deviceTokens = users.map(user => user.firebaseToken).filter(token => !!token);

        // Send notifications to all users in one batch
        if (deviceTokens.length > 0) {
            await sendNotificationToMany(deviceTokens, title, message, payload, isCall = isCall);
        }

        if (!isCall) {
            user_ids.forEach((user_id) => {
                emitIndicatorsSocketEvent(user_id, "NEW_NOTIFICATION_EVENT", 1);
            });
        }

        return true;

    } catch (error) {
        throw error;
    }

    return false;
};


export const sendCallNotification = async (req, res) => {
    try {
        const receiverIds = req.body.receiverIds;
        const callerId = req.user._id;
        const chatId = req.body.chatId;
        const isVideoCall = req.body.isVideoCall;

        if (!receiverIds || receiverIds.length == 0) {
            res.status(400).json({ success: false, message: 'receiverIds must be defined' });
        }
        if (!chatId) {
            res.status(400).json({ success: false, message: 'chatId must be defined' });
        }

        console.log(receiverIds);

        await addNotificationForMany(receiverIds, null, null, {
            "isCall": "true",
            "callerName": `${req.user.nameElseUsername}`,
            "callerId": `${callerId}`,
            "chatId": `${chatId}`,
            "isVideoCall": `${isVideoCall}`
        }, true);


        res.status(200).json(new ApiResponse(200, {}, "Notification sent successfully"));;
    } catch (error) {
        res.status(500).json(new ApiResponse(500, {}, error));
    }
};


export const addNotificationForAll = async (title, message, payload) => {
    try {
        // Fetch all users
        const users = await User.find({ firebaseToken: { $ne: null } });

        if (users.length === 0) {
            throw new Error("No users found");
        }

        // Create an array of notifications to insert
        const notifications = users.map(user => ({
            user_id: user._id,
            title,
            message,
            payload
        }));

        // Insert all notifications in a single operation
        const newNotifications = await Notification.insertMany(notifications);


        // Collect all firebase tokens of users
        const deviceTokens = users.map(user => user.firebaseToken).filter(token => !!token);

        users.forEach(user => {
            emitIndicatorsSocketEvent(user._id, "NEW_NOTIFICATION_EVENT", 1);
        });

        // Check if there are any valid tokens
        if (deviceTokens.length > 0) {
            // Send notifications to all users in one batch
            await sendNotificationToMany(deviceTokens, title, message, payload);
            console.log(`Notifications sent to ${deviceTokens.length} users.`);
        } else {
            console.log("No valid device tokens found.");
        }
    } catch (error) {
        console.error("Error sending notifications to all users:", error);
        throw error;
    }
};


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

        await sendNotification(user.firebaseToken, title, message, payload);


        emitIndicatorsSocketEvent(user_id, "NEW_NOTIFICATION_EVENT", 1);

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


export const _getUnreadNotificationsCount = async (user_id) => {

    try {
        const notificationsCount = await Notification.countDocuments({ user_id, status: "sent" });

        return notificationsCount;
    } catch (err) {
        console.error(err);
        return false;
    }
};

export const _changeNotificationsStatusToRead = async (user_id) => {

    try {
        // Mark the fetched notifications as read
        await Notification.updateMany(
            { user_id, status: 'sent' }, // Only mark unread notifications
            { $set: { status: 'read', read_at: Date.now() } }  // Set them to read
        );

        return true;
    } catch (err) {
        console.error(err);
        return false;
    }
};