import { User } from '../../models/auth/user.models.js';
import UserPost from '../../models/social/UserPost.js';
import UserComment from '../../models/social/UserComment.js';
import { ApiResponse } from '../../utils/ApiResponse.js';

import { addNotification } from '../notification/notificationController.js';

import mongoose from "mongoose";

export const createComment = async (req, res) => {
    const { post_id, parent_comment_id, comment_text } = req.body;


    let user_id = req.user._id;

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
            parent_comment_id: (parent_comment_id == undefined || parent_comment_id == null) ? null : parent_comment_id,
            comment_text
        });

        await newComment.save();

        console.log(req.user._id, postExists.user_id);

        if (!req.user._id.equals(postExists.user_id)) {
            addNotification(postExists.user_id, `${req.user.nameElseUsername} commented on your post!`, newComment.comment_text, { doer: req.user._id, payload: newComment._id });
        }

        res.status(201).json(new ApiResponse(201, {}, "Comment posted successfully."));
    } catch (err) {
        res.status(500).json(new ApiResponse(500, { error: err.message }, "Server error"));
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
// export const getComments = async (req, res) => {
//     const { post_id, parent_comment_id } = req.query;

//     try {
//         if (!post_id) {
//             return res.status(400).json({ success: false, message: 'Post ID is required' });
//         }

//         const postExists = await UserPost.findById(post_id);
//         if (!postExists) {
//             return res.status(404).json({ success: false, message: 'Post not found' });
//         }

//         // Build query for comments
//         const query = { post_id };
//         if (parent_comment_id) {
//             query.parent_comment_id = parent_comment_id;
//         } else {
//             query.parent_comment_id = null; // Only top-level comments if parent_comment_id is null
//         }

//         const comments = await UserComment.find(query).populate('user_id', 'username email');

//         if (parent_comment_id) {
//             const nestedComments = await getNestedComments(parent_comment_id);
//             res.status(200).json({ success: true, data: { comments: nestedComments } });
//         } else {
//             const commentsWithReplies = await Promise.all(
//                 comments.map(async (comment) => {
//                     const replies = await getNestedComments(comment._id);
//                     return { ...comment._doc, replies };
//                 })
//             );

//             res.status(200).json({ success: true, data: { comments: commentsWithReplies } });
//         }
//     } catch (err) {
//         res.status(500).json({ success: false, message: 'Server error', error: err.message });
//     }
// };



// Get comments for a post
export const getComments = async (req, res) => {
    const { post_id, parent_comment_id } = req.body;

    try {
        if (!post_id) {
            return res.status(400).json(new ApiResponse(400, {}, 'Post ID is required'));
        }

        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Build query for comments
        const query = { post_id };

        if (parent_comment_id) {
            // If parent_comment_id is provided, get immediate children of that comment
            query.parent_comment_id = parent_comment_id;
        } else {
            // If no parent_comment_id, get top-level comments (i.e., those with null parent_comment_id)
            query.parent_comment_id = null;
        }

        const comments = await UserComment.find(query).populate('user_id', 'name username avatar');


        const commentPromises = comments.map(async (comment) => {
            const commentObject = comment.toObject();
            commentObject.user = commentObject.user_id; // Add user info under user key
            delete commentObject.user_id; // Remove user_id field


            // Count the number of replies for each comment
            const repliesCount = await UserComment.countDocuments({ parent_comment_id: comment._id });
            commentObject.repliesCount = repliesCount; // Add repliesCount field



            commentObject.numLikes = commentObject.likes.length;
            commentObject.hasUserLiked = commentObject.likes.map(id => id.toString()).includes(req.user._id.toString());
            delete commentObject.likes;


            return commentObject;
        });

        const formattedComments = await Promise.all(commentPromises);

        // If parent_comment_id is provided, send only the immediate children
        if (parent_comment_id) {
            res.status(200).json({ success: true, data: { comments: formattedComments } });
        } else {
            // If parent_comment_id is not provided, send top-level comments without nesting
            res.status(200).json({ success: true, data: { comments: formattedComments } });
        }
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};





export const likeComment = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { post_id, comment_id } = req.body; // Post and comment IDs

        // Validate post_id and comment_id
        if (!post_id) {
            return res.status(400).json(new ApiResponse(400, {}, "Post ID is required"));
        }

        if (!comment_id) {
            return res.status(400).json(new ApiResponse(400, {}, "Comment ID is required"));
        }

        // Check if the post exists
        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Check if the comment exists
        const commentExists = await UserComment.findById(comment_id);
        if (!commentExists || commentExists.post_id.toString() !== post_id) {
            return res.status(404).json(new ApiResponse(404, {}, 'Comment not found for this post'));
        }

        // Check if the user has already liked the comment
        if (commentExists.likes.includes(currentUserId)) {
            return res.status(400).json(new ApiResponse(400, {}, 'You have already liked this comment'));
        }

        // Add the current user's ID to the likes array
        commentExists.likes.push(currentUserId);
        await commentExists.save();

        if (!req.user._id.equals(commentExists.user_id)) {
            addNotification(commentExists.user_id, `❤ ${req.user.nameElseUsername} liked your comment!`, commentExists.comment_text, { doer: req.user._id, payload: commentExists._id });
        }

        return res.status(200).json(new ApiResponse(200, {}, "Comment liked successfully"));
    } catch (error) {
        console.error("Error in likeComment:", error);
        return res.status(500).json(new ApiResponse(500, {}, error.message || 'An error occurred'));
    }
}

export const unlikeComment = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { post_id, comment_id } = req.body; // Post and comment IDs

        // Validate post_id and comment_id
        if (!post_id) {
            return res.status(400).json(new ApiResponse(400, {}, "Post ID is required"));
        }

        if (!comment_id) {
            return res.status(400).json(new ApiResponse(400, {}, "Comment ID is required"));
        }

        // Check if the post exists
        const postExists = await UserPost.findById(post_id);
        if (!postExists) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Check if the comment exists
        const commentExists = await UserComment.findById(comment_id);
        if (!commentExists || commentExists.post_id.toString() !== post_id) {
            return res.status(404).json(new ApiResponse(404, {}, 'Comment not found for this post'));
        }

        // Check if the user has already liked the comment
        if (!commentExists.likes.includes(currentUserId)) {
            return res.status(400).json(new ApiResponse(400, {}, "You haven't liked this comment"));
        }

        // Add the current user's ID to the likes array
        commentExists.likes.pull(currentUserId);
        await commentExists.save();

        return res.status(200).json(new ApiResponse(200, {}, "Comment unLiked successfully"));
    } catch (error) {
        console.error("Error in unlikeComment:", error);
        return res.status(500).json(new ApiResponse(500, {}, error.message || 'An error occurred'));
    }
};
