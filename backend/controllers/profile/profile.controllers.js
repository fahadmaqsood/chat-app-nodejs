import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import mongoose from "mongoose";


import UserPost from '../../models/social/UserPost.js';
import PostLike from '../../models/social/PostLikes.js';
import UserComment from '../../models/social/UserComment.js';


import BlogPost from '../../models/social/BlogPost.js';
import BlogPostLike from '../../models/social/BlogPostLike.js';
import BlogPostComment from '../../models/social/BlogPostComment.js';

import { ScheduledAccountDeletion } from '../../models/auth/ScheduledAccountDeletion.js';


import { getUserFriends } from "../auth/user.controllers.js";


import { Chat } from "../../models/chat-app/chat.models.js";


import { canEmit, emitSocketEvent } from "../../socket/index.js";

const getSelectiveProfileInfo = async (req, res) => {
    try {
        // Extract token from headers
        const accessToken = req.headers['access-token'];
        const hasNewAccessToken = req.hasNewAccessToken;

        // Get userId and fields from request body
        const { userId, fields } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, "userId is required"));
        }

        const returnFollowerCount = fields.includes("followerCount");
        const returnFollowingCount = fields.includes("followingCount");

        const returnFollowersDetails = fields.includes("followers");
        const returnFollowingDetails = fields.includes("following");

        // Define sensitive fields that should always be excluded
        const sensitiveFields = ['password', 'refreshToken', 'emailVerificationToken', 'emailVerificationExpiry', 'forgotPasswordToken', 'forgotPasswordExpiry'];


        fields.push("blocklist"); // Ensure blocklist is always included in the fields to fetch


        // Prepare a string for .select() with fields to fetch
        let selectedFields = '';

        if (fields && Array.isArray(fields) && fields.length > 0) {
            // Join the requested fields into a space-separated string
            selectedFields = fields.join(' ');

            // Filter out any sensitive fields from the requested fields
            sensitiveFields.forEach(sensitiveField => {
                if (selectedFields.includes(sensitiveField)) {
                    selectedFields = selectedFields.replace(sensitiveField, '');
                }
            });
        } else {
            // If no fields are provided, exclude sensitive fields by default
            selectedFields = sensitiveFields.map(field => `-${field}`).join(' ');
        }

        // Fetch user info, including the selected fields but excluding sensitive fields
        const user = await User.findById(userId).lean().select(selectedFields);


        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        if (returnFollowerCount || returnFollowingCount || returnFollowersDetails || returnFollowingDetails) {
            // Count followers and following using lengths of the arrays from the original user object
            const originalUser = await User.findById(userId).populate('followers', 'name username avatar').populate('following', 'name username avatar').lean(); // Fetch original document to access followers/following


            if (returnFollowerCount) {
                user.followerCount = originalUser.followers ? originalUser.followers.length : 0;
            }

            if (returnFollowingCount) {
                user.followingCount = originalUser.following ? originalUser.following.length : 0;
            }

            if (returnFollowersDetails) {
                user.followers = originalUser.followers || [];
            }
            if (returnFollowingDetails) {
                user.following = originalUser.following || [];
            }
        }

        user.hasCurrentUserBlockedThem = req.user.blocklist && req.user.blocklist.map(id => id.toString()).includes(userId.toString());
        user.isCurrentUserBlockedByThem = user.blocklist && user.blocklist.map(id => id.toString()).includes(req.user._id.toString());



        // Return the selective profile info
        return res
            .status(200)
            .json(new ApiResponse(200, { user, ...(hasNewAccessToken ? { accessToken: accessToken } : {}) }, "Profile info fetched successfully"));
    } catch (error) {
        console.error("Error in getSelectiveProfileInfo:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};


const getProfileInfo = async (req, res) => {
    try {
        // Extract token from headers
        const accessToken = req.headers['access-token'];
        const hasNewAccessToken = req.hasNewAccessToken;

        // getting user id from request body
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, "userId is required"));
        }

        // Fetch user info from the database using userId
        let user = await User.findById(userId).lean().select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry'); // Exclude sensitive info

        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        // Count followers and following using lengths of the arrays from the original user object
        user.followerCount = user.followers ? user.followers.length : 0;
        user.followingCount = user.following ? user.following.length : 0;

        user.isFollowingTheUser = user.following.map(id => id.toString()).includes(req.user._id.toString());
        user.isUserFollowingHim = user.followers.map(id => id.toString()).includes(req.user._id.toString());


        delete user.followers;
        delete user.following;


        // user.friends = await getUserFriends(userId);


        // Check if the user's account is scheduled for deletion
        const scheduledDeletion = await ScheduledAccountDeletion.findOne({ user: userId }).lean();
        user.isScheduledForDeletion = scheduledDeletion ? scheduledDeletion.status === 'scheduled' : false;
        user.isAccountTerminated = user.account_termination_date ? new Date(user.account_termination_date) < new Date() : false;

        user.hasCurrentUserBlockedThem = req.user.blocklist && req.user.blocklist.map(id => id.toString()).includes(userId.toString());
        user.isCurrentUserBlockedByThem = user.blocklist && user.blocklist.map(id => id.toString()).includes(req.user._id.toString());

        return res
            .status(200)
            .json(new ApiResponse(200, {
                user, ...(hasNewAccessToken ? { accessToken: accessToken } : {})
            }, "Profile info fetched successfully"));
    } catch (error) {
        console.error("Error in getProfileInfo:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

const getProfilePosts = async (req, res) => {
    try {
        // Extract token from headers
        const accessToken = req.headers['access-token'];
        const hasNewAccessToken = req.hasNewAccessToken;

        // Getting userId from request body
        const { userId, limit = 10, skip = 0 } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, "userId is required"));
        }

        let user = await User.findById(userId).lean().select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry'); // Exclude sensitive info

        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        let isUserHisFriend = false;

        if (user.followers.map(id => id.toString()).includes(req.user._id.toString()) && user.following.map(id => id.toString()).includes(req.user._id.toString())) {
            isUserHisFriend = true;
        }


        const isOwnProfile = req.user._id.toString() === userId.toString();

        const privacyFilter = isOwnProfile
            ? { $in: ['public', undefined, 'friends', 'private'] } // Can view all their own posts
            : isUserHisFriend
                ? { $in: ['public', 'friends', undefined] } // Friends can see public and friends-only posts
                : { $in: ['public', undefined] }; // Others can only see public posts



        // Fetch user's posts from the database using userId
        const posts = await UserPost.find({
            user_id: userId,
            postPrivacy: privacyFilter
        })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(limit).populate({
                path: 'user_id', // The field to populate
                select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            }).populate({
                path: 'topics', // The field to populate
                select: 'name description' // Fields to select from the User model
            }).exec();

        if (!posts || posts.length === 0) {
            return res.status(404).json(new ApiResponse(404, {}, "No posts found for this user"));
        }

        // Prepare the response with numLikes and numComments
        const postPromises = posts.map(async (post) => {
            const postObject = post.toObject();
            postObject.user = postObject.user_id; // Add user info under user key
            delete postObject.user_id; // Remove user_id field

            // Count likes and comments
            const numLikes = await PostLike.countDocuments({ post_id: post._id });
            const numComments = await UserComment.countDocuments({ post_id: post._id });


            const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

            postObject.numLikes = numLikes; // Add numLikes to the post object
            postObject.numComments = numComments; // Add numComments to the post object

            postObject.hasUserLiked = !!hasUserLiked;

            // handling polls
            if (post.poll && Array.isArray(post.poll.options)) {
                postObject.poll.options = post.poll.options.map((option) => {
                    return {
                        _id: option._id,
                        option: option.option,
                        numVotes: option.votedBy.length,
                        isVotedByUser: option.votedBy.includes(req.user._id)
                    };
                });


            }

            postObject.type = "post";

            if (postObject.postPrivacy == null) {
                postObject.postPrivacy = "public";
            }




            return postObject;
        });


        const formattedPosts = await Promise.all(postPromises);

        return res
            .status(200)
            .json(new ApiResponse(200, { posts: formattedPosts, ...(hasNewAccessToken ? { accessToken: accessToken } : {}) }, "Profile posts fetched successfully"));
    } catch (error) {
        console.error("Error in getProfilePosts:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};


const getProfileBlogPosts = async (req, res) => {
    try {
        // Extract token from headers
        const accessToken = req.headers['access-token'];
        const hasNewAccessToken = req.hasNewAccessToken;

        // Getting userId from request body
        const { userId, limit = 10, skip = 0 } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, "userId is required"));
        }

        let user = await User.findById(userId).lean().select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry'); // Exclude sensitive info

        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        let isUserHisFriend = false;

        if (user.followers.map(id => id.toString()).includes(req.user._id.toString()) && user.following.map(id => id.toString()).includes(req.user._id.toString())) {
            isUserHisFriend = true;
        }


        const isOwnProfile = req.user._id.toString() === userId.toString();

        const privacyFilter = isOwnProfile
            ? { $in: ['public', undefined, 'friends', 'private'] } // Can view all their own posts
            : isUserHisFriend
                ? { $in: ['public', 'friends', undefined] } // Friends can see public and friends-only posts
                : { $in: ['public', undefined] }; // Others can only see public posts




        // Fetch user's posts from the database using userId
        const posts = await BlogPost.find({ user_id: userId, postPrivacy: privacyFilter })
            .sort({ createdAt: -1 })
            .skip(parseInt(skip))
            .limit(limit).populate({
                path: 'user_id', // The field to populate
                select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            }).populate({
                path: 'topics', // The field to populate
                select: 'name description' // Fields to select from the User model
            }).exec();

        if (!posts || posts.length === 0) {
            return res.status(404).json(new ApiResponse(404, {}, "No posts found for this user"));
        }

        // Prepare the response with numLikes and numComments
        const postPromises = posts.map(async (post) => {
            const postObject = post.toObject();
            postObject.user = postObject.user_id; // Add user info under user key
            delete postObject.user_id; // Remove user_id field

            // Count likes and comments
            const numLikes = await BlogPostLike.countDocuments({ post_id: post._id });
            const numComments = await BlogPostComment.countDocuments({ post_id: post._id });


            const hasUserLiked = await BlogPostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

            postObject.numLikes = numLikes; // Add numLikes to the post object
            postObject.numComments = numComments; // Add numComments to the post object

            postObject.hasUserLiked = !!hasUserLiked;

            postObject.type = "blog_post";


            if (postObject.postPrivacy == null) {
                postObject.postPrivacy = "public";
            }


            return postObject;
        });


        const formattedPosts = await Promise.all(postPromises);

        return res
            .status(200)
            .json(new ApiResponse(200, { posts: formattedPosts, ...(hasNewAccessToken ? { accessToken: accessToken } : {}) }, "Profile posts fetched successfully"));
    } catch (error) {
        console.error("Error in getProfilePosts:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const followUser = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { userId } = req.body; // User ID to follow

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, {}, "userId is required"));
        }

        // Check if the current user is trying to follow themselves
        if (currentUserId.toString() === userId) {
            return res.status(400).json(new ApiResponse(400, {}, "You cannot follow yourself"));
        }

        // Fetch the current user and the user to be followed
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json(new ApiResponse(404, {}, "User to follow not found"));
        }

        // Check if the current user is already following the target user
        if (currentUser.following.includes(userId)) {
            return res.status(400).json(new ApiResponse(400, {}, "You are already following this user"));
        }

        // Update the following array for the current user
        currentUser.following.push(userId);
        await currentUser.save();

        // Update the followers array for the target user
        targetUser.followers.push(currentUserId);
        await targetUser.save();

        return res.status(200).json(new ApiResponse(200, {}, "Successfully followed the user"));
    } catch (error) {
        console.error("Error in followUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

const unfollowUser = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { userId } = req.body; // User ID to unfollow

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, {}, "userId is required"));
        }

        // Check if the current user is trying to unfollow themselves
        if (currentUserId.toString() === userId) {
            return res.status(400).json(new ApiResponse(400, {}, "You cannot unfollow yourself"));
        }

        // Fetch the current user and the user to be unfollowed
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json(new ApiResponse(404, {}, "User to unfollow not found"));
        }

        // Check if the current user is not following the target user
        if (!currentUser.following.includes(userId) && !targetUser.followers.includes(currentUser._id)) {
            return res.status(400).json(new ApiResponse(400, {}, "You are not following this user"));
        }

        // Update the following array for the current user
        currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
        await currentUser.save();

        // Update the followers array for the target user
        targetUser.followers = targetUser.followers.filter(id => id.toString() !== currentUserId.toString());
        await targetUser.save();

        return res.status(200).json(new ApiResponse(200, {}, "Successfully unfollowed the user"));
    } catch (error) {
        console.error("Error in unfollowUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const blockUser = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { userId } = req.body; // User ID to unfollow

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, {}, "userId is required"));
        }

        // Check if the current user is trying to unfollow themselves
        if (currentUserId.toString() === userId) {
            return res.status(400).json(new ApiResponse(400, {}, "You cannot block yourself"));
        }

        // Fetch the current user and the user to be unfollowed
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json(new ApiResponse(404, {}, "User to block not found"));
        }

        // Check if the current user has already blocked the target user
        if (currentUser.blocklist.includes(userId)) {
            return res.status(400).json(new ApiResponse(400, {}, "You have already blocked this user"));
        }

        // Update the blocklist array for the current user
        currentUser.blocklist.push(userId);
        await currentUser.save();


        const chat = await Chat.findOne({
            isGroupChat: false,
            participants: { $all: [req.user._id, userId] },
            $expr: { $eq: [{ $size: "$participants" }, 2] },
        }).select("_id");


        if (chat) {
            emitSocketEvent(req, `${chat._id}/${userId.toString()}`, "THEY_BLOCKED_ME", { "who": currentUserId.toString() });
            emitSocketEvent(req, `${chat._id}/${req.user._id.toString()}`, "I_BLOCKED_THEM", { "who": userId.toString() });
        }

        return res.status(200).json(new ApiResponse(200, {}, "Successfully blocked the user"));
    } catch (error) {
        console.error("Error in blockUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const unblockUser = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Current user's ID from the request
        const { userId } = req.body; // User ID to unfollow

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, {}, "userId is required"));
        }

        // Check if the current user is trying to unfollow themselves
        if (currentUserId.toString() === userId) {
            return res.status(400).json(new ApiResponse(400, {}, "You cannot unblock yourself"));
        }

        // Fetch the current user and the user to be unfollowed
        const currentUser = await User.findById(currentUserId);
        const targetUser = await User.findById(userId);

        if (!targetUser) {
            return res.status(404).json(new ApiResponse(404, {}, "User to unblock not found"));
        }

        // Check if the current user has already blocked the target user
        if (!currentUser.blocklist.includes(userId)) {
            return res.status(400).json(new ApiResponse(400, {}, "This user is not blocked."));
        }

        // Update the blocklist array for the current user
        currentUser.blocklist = currentUser.blocklist.filter(id => id.toString() !== userId);
        await currentUser.save();


        const chat = await Chat.findOne({
            isGroupChat: false,
            participants: { $all: [req.user._id, userId] },
            $expr: { $eq: [{ $size: "$participants" }, 2] },
        }).select("_id");


        if (chat) {
            emitSocketEvent(req, `${chat._id}/${userId.toString()}`, "THEY_UNBLOCKED_ME", { "who": currentUserId.toString() });
            emitSocketEvent(req, `${chat._id}/${req.user._id.toString()}`, "I_UNBLOCKED_THEM", { "who": userId.toString() });
        }

        return res.status(200).json(new ApiResponse(200, {}, "Successfully unblocked the user"));
    } catch (error) {
        console.error("Error in unblockUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const getFriends = async (req, res) => {
    try {
        const { userId, limit = 15, skip = 0 } = req.body;


        const userFriends = await getUserFriends(userId, limit, skip);


        return res.status(200).json(new ApiResponse(200, { friends: userFriends }, "Successfully fetched user friends"));
    } catch (error) {
        console.error("Error in getFriends:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};


export { getProfileInfo, getSelectiveProfileInfo, getProfilePosts, getProfileBlogPosts, followUser, unfollowUser, blockUser, unblockUser, getFriends };