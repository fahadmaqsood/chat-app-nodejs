import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { emitSocketEvent } from "../../socket/chatbot.socket.js"; // Import your socket utility
import ChatBot from "../../models/chatbot/chatbot.models.js";
import { User } from "../../models/auth/user.models.js";
import { getChatCompletion } from "../../utils/openai.js"; // Assuming you have an OpenAI utility

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

// Controller for handling chatbot messages
export const handleChatMessage = asyncHandler(async (req, res) => {
    const { userId, message, subject } = req.body;

    if (!message || !subject) {
        throw new ApiError(400, "Message and subject are required");
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

    // Send context to OpenAI API
    // const openAIResponse = await getChatCompletion({
    //     messages: similarMessages.map(msg => ({ role: msg.type, content: msg.message })),
    //     user_message: message,
    // });

    const openAIResponse = { data: "this is test response" };

    // Save outgoing response
    const outgoingMessage = await ChatBot.create({
        user: new mongoose.Types.ObjectId(userId),
        message: openAIResponse.data,
        type: 'chatbot',
        subject,
    });

    // Emit socket event for incoming and outgoing messages
    emitSocketEvent(req, userId.toString(), 'CHAT_MESSAGE_RECEIVED', incomingMessage);
    emitSocketEvent(req, userId.toString(), 'CHAT_MESSAGE_SENT', outgoingMessage);

    return res.status(201).json(new ApiResponse(201, { incomingMessage, outgoingMessage }, "Chat message processed successfully"));
});
