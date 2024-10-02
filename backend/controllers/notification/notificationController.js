import Notification from '../../models/notification/Notifications.js';
import { User } from '../../models/auth/user.models.js'

import { ApiResponse } from '../../utils/ApiResponse.js';

export const addNotification = async (user_id, title, message, payload) => {
    try {
        const newNotification = new Notification({
            user_id,
            title,
            message,
            payload
        });

        await newNotification.save();

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

        let newNotification = addNotification(user_id, title, message, payload);

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
            .sort({ created_at: -1 });

        res.status(201).json(new ApiResponse(201, { notifications }, ""));

    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};