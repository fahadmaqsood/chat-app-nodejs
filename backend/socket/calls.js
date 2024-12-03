import { Server, Socket } from 'socket.io';

import { User } from "../models/auth/user.models.js";
import { _getUnreadNotificationsCount, _changeNotificationsStatusToRead } from '../controllers/notification/notificationController.js';

import { validateAndRefreshTokens } from '../controllers/auth/user.controllers.js';

import { ApiError } from "../utils/ApiError.js";

import jwt from "jsonwebtoken";

const userSocketMap = new Map(); // A simple map to store userId -> socketId


let InputOutput;


/**
 * @description Initialize socket events related to the chatbot.
 * @param {Server} io - The socket.io server instance.
 */
const initializeCallsSocket = (io) => {

    InputOutput = io;

    io.on('connection', async (socket) => {
        console.log('Calls socket connected:', socket.id);


        console.log(socket.handshake);

        let firebaseToken = socket.handshake.auth?.firebaseToken;

        if (!firebaseToken) {
            throw new ApiError(401, "Un-authorized handshake. Token(s) are missing");
        }

        const user = await User.findOne({
            firebaseToken: firebaseToken // Check if any user has this firebaseToken
        }).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
        );

        // retrieve the user
        if (!user) {
            throw new ApiError(401, "Un-authorized handshake. Token is invalid");
        }
        socket.user = user; // mount the user object to the socket


        userSocketMap.set(`${socket.user._id.toString()}`, socket.id);



        socket.join(socket.user._id.toString());

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



const emitCallsSocketEvent = (user_id, event, payload) => {
    user_id = user_id.toString();

    // Emit event if io is available
    if (InputOutput) {
        InputOutput.of('/').in(user_id).emit(event, payload); // Ensure you are targeting the correct namespace
        console.log(`Event '${event}' emitted to user ${user_id}.`);
    } else {
        console.log("Socket.IO instance not found.");
    }
};


const isAppOpenForUser = (user_id) => {
    user_id = user_id.toString();

    return userSocketMap.get(user_id) !== undefined;
}


export { initializeCallsSocket, isAppOpenForUser, emitCallsSocketEvent };
