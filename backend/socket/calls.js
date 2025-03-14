import { Server, Socket } from 'socket.io';

import { User } from "../models/auth/user.models.js";
import { _getUnreadNotificationsCount, _changeNotificationsStatusToRead } from '../controllers/notification/notificationController.js';

import { AvailableChatEvents, ChatEventEnum } from "../constants.js";

import { emitSocketEvent } from "./index.js";

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
                    console.log(`User ${user_subject} disconnected from call service, removed from map.`);
                    break;
                }
            }
        });

        socket.on(ChatEventEnum.INCOMING_CALL_ACCEPTED_EVENT, (roomId, chatId, callerId, isVideoCall) => {
            // socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
            console.log("Call accepted: ", chatId, "isVideoCall: ", isVideoCall);


            emitSocketEvent(null, roomId, ChatEventEnum.OUTGOING_CALL_ACCEPTED_EVENT, {
                chatId: chatId,
                callerId: callerId,
                isVideoCall: isVideoCall
            });



        });


        socket.on(ChatEventEnum.INCOMING_CALL_DECLINED_EVENT, (roomId, chatId, callerId, isVideoCall) => {
            // socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
            console.log("Call DECLINED: ", chatId, "isVideoCall: ", isVideoCall);


            emitSocketEvent(null, roomId, ChatEventEnum.OUTGOING_CALL_DECLINED_EVENT, {
                chatId: chatId,
                callerId: callerId,
                isVideoCall: isVideoCall
            });
        });


        socket.on(ChatEventEnum.INCOMING_CALL_RINGING_EVENT, (roomId, chatId, callerId, isVideoCall) => {
            // socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
            console.log("Call DECLINED: ", chatId, "isVideoCall: ", isVideoCall);


            emitSocketEvent(null, roomId, ChatEventEnum.OUTGOING_CALL_RINGING_EVENT, {
                chatId: chatId,
                callerId: callerId,
                isVideoCall: isVideoCall
            });
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


const canEmit = (roomId) => {
    if (InputOutput) {
        // Check if there are any clients connected to the room
        const clientsInRoom = InputOutput.of('/').adapter.rooms.get(roomId);

        if (clientsInRoom && clientsInRoom.size > 0) {
            console.log(`Room ${roomId} has clients. Emission possible.`);
            return true;
        } else {
            console.log(`Room ${roomId} does not have any clients or does not exist.`);
            return false;
        }
    }

    return false;
}

export { initializeCallsSocket, canEmit, emitCallsSocketEvent };
