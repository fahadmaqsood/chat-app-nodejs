import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";


export const searchUsers = async (req, res) => {
    try {
        // Extract token from headers
        const accessToken = req.headers['access-token'];
        const hasNewAccessToken = req.hasNewAccessToken;

        // Get search fields from request body
        const { name, username, email, phone } = req.body;

        // Check if at least one search field is provided
        if (!name && !username && !email && !phone) {
            return res.status(400).json(new ApiResponse(400, "Nothing was provided to search"));
        }

        // Build the search criteria based on the provided fields
        const searchCriteria = { _id: { $ne: req.user._id } }; // Avoid logged-in user

        if (name) {
            searchCriteria.name = { $regex: new RegExp(name, 'i') }; // Case-insensitive regex search
        }
        if (username) {
            searchCriteria.username = { $regex: new RegExp(username, 'i') };
        }
        if (email) {
            searchCriteria.email = { $regex: new RegExp(email, 'i') };
        }
        if (phone) {
            searchCriteria.phone = { $regex: new RegExp(phone, 'i') };
        }

        // Perform the aggregation query
        const users = await User.aggregate([
            {
                $match: searchCriteria, // Match users based on search criteria
            },
            {
                $project: {
                    avatar: 1,
                    username: 1,
                    email: 1,
                },
            },
        ]);

        if (!users || users.length === 0) {
            return res.status(404).json(new ApiResponse(404, {}, "No users found"));
        }

        // Return the matched users
        return res
            .status(200)
            .json(new ApiResponse(200, { users, ...(hasNewAccessToken ? { accessToken: accessToken } : {}) }, "Users fetched successfully"));
    } catch (error) {
        console.error("Error in searchUsers:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

