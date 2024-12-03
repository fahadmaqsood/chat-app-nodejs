import cookie from "cookie";
import jwt from "jsonwebtoken";
import { Server, Socket } from "socket.io";
import { AvailableChatEvents, ChatEventEnum } from "../constants.js";
import { User } from "../models/auth/user.models.js";
import { ApiError } from "../utils/ApiError.js";

import { emitCallsSocketEvent } from "../socket/calls.js";

import { emitIndicatorsSocketEvent } from "./indicators.js";

import { validateAndRefreshTokens } from "../controllers/auth/user.controllers.js";

/**
 * @description This function is responsible to allow user to join the chat represented by chatId (chatId). event happens when user switches between the chats
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountJoinChatEvent = (socket) => {
  socket.on(ChatEventEnum.JOIN_CHAT_EVENT, (chatId) => {
    console.log(`User joined the chat 🤝. chatId: `, chatId);
    // joining the room with the chatId will allow specific events to be fired where we don't bother about the users like typing events
    // E.g. When user types we don't want to emit that event to specific participant.
    // We want to just emit that to the chat where the typing is happening
    socket.join(chatId);
  });
};

/**
 * @description This function is responsible to emit the typing event to the other participants of the chat
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountParticipantTypingEvent = (socket) => {
  socket.on(ChatEventEnum.TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.TYPING_EVENT, chatId);
  });
};

/**
 * @description This function is responsible to emit the stopped typing event to the other participants of the chat
 * @param {Socket<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} socket
 */
const mountParticipantStoppedTypingEvent = (socket) => {
  socket.on(ChatEventEnum.STOP_TYPING_EVENT, (chatId) => {
    socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
  });
};

const mountSendCallEvent = (socket) => {
  socket.on(ChatEventEnum.CALL_EVENT, (roomId, chatId, participants, isVideoCall) => {
    // socket.in(chatId).emit(ChatEventEnum.STOP_TYPING_EVENT, chatId);
    console.log("Calling: ", participants, "isVideoCall: ", isVideoCall);

    for (let participant of participants) {
      emitCallsSocketEvent(participant, ChatEventEnum.CALL_EVENT, {
        chatId: chatId,
        callerName: socket.user.nameElseUsername,
        callerId: socket.user._id,
        isVideoCall: isVideoCall
      });
    }


  });
};

/**
 *
 * @param {Server<import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, import("socket.io/dist/typed-events").DefaultEventsMap, any>} io
 */
const initializeSocketIO = (io) => {
  return io.on("connection", async (socket) => {
    try {

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

      socket.user.nameElseUsername = (socket.user.name == null || socket.user.name == "") ? socket.user.username.trim() : socket.user.name.trim();

      // We are creating a room with user id so that if user is joined but does not have any active chat going on.
      // still we want to emit some socket events to the user.
      // so that the client can catch the event and show the notifications.
      socket.join(user._id.toString());
      socket.emit(ChatEventEnum.CONNECTED_EVENT); // emit the connected event so that client is aware
      console.log("User connected 🗼. userId: ", user._id.toString());

      // Common events that needs to be mounted on the initialization
      mountJoinChatEvent(socket);
      mountParticipantTypingEvent(socket);
      mountParticipantStoppedTypingEvent(socket);
      mountSendCallEvent(socket);

      socket.on(ChatEventEnum.DISCONNECT_EVENT, () => {
        console.log("user has disconnected 🚫. userId: " + socket.user?._id);
        if (socket.user?._id) {
          socket.leave(socket.user._id);
        }
      });
    } catch (error) {
      console.log(error);
      socket.emit(
        ChatEventEnum.SOCKET_ERROR_EVENT,
        error?.message || "Something went wrong while connecting to the socket."
      );
    }
  });
};

/**
 *
 * @param {import("express").Request} req - Request object to access the `io` instance set at the entry point
 * @param {string} roomId - Room where the event should be emitted
 * @param {AvailableChatEvents[0]} event - Event that should be emitted
 * @param {any} payload - Data that should be sent when emitting the event
 * @description Utility function responsible to abstract the logic of socket emission via the io instance
 */
const emitSocketEvent = (reqOrSocket, roomId, event, payload) => {
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
    io.of('/').in(roomId).emit(event, payload); // Ensure you are targeting the correct namespace
    console.log(`Event '${event}' emitted to room ${roomId}.`);
  } else {
    console.error("Socket.IO instance not found.");
  }
};

const canEmit = (reqOrSocket, roomId) => {
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
  return io;
}


export { initializeSocketIO, emitSocketEvent, canEmit };
