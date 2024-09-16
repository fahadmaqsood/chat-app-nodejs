import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { validateAndRefreshTokens } from '../auth/user.controllers.js';

const getProfileInfo = async (req, res) => {
    try {
        // Extract tokens from headers
        const accessToken = req.headers['access-token'];
        const refreshToken = req.headers['refresh-token'];



        // Validate and refresh tokens
        const tokenResponse = await validateAndRefreshTokens(accessToken, refreshToken);
        let newAccessToken = tokenResponse?.accessToken;

        let hasNewAccessToken = true;

        if (!newAccessToken) {
            hasNewAccessToken = false;
            newAccessToken = accessToken;
        }

        // getting user id from request body
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json(ApiResponse(false, "userId is required"));
        }

        // Fetch user info from the database using userId
        const user = await User.findById(userId).select('-password -refreshToken -emailVerificationToken -emailVerificationExpiry -loginType -forgotPasswordToken -forgotPasswordExpiry'); // Exclude sensitive info

        if (!user) {
            return res.status(404).json(ApiResponse(404, {}, "User not found"));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, { user, ...(hasNewAccessToken ? { accessToken: newAccessToken } : {}) }, "Profile info fetched successfully"));
    } catch (err) {
        console.error("Error in getProfileInfo:", err);
        res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

const getProfilePosts = async (req, res) => {
    try {
        // Extract tokens from headers
        const accessToken = req.headers['access-token'];
        const refreshToken = req.headers['refresh-token'];

        // Validate and refresh tokens
        const tokenResponse = await validateAndRefreshTokens(accessToken, refreshToken);
        let newAccessToken = tokenResponse?.accessToken;

        let hasNewAccessToken = true;

        if (!newAccessToken) {
            hasNewAccessToken = false;
            newAccessToken = accessToken;
        }

        // Getting userId from request body
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json(ApiResponse(false, "userId is required"));
        }

        // Fetch user's posts from the database using userId
        const posts = await UserPost.find({ user_id: userId });

        if (!posts || posts.length === 0) {
            return res.status(404).json(ApiResponse(404, {}, "No posts found for this user"));
        }

        return res
            .status(200)
            .json(new ApiResponse(200, { posts, ...(hasNewAccessToken ? { accessToken: newAccessToken } : {}) }, "Profile posts fetched successfully"));
    } catch (err) {
        console.error("Error in getProfilePosts:", err);
        res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

export { getProfileInfo, getProfilePosts };