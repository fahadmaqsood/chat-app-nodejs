const UserPost = require('../models/UserPost');
const User = require('../models/User');

exports.createUserPost = async (req, res) => {
    const { user_id, content, media_url, mood_status } = req.body;

    try {
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newPost = new UserPost({
            user_id,
            content,
            media_url,
            mood_status
        });

        const savedPost = await newPost.save();

        res.status(201).json({ 
            success: true, 
            message: 'Post created successfully', 
            post: {
                post_id: savedPost._id, 
                user_id: savedPost.user_id,
                content: savedPost.content,
                media_url: savedPost.media_url,
                mood_status: savedPost.mood_status,
                created_at: savedPost.created_at
            } 
        });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

exports.getPosts = async (req, res) => {
    const { mood, start_from = 0 } = req.query;
    const limit = 10;

    try {
        // Validate input
        if (!mood) {
            return res.status(400).json({ success: false, message: 'Mood is required' });
        }

        const users = await User.find({ mood }).select('_id');
        if (users.length === 0) {
            return res.status(404).json({ success: false, message: 'No users found with the specified mood' });
        }

        const userIds = users.map(user => user._id);

        const posts = await UserPost.find({ user_id: { $in: userIds } })
            .sort({ created_at: -1 }) 
            .skip(parseInt(start_from)) 
            .limit(limit);

        res.status(200).json({ success: true, posts });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};