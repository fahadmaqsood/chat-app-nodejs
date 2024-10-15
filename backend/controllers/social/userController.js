import { User } from '../../models/auth/user.models.js';

export const updateUserMood = async (req, res) => {
    const { mood } = req.body;

    const user_id = req.user._id;

    if (!user_id || !mood) {
        return res.status(400).json({ success: false, message: 'user_id and mood are required' });
    }

    try {
        const user = await User.findById(user_id);

        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        user.mood = mood;
        await user.save();

        res.status(200).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};
