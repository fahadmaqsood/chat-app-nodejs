import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import UserSchedule from "../../models/user-sessions/UserSchedule.js";
import mongoose from "mongoose";

// Schedule a session
const scheduleSession = async (req, res) => {
    try {
        const { title, description, participants, date, startTime, slots } = req.body;
        const currentUserId = req.user._id; // Get the current user from the request

        if (!date || !startTime || !slots) {
            return res.status(400).json(new ApiResponse(400, {}, "Date, startTime, and slots are required"));
        }

        // Create new session
        const newSession = new UserSchedule({
            title,
            description,
            participants: [...participants, currentUserId], // Include the current user as a participant
            date,
            startTime,
            slots,
            organizer: currentUserId
        });

        await newSession.save();

        return res.status(201).json(new ApiResponse(201, { session: newSession }, "Session scheduled successfully"));
    } catch (error) {
        console.error("Error in scheduleSession:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Get sessions for a specific date
const getSessionsByDate = async (req, res) => {
    try {
        const { date } = req.query; // Get the date from the query parameters
        const currentUserId = req.user._id; // Get the current user from the request

        if (!date) {
            return res.status(400).json(new ApiResponse(400, {}, "Date is required"));
        }

        // Fetch sessions for the given date
        const sessions = await UserSchedule.find({ date: new Date(date), organizer: currentUserId })
            .populate('participants', 'name username avatar email') // Populate participant details
            .lean();

        if (!sessions || sessions.length === 0) {
            return res.status(200).json(new ApiResponse(200, { sessions: [] }, "No sessions found for this date"));
        }

        return res.status(200).json(new ApiResponse(200, { sessions }, "Sessions fetched successfully"));
    } catch (error) {
        console.error("Error in getSessionsByDate:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const getSessionDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(new ApiResponse(400, {}, "sessionId is required"));
        }

        // Find the session by its ID and populate participant details
        const session = await UserSchedule.findById(sessionId)
            .populate('participants', 'name username email avatar')
            .populate('userId', 'name username email avatar') // Populate the creator's info
            .lean();

        if (!session) {
            return res.status(404).json(new ApiResponse(404, {}, "Session not found"));
        }

        return res.status(200).json(new ApiResponse(200, { session }, "Session details fetched successfully"));
    } catch (error) {
        console.error("Error in getSessionDetails:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred while fetching session details'));
    }
};

export { scheduleSession, getSessionsByDate, getSessionDetails };
