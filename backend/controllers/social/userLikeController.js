const User = require('../models/User');        
const UserPost = require('../models/UserPost'); 
const PostLike = require('../models/PostLikes');

exports.likePost = async (req, res) => {
    const { user_id, post_id } = req.body;

    try {
        const userExists = await User.findById(user_id);
        const postExists = await UserPost.findById(post_id);

        if (!userExists || !postExists) {
            return res.status(404).json({ success: false, message: 'User or post not found' });
        }

        const newLike = new PostLike({ user_id, post_id });
        await newLike.save();

        res.status(200).json({ success: true });
    } catch (err) {
        if (err.code === 11000) { 
            return res.status(400).json({ success: false, message: 'Post already liked by this user' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

exports.getLikes = async (req, res) => {
    const { post_id } = req.query;

    try {
        if (!post_id) {
            return res.status(400).json({ success: false, message: 'Post ID is required' });
        }

        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const likesCount = await PostLike.countDocuments({ post_id });

        res.status(200).json({ success: true, data: { likes: likesCount } });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};