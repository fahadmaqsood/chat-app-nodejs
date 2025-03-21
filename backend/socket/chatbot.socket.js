import { Server, Socket } from 'socket.io';
import { emitSocketEvent } from './index.js'; // Import your socket utility
import { processChatMessage } from '../controllers/chatbot/chatbotController.js'; // Import your chatbot controller

import { ApiError } from "../utils/ApiError.js";

const userSocketMap = new Map(); // A simple map to store userId:subject -> socketId


/**
 * @description Handles socket events related to chatbot messages.
 * @param {Socket} socket - The socket instance.
 */
const handleChatbotSocketEvents = (socket, io) => {
    const handleChatMessageEvent = async (data) => {
        try {
            const { userId, message, subject } = data;

            // Find the socket ID for the user
            const socketId = userSocketMap.get(`${userId}:${subject}`);
            if (socketId) {
                // Process the message
                const { incomingMessage, outgoingMessage } = await processChatMessage({ socket: io.to(socketId), userId, message, subject });


                // Emit the event to the user's socket ID
                io.to(socketId).emit('CHAT_MESSAGE_TO_SERVER', incomingMessage);
                io.to(socketId).emit('CHAT_MESSAGE_FROM_SERVER', outgoingMessage);

                console.log(`data sent to ${userId}:${subject}`)
            } else {
                console.error(`No socket found for id: ${userId}:${subject}/${socketId}`);
            }
        } catch (error) {
            console.error('Error handling chat message:', error.message);
            socket.emit('CHAT_MESSAGE_ERROR', error.message);
        }
    };

    socket.on('CHAT_MESSAGE', handleChatMessageEvent);
};


/**
 * @description Initialize socket events related to the chatbot.
 * @param {Server} io - The socket.io server instance.
 */
const initializeChatbotSocket = (io) => {

    io.on('connection', (socket) => {
        console.log('Chatbot socket connected:', socket.id);

        // Pass io directly to handleChatbotSocketEvents
        handleChatbotSocketEvents(socket, io);

        socket.on('REGISTER_USER', (data) => {
            const { userId, subject } = data;
            // Store the mapping of userId to socket.id
            userSocketMap.set(`${userId}:${subject}`, socket.id);
            console.log(`Registered user: ${userId}:${subject} with socket ID: ${socket.id}`);
        });

        socket.on('disconnect', () => {
            // Optionally remove the user from the map on disconnect
            for (let [user_subject, id] of userSocketMap.entries()) {
                if (id === socket.id) {
                    userSocketMap.delete(user_subject);
                    console.log(`User ${user_subject} disconnected, removed from map.`);
                    break;
                }
            }
        });
    });
};


export { initializeChatbotSocket };
