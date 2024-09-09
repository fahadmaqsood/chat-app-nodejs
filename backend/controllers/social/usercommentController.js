const User = require('../models/User');         
const UserPost = require('../models/UserPost');  
const UserComment = require('../models/UserComment'); 

exports.createComment = async (req, res) => {
    const { post_id, user_id, comment_text, comment_content } = req.body;

    try {
        if (!post_id || !user_id) {
            return res.status(400).json({ success: false, message: 'Post ID and User ID are required' });
        }

        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        const userExists = await User.findById(user_id);
        if (!userExists) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const newComment = new UserComment({
            post_id,
            user_id,
            comment_text,
            comment_content
        });

        await newComment.save();

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

// Helper function to get nested comments
const getNestedComments = async (parentId) => {
    // Find comments that have the current comment as their parent
    const nestedComments = await UserComment.find({ parent_comment_id: parentId }).populate('user_id', 'username email');

    // Recursively get nested comments for each found comment
    const nestedCommentsWithReplies = await Promise.all(
        nestedComments.map(async (comment) => {
            const replies = await getNestedComments(comment._id); // Recursively get replies
            return { ...comment._doc, replies }; // Combine comment with its replies
        })
    );

    return nestedCommentsWithReplies;
};

// Get comments for a post
exports.getComments = async (req, res) => {
    const { post_id, parent_comment_id } = req.query;

    try {
        if (!post_id) {
            return res.status(400).json({ success: false, message: 'Post ID is required' });
        }

        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json({ success: false, message: 'Post not found' });
        }

        // Build query for comments
        const query = { post_id };
        if (parent_comment_id) {
            query.parent_comment_id = parent_comment_id;
        } else {
            query.parent_comment_id = null; // Only top-level comments if parent_comment_id is null
        }

        const comments = await UserComment.find(query).populate('user_id', 'username email');

        if (parent_comment_id) {
            const nestedComments = await getNestedComments(parent_comment_id);
            res.status(200).json({ success: true, data: { comments: nestedComments } });
        } else {
            const commentsWithReplies = await Promise.all(
                comments.map(async (comment) => {
                    const replies = await getNestedComments(comment._id);
                    return { ...comment._doc, replies }; 
                })
            );

            res.status(200).json({ success: true, data: { comments: commentsWithReplies } });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};
