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





export const sendCloseFriendRequest = async (req, res) => {
    try {
        const senderId = req.user._id; // Current user ID
        const { receiverId } = req.body; // ID of the user to send the request to

        if (!receiverId) {
            return res.status(400).json(new ApiResponse(400, "Receiver ID is required"));
        }

        const receiver = await User.findById(receiverId);
        if (!receiver) {
            return res.status(404).json(new ApiResponse(404, {}, "Receiver not found"));
        }

        if (receiver.closeFriendRequests.includes(senderId)) {
            return res.status(400).json(new ApiResponse(400, "Close friend request already sent"));
        }

        // Add the sender to the receiver's close friend requests
        receiver.closeFriendRequests.push(senderId);
        await receiver.save();

        // Add the receiver to the sender's sent requests
        const sender = await User.findById(senderId);
        sender.sentCloseFriendRequests.push(receiverId);
        await sender.save();

        return res.status(200).json(new ApiResponse(200, {}, "Close friend request sent"));
    } catch (error) {
        console.error("Error in sendCloseFriendRequest:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred'));
    }
};


export const getCloseFriendRequests = async (req, res) => {
    try {
        const userId = req.user._id; // Current user ID

        // Fetch the user and populate the close friend requests with relevant user details
        const user = await User.findById(userId)
            .populate('closeFriendRequests', 'name username avatar') // Fetch specific fields from the requested users
            .lean(); // Convert the document to a plain JavaScript object

        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        return res.status(200).json(new ApiResponse(200, { closeFriendRequests: user.closeFriendRequests }, "Close friend requests fetched successfully"));
    } catch (error) {
        console.error("Error in getCloseFriendRequests:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred'));
    }
};


export const getSentCloseFriendRequests = async (req, res) => {
    try {
        const userId = req.user._id; // Current user ID

        const user = await User.findById(userId).populate('sentCloseFriendRequests', 'name username avatar').lean();
        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        const sentRequests = user.sentCloseFriendRequests;

        return res.status(200).json(new ApiResponse(200, { sentRequests }, "Sent close friend requests fetched successfully"));
    } catch (error) {
        console.error("Error in getSentCloseFriendRequests:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred'));
    }
};




export const rejectCloseFriendRequest = async (req, res) => {
    try {
        const receiverId = req.user._id; // Current user ID
        const { senderId } = req.body; // ID of the user whose request is being rejected

        if (!senderId) {
            return res.status(400).json(new ApiResponse(400, "Sender ID is required"));
        }

        const receiver = await User.findById(receiverId);
        const sender = await User.findById(senderId);

        if (!receiver || !sender) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        // Check if the request exists
        if (!receiver.closeFriendRequests.includes(senderId)) {
            return res.status(400).json(new ApiResponse(400, "No close friend request from this user"));
        }

        // Remove sender from receiver's close friend requests
        receiver.closeFriendRequests.pull(senderId);
        await receiver.save();

        // Remove receiver from sender's sent requests
        sender.sentCloseFriendRequests.pull(receiverId);
        await sender.save();

        return res.status(200).json(new ApiResponse(200, {}, "Close friend request rejected"));
    } catch (error) {
        console.error("Error in rejectCloseFriendRequest:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred'));
    }
};



export const acceptCloseFriendRequest = async (req, res) => {
    try {
        const receiverId = req.user._id; // Current user ID
        const { senderId } = req.body; // ID of the user whose request is being accepted

        if (!senderId) {
            return res.status(400).json(new ApiResponse(400, "Sender ID is required"));
        }

        const receiver = await User.findById(receiverId);
        const sender = await User.findById(senderId);

        if (!receiver || !sender) {
            return res.status(404).json(new ApiResponse(404, {}, "User not found"));
        }

        // Check if the request exists
        if (!receiver.closeFriendRequests.includes(senderId)) {
            return res.status(400).json(new ApiResponse(400, "No close friend request from this user"));
        }

        // Add sender to receiver's close friends
        receiver.closeFriends.push(senderId);
        await receiver.save();

        // Remove sender from receiver's close friend requests
        receiver.closeFriendRequests.pull(senderId);
        await receiver.save();

        // Remove receiver from sender's sent requests
        sender.sentCloseFriendRequests.pull(receiverId);
        await sender.save();

        return res.status(200).json(new ApiResponse(200, {}, "Close friend request accepted"));
    } catch (error) {
        console.error("Error in acceptCloseFriendRequest:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred'));
    }
};
