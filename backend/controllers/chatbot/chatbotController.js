import mongoose from "mongoose";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { emitSocketEvent } from '../../socket/index.js';
// import { emitSocketEvent } from "../../socket/chatbot.socket.js"; // Import your socket utility
import ChatBot from "../../models/chatbot/chatbot.models.js";
// import { User } from "../../models/auth/user.models.js";
import { getChatCompletion, generateImagesFromText } from "../../utils/openai.js";

import { _decreaseUserPoints } from "../auth/user.controllers.js";

import { Prices } from "../../settings/prices/prices.js";


import fs from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames


// If using ES modules, resolve __dirname manually
const __filename = fileURLToPath(import.meta.url); // Get the current file path
const __dirname = path.dirname(__filename); // Get the directory name

console.log(__dirname);



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
        .limit(Number(limit || 5))
        .exec();

    return res.status(200).json(new ApiResponse(200, messages, "Messages fetched successfully"));
});


// core logic for processing message
export const processChatMessage = async ({ socket, userId, message, subject }) => {
    if (!userId || !message || !subject) {
        throw new Error("userId, message, and subject are required");
    }

    const instructionMessage = {
        role: 'system',
        content: `You are now part of a social media app for teenagers. Your name is nerd. You know everything about subject:"${subject}" and everything related to it. however you won't know things about other subjects and you will refer to user to other nerds saying like you should ask it to the other nerd. you act and behave like a human. you are not allowed to say you are a computer or you don't have feelings.`
    };

    const recentMessages = await ChatBot.find({
        user: userId,
        subject: subject
    })
        .sort({ createdAt: -1 })
        .skip(Number(0))
        .limit(Number(5))
        .exec();

    // Save incoming message
    const incomingMessage = await ChatBot.create({
        user: userId,
        message,
        type: 'user',
        subject,
    });

    // Get similar messages for context
    // const similarMessages = await getSimilarMessages(message, subject);


    // Prepare messages for OpenAI API call
    const chatMessages = recentMessages.map((msg) => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.message,
    }));

    // Get response from OpenAI API
    let openAIResponse;

    socket.emit('CHATBOT_IS_TYPING', "true");

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...chatMessages],
            user_message: message,
        });

        socket.emit('CHATBOT_IS_TYPING', "false");
    } catch (e) {

        socket.emit('CHATBOT_IS_TYPING', "false");
        throw new ApiResponse(500, {}, e.message);
    }

    // Save outgoing response
    const outgoingMessage = await ChatBot.create({
        user: new mongoose.Types.ObjectId(userId),
        message: openAIResponse,
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
        emitSocketEvent(req, `${userId.toString()}:${subject}`, 'CHAT_MESSAGE_TO_SERVER', incomingMessage);
        emitSocketEvent(req, `${userId.toString()}:${subject}`, 'CHAT_MESSAGE_FROM_SERVER', outgoingMessage);

        // Return the response
        return res.status(201).json(new ApiResponse(201, { incomingMessage, outgoingMessage }, "Chat message processed successfully"));
    } catch (error) {
        console.error('Error in handleChatMessage:', error);
        res.status(500).json({ error: error.message });
    }
});




export const handleGenerativeAiImages = async (req, res) => {

    const { description } = req.query;


    if (!description) {
        return res.status(404).json(new ApiResponse(404, {}, "Description is required."));
    }

    if (req.user.user_points - Prices.GENERATE_AI_ART_PRICE < 0) {
        return res.status(402).json(new ApiResponse(402, {}, "User doesn't have enough coins to use this feature"));
    }

    try {


        const imageUrls = await generateImagesFromText({ description });

        // Download and save images locally
        const localImagePaths = await Promise.all(
            imageUrls.map(async (imageUrl) => {
                const imageName = `${uuidv4()}.jpg`; // Generate a unique name for each image
                const imagePath = path.join(__dirname, '..', '..', 'public', 'generated-images', imageName); // Save path

                const writer = fs.createWriteStream(imagePath); // Create a stream to save the image

                // Download image using axios and pipe to local file
                const response = await axios({
                    url: imageUrl,
                    method: 'GET',
                    responseType: 'stream',
                });

                response.data.pipe(writer);

                // Return a promise that resolves when the image is fully written
                return new Promise((resolve, reject) => {
                    writer.on('finish', () => resolve(`/generated-images/${imageName}`)); // Resolve with the local URL
                    writer.on('error', reject);
                });
            })
        );

        _decreaseUserPoints(req.user._id, req.user.user_points, Prices.GENERATE_AI_ART_PRICE);

        return res.status(200).json(new ApiResponse(200, { images: localImagePaths }, "Images generated successfully"));


    } catch (err) {
        console.error('Error in handleGenerativeAiImages:', err);
        res.status(500).json(new ApiResponse(500, {}, err.message));

    }
}








export const handleMathSolvingSteps = async (req, res) => {

    const { method, problem, solution } = req.body;


    if (!problem || !solution || !method) {
        return res.status(404).json(new ApiResponse(404, {}, "Method, problem, and solution are required."));
    }

    try {

        const instructionMessage = {
            role: "system",
            content: "I will give you a math problem, its solution and the method with which you will solve the problem. I want you to answer as a json string with fields problem_solution_description and array of steps with fields: step name (the method by which you are solving, or what formula you used?), step description (why was this step necessary?), result (the result of operation), resultant_equation (the equation or the total result we get after this operation). Reply with only json, nothing else and that json should be valid."
        };



        // Get response from OpenAI API
        let openAIResponse;

        try {
            openAIResponse = await getChatCompletion({
                messages: [instructionMessage],
                user_message: `Problem: ${problem}\nMethod of Solution: ${method}\nSolution: ${solution}`,
            });

            openAIResponse = JSON.parse(openAIResponse);
        } catch (e) {
            throw new ApiResponse(500, {}, e.message);
        }


        return res.status(200).json(new ApiResponse(200, { steps: openAIResponse }, "Steps generated successfully."));


    } catch (err) {
        console.error('Error in handleGenerativeAiImages:', err);
        res.status(500).json(new ApiResponse(500, {}, err.message));

    }
}