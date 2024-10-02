import { User } from '../../models/auth/user.models.js';
import UserPost from '../../models/social/UserPost.js';
import PostLike from '../../models/social/PostLikes.js';
import { ApiResponse } from '../../utils/ApiResponse.js';
import { addNotification } from '../notification/notificationController.js';

export const likePost = async (req, res) => {
    const { post_id } = req.body;

    try {
        const userExists = await User.findById(req.user._id);
        const postExists = await UserPost.findById(post_id);

        if (!userExists || !postExists) {
            return res.status(404).json(new ApiResponse(404, {}, "User or post not found"));
        }

        const newLike = new PostLike({ user_id: req.user._id, post_id });
        await newLike.save();


        if (!req.user._id.equals(postExists.user_id)) {
            addNotification(postExists.user_id, `liked your post!`, (!postExists.content || postExists.content.trim() == "") ? "" : postExists.content, { doer: req.user._id, additionalData: { open: "post", post_id: postExists._id } });
        }

        res.status(200).json(new ApiResponse(200, {}, "Successfully liked the post"));
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json(new ApiResponse(400, {}, "Post already liked by this user"));
        }
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};



export const unlikePost = async (req, res) => {
    const { post_id } = req.body;

    try {
        const userExists = await User.findById(req.user._id);
        const postExists = await UserPost.findById(post_id);

        if (!userExists || !postExists) {
            return res.status(404).json(new ApiResponse(404, {}, "User or post not found"));
        }

        const result = await PostLike.findOneAndDelete({
            user_id: req.user._id,
            post_id: post_id
        });

        // Check if the like was found and removed
        if (!result) {

            return res.status(404).json(new ApiResponse(404, {}, "Like not found"));
        }


        res.status(200).json(new ApiResponse(200, {}, "Successfully unliked the post"));
    } catch (err) {
        if (err.code === 11000) {
            return res.status(400).json({ success: false, message: 'Post already unliked by this user' });
        }
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

export const getLikes = async (req, res) => {
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