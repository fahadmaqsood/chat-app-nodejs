import { Server, Socket } from 'socket.io';

import { User } from "../models/auth/user.models.js";
import { _getUnreadNotificationsCount, _changeNotificationsStatusToRead } from '../controllers/notification/notificationController.js';

const userSocketMap = new Map(); // A simple map to store userId -> socketId


/**
 * @description Handles socket events related to chatbot messages.
 * @param {Socket} socket - The socket instance.
 */
const handleIndicatorsSocketEvents = async (socket, io) => {
    // const handleReadMessagesEvent = async (data) => {
    //     try {
    //         // Find the socket ID for the user
    //         const socketId = userSocketMap.get(`${socket.user._id}`);
    //         if (socketId) {
    //             // Emit the event to the user's socket ID
    //             io.to(socketId).emit('CHAT_MESSAGE_TO_SERVER', incomingMessage);
    //             io.to(socketId).emit('CHAT_MESSAGE_FROM_SERVER', outgoingMessage);

    //             console.log(`data sent to ${socket.user._id}`)
    //         } else {
    //             console.error(`No socket found for id: ${socket.user._id}`);
    //         }
    //     } catch (error) {
    //         console.error('Error handling read message event:', error.message);
    //         // socket.emit('CHAT_MESSAGE_ERROR', error.message);
    //     }
    // };

    notificationsCount = await _getUnreadNotificationsCount(socket.user._id);
    if (notificationsCount != false) {
        emitIndicatorsSocketEvent(socket, socket.user._id, "INITIAL_NOTIFICATIONS_COUNT_EVENT", notificationsCount);
    }


    const handleReadNotificationsEvent = async (data) => {
        try {
            await _changeNotificationsStatusToRead(socket.user._id);
        } catch (error) {
            console.error('Error handling read notifications event:', error.message);
        }
    };

    // socket.on('READ_MESSAGES', handleReadMessagesEvent);
    socket.on('READ_NOTIFICATION_EVENT', handleReadNotificationsEvent);
};


/**
 * @description Initialize socket events related to the chatbot.
 * @param {Server} io - The socket.io server instance.
 */
const initializeIndicatorsSocket = (io) => {

    io.on('connection', async (socket) => {
        console.log('Chatbot socket connected:', socket.id);


        // If there is no access token in cookies. Check inside the handshake auth
        let accessToken = socket.handshake.auth?.accessToken;
        let refreshToken = socket.handshake.auth?.refreshToken;


        if (!accessToken || !refreshToken) {
            // Token is required for the socket to work
            throw new ApiError(401, "Un-authorized handshake. Token(s) are missing");
        }

        const tokenResponse = await validateAndRefreshTokens(accessToken, refreshToken);
        let newAccessToken = tokenResponse?.accessToken;

        // Decode access token to get user ID
        const decodedToken = jwt.decode(newAccessToken || accessToken);
        const userId = decodedToken._id;

        const user = await User.findById(userId).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
        );

        // retrieve the user
        if (!user) {
            throw new ApiError(401, "Un-authorized handshake. Token is invalid");
        }
        socket.user = user; // mount the user object to the socket


        userSocketMap.set(`${socket.user._id}`, socket.id);


        // Pass io directly to handleChatbotSocketEvents
        handleIndicatorsSocketEvents(socket, io);

        // socket.on('USER_OPENED_APP', (data) => {
        //     // Store the mapping of userId to socket.id
        //     userSocketMap.set(`${userId}:${subject}`, socket.id);
        //     console.log(`Registered user: ${userId}:${subject} with socket ID: ${socket.id}`);
        // });

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



const emitIndicatorsSocketEvent = (reqOrSocket, user_id, event, payload) => {
    let io;

    // Check if reqOrSocket is an HTTP request with app instance
    if (reqOrSocket.app) {
        io = reqOrSocket.app.get("io");
    }
    // Check if reqOrSocket is a Socket.IO server instance
    else if (reqOrSocket instanceof Server) {
        io = reqOrSocket;
    }
    // Check if reqOrSocket is a Socket.IO instance with server property
    else if (reqOrSocket.server && reqOrSocket.server instanceof Server) {
        io = reqOrSocket.server;
    }

    // Emit event if io is available
    if (io) {
        io.of('/').in(user_id).emit(event, payload); // Ensure you are targeting the correct namespace
        console.log(`Event '${event}' emitted to user ${user_id}.`);
    } else {
        console.error("Socket.IO instance not found.");
    }
};


const isAppOpenForUser = (user_id) => {
    return userSocketMap.get(user_id) !== undefined;
}


export { initializeIndicatorsSocket, isAppOpenForUser, emitIndicatorsSocketEvent };
