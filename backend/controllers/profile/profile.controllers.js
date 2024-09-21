import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import UserPost from '../../models/social/UserPost.js';


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


        // Define sensitive fields that should always be excluded
        const sensitiveFields = ['password', 'refreshToken', 'emailVerificationToken', 'emailVerificationExpiry', 'forgotPasswordToken', 'forgotPasswordExpiry'];

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

        console.log(selectedFields);

        // Fetch user info, including the selected fields but excluding sensitive fields
        const user = await User.findById(userId).lean().select(selectedFields);

        console.log(user);


        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        if (returnFollowerCount || returnFollowingCount) {
            // Count followers and following using lengths of the arrays from the original user object
            const originalUser = await User.findById(userId).lean(); // Fetch original document to access followers/following

            if (returnFollowerCount) {
                user.followerCount = originalUser.followers ? originalUser.followers.length : 0;
            }

            if (returnFollowingCount) {
                user.followingCount = originalUser.following ? originalUser.following.length : 0;
            }
        }


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

        delete user.followers;
        delete user.following;


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
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(400, "userId is required"));
        }

        // Fetch user's posts from the database using userId
        const posts = await UserPost.find({ user_id: userId });

        if (!posts || posts.length === 0) {
            return res.status(404).json(new ApiResponse(404, {}, "No posts found for this user"));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, { posts, ...(hasNewAccessToken ? { accessToken: accessToken } : {}) }, "Profile posts fetched successfully"));
    } catch (error) {
        console.error("Error in getProfilePosts:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

export { getProfileInfo, getSelectiveProfileInfo, getProfilePosts };