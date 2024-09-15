import { Server, Socket } from 'socket.io';
import { emitSocketEvent } from './index.js'; // Import your socket utility
import { handleChatMessage } from '../controllers/chatbot/chatbotController.js'; // Import your chatbot controller

/**
 * @description Handles socket events related to chatbot messages.
 * @param {Socket} socket - The socket instance.
 */
const handleChatbotSocketEvents = (socket) => {
    /**
     * @description Handles incoming chat messages and emits relevant events.
     * @param {Object} data - The data object containing userId, message, and subject.
     */
    const handleChatMessageEvent = async (data) => {
        try {
            const { userId, message, subject } = data;

            // Process the message
            const { incomingMessage, outgoingMessage } = await processChatMessage({ userId, message, subject });

            // Emit the relevant socket events
            emitSocketEvent(socket.request, userId.toString(), 'CHAT_MESSAGE_RECEIVED', incomingMessage);
            emitSocketEvent(socket.request, userId.toString(), 'CHAT_MESSAGE_SENT', outgoingMessage);
        } catch (error) {
            console.error('Error handling chat message:', error.message);
            socket.emit('CHAT_MESSAGE_ERROR', error.message);
        }
    };


    // Event listener for chat messages
    socket.on('CHAT_MESSAGE', handleChatMessageEvent);
};

/**
 * @description Initialize socket events related to the chatbot.
 * @param {Server} io - The socket.io server instance.
 */
const initializeChatbotSocket = (io) => {
    io.on('connection', (socket) => {
        console.log('Chatbot socket connected:', socket.id);

        // Initialize chatbot-related socket events
        handleChatbotSocketEvents(socket);

        socket.on('disconnect', () => {
            console.log('Chatbot socket disconnected:', socket.id);
        });
    });
};

export { initializeChatbotSocket };
