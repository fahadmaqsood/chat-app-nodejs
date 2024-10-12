import jwt from 'jsonwebtoken';
import { User } from '../../models/auth/user.models.js';
import { ApiError } from '../../utils/ApiError.js';
import { ApiResponse } from '../../utils/ApiResponse.js'; // Import ApiResponse for consistent response format
import { validateAndRefreshTokens } from '../auth/user.controllers.js'; // Adjust the path as needed

// Function to change profile settings
const changeProfileSettings = async (req, res) => {
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

        // Decode access token to get user ID
        const decodedToken = jwt.decode(newAccessToken);
        const userId = decodedToken._id;

        // Extract user data from request
        const { name, username, about, email, country, language, religion } = req.body;

        // Check if email or username already exists
        const existingEmail = await User.findOne({ email });
        const existingUsername = await User.findOne({ username });

        if (existingEmail && existingEmail._id.toString() !== userId.toString()) {
            throw new ApiError(400, 'Email already exists');
        }

        if (existingUsername && existingUsername._id.toString() !== userId.toString()) {
            throw new ApiError(400, 'Username already exists');
        }

        // Update profile settings
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        user.name = name || user.name;
        user.username = username || user.username;
        user.email = email || user.email;
        user.about = about || user.about;
        user.country = country || user.country;
        user.language = language || user.language;
        user.religion = religion || user.religion;

        await user.save();

        // Return success response with the new access token
        res.status(200).json(new ApiResponse(200, hasNewAccessToken ? { accessToken: newAccessToken } : {}, 'Profile updated successfully'));

    } catch (error) {
        res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Function to update privacy settings
const updatePrivacySettings = async (req, res) => {
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

        // Decode access token to get user ID
        const decodedToken = jwt.decode(newAccessToken);
        const userId = decodedToken._id;

        // Extract privacy settings from request
        const { viewFollowers, viewFollowing, viewCloseFriends } = req.body;

        // Validate privacy settings
        const validOptions = ['everyone', 'no one', 'close friends'];
        if (![viewFollowers, viewFollowing, viewCloseFriends].every(opt => validOptions.includes(opt))) {
            throw new ApiError(400, 'Invalid privacy settings');
        }

        // Update privacy settings
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        user.privacySettings = {
            viewFollowers,
            viewFollowing,
            viewCloseFriends
        };

        await user.save();

        // Return success response with the new access token
        res.status(200).json(new ApiResponse(200, hasNewAccessToken ? { accessToken: newAccessToken } : {}, 'Privacy settings updated successfully'));

    } catch (error) {
        res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Function to update notification settings
const updateNotificationSettings = async (req, res) => {
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

        // Decode access token to get user ID
        const decodedAccessToken = jwt.decode(newAccessToken);
        const userId = decodedAccessToken._id;

        // Extract notification settings from request
        const { marketing, updates } = req.body;
        const { appUpdates, billReminder, promotionEmails, tips, offers } = marketing;
        const { messages, friendRequests, commentsOnPosts, likes } = updates;

        // Find user by ID
        const user = await User.findById(userId);
        if (!user) {
            throw new ApiError(404, 'User not found');
        }

        // Update notification settings
        user.notificationSettings = {
            marketing: { appUpdates, promotionEmails, tips, offers },
            updates: { messages, friendRequests, commentsOnPosts, likes, billReminder }
        };

        // Save user with updated settings
        await user.save();

        // Return success response
        res.status(200).json(new ApiResponse(200, hasNewAccessToken ? { accessToken: newAccessToken } : {}, 'Notification settings updated successfully'));

    } catch (error) {
        res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

export { changeProfileSettings, updatePrivacySettings, updateNotificationSettings };
