const Notification = require('../models/Notifications');
const User = require('../models/User');

exports.createNotification = async (req, res) => {
    try {
        const { user_id, title, message, payload } = req.body;

        if (!user_id || !title || !message) {
            return res.status(400).json({ success: false, message: 'Missing required fields' });
        }

        const userExists = await User.findById(user_id);
        if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });
        
        const newNotification = new Notification({
            user_id,
            title,
            message,
            payload
        });

        await newNotification.save();

        res.status(201).json({
            success: true,
            message: 'Notification created successfully',
            notification: newNotification
        });
    } catch (error) {
        console.error('Error creating notification:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

exports.getNotifications = async (req, res) => {
    const { user_id, start_from = 0 } = req.query;

    try {
        const userExists = await User.findById(user_id);
        if (!userExists) return res.status(404).json({ success: false, message: 'User not found' });

        const notifications = await Notification.find({ user_id })
            .skip(parseInt(start_from))
            .limit(10)
            .sort({ created_at: -1 });

        res.status(200).json({
            success: true,
            notifications
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};