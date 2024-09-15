import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { emitSocketEvent } from '../../socket/index.js';
// import { emitSocketEvent } from "../../socket/chatbot.socket.js"; // Import your socket utility
import ChatBot from "../../models/chatbot/chatbot.models.js";
// import { User } from "../../models/auth/user.models.js";
// import { getChatCompletion } from "../../utils/openai.js"; // Assuming you have an OpenAI utility

// Function to get similar messages for context
const getSimilarMessages = async (message, subject) => {
    return ChatBot.find({
        subject,
        message: { $regex: message, $options: 'i' },
    }).exec();
};

// Function to get recent messages with pagination
export const getRecentMessages = asyncHandler(async (req, res) => {
    const { userId, subject, limit, skip } = req.body;

    if (!userId || !subject) {
        throw new ApiError(400, "User ID and subject are required");
    }

    const messages = await ChatBot.find({
        user: userId,
        subject: subject
    })
        .sort({ createdAt: -1 })
        .skip(Number(skip || 0))
        .limit(Number(limit || 15))
        .exec();

    return res.status(200).json(new ApiResponse(200, messages, "Messages fetched successfully"));
});


// core logic for processing message
export const processChatMessage = async ({ userId, message, subject }) => {
    if (!userId || !message || !subject) {
        throw new Error("userId, message, and subject are required");
    }

    // Save incoming message
    const incomingMessage = await ChatBot.create({
        user: userId,
        message,
        type: 'user',
        subject,
    });

    // Get similar messages for context
    const similarMessages = await getSimilarMessages(message, subject);

    // Simulating OpenAI API call
    const openAIResponse = { data: "this is a test response" };

    // Save outgoing response
    const outgoingMessage = await ChatBot.create({
        user: new mongoose.Types.ObjectId(userId),
        message: openAIResponse.data,
        type: 'chatbot',
        subject,
    });

    return { incomingMessage, outgoingMessage };
};


// Controller for handling chatbot messages
export const handleChatMessage = asyncHandler(async (req, res) => {
    try {
        const { userId, message, subject } = req.body;

        // Process the message
        const { incomingMessage, outgoingMessage } = await processChatMessage({ userId, message, subject });

        // Emit the relevant socket events, passing io directly
        emitSocketEvent(req, userId.toString(), 'CHAT_MESSAGE_RECEIVED', incomingMessage);
        emitSocketEvent(req, userId.toString(), 'CHAT_MESSAGE_SENT', outgoingMessage);

        // Return the response
        return res.status(201).json(new ApiResponse(201, { incomingMessage, outgoingMessage }, "Chat message processed successfully"));
    } catch (error) {
        console.error('Error in handleChatMessage:', error);
        res.status(500).json({ error: error.message });
    }
});

