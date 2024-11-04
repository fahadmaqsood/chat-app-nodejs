import mongoose from "mongoose";
import { ChatEventEnum } from "../../constants.js";
import { Chat } from "../../models/chat-app/chat.models.js";
import { ChatMessage } from "../../models/chat-app/message.models.js";
import { emitSocketEvent, canEmit } from "../../socket/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

import { User } from '../../models/auth/user.models.js';

import { sendNotification } from "../notification/notificationController.js";

import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "../../utils/helpers.js";

/**
 * @description Utility function which returns the pipeline stages to structure the chat message schema with common lookups
 * @returns {mongoose.PipelineStage[]}
 */
const chatMessageCommonAggregation = () => {
  return [
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "sender",
        as: "sender",
        pipeline: [
          {
            $project: {
              username: 1,
              avatar: 1,
              email: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        sender: { $first: "$sender" },
      },
    },
  ];
};

const getAllMessages = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { limit, skip } = req.query;

  console.log(req.params, req.query);

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  // Only send messages if the logged in user is a part of the chat he is requesting messages of
  if (!selectedChat.participants?.includes(req.user?._id)) {
    throw new ApiError(400, "User is not a part of this chat");
  }

  const messages = await ChatMessage.aggregate([
    {
      $match: {
        chat: new mongoose.Types.ObjectId(chatId),
      },
    },
    ...chatMessageCommonAggregation(),
    {
      $sort: {
        createdAt: -1,
      },
    },
  ])
    .skip(Number(skip || 0))
    .limit(Number(limit || 25))
    .sort({ createdAt: 1 }).exec();

  return res
    .status(200)
    .json(
      new ApiResponse(200, messages || [], "Messages fetched successfully")
    );
});

const sendMessage = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { content, attachmentUrl } = req.body;

  if (!content && !req.files?.attachments?.length && !attachmentUrl) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  const selectedChat = await Chat.findById(chatId);

  if (!selectedChat) {
    throw new ApiError(404, "Chat does not exist");
  }

  const messageFiles = [];

  if (req.files && req.files.attachments?.length > 0) {
    req.files.attachments?.map((attachment) => {
      messageFiles.push({
        url: getStaticFilePath(req, attachment.filename),
        localPath: getLocalPath(attachment.filename),
      });
    });
  }

  if (attachmentUrl) {
    messageFiles.push({
      url: attachmentUrl,
      localPath: null,
    });
  }

  // Create a new message instance with appropriate metadata
  const message = await ChatMessage.create({
    sender: new mongoose.Types.ObjectId(req.user._id),
    content: content || "",
    chat: new mongoose.Types.ObjectId(chatId),
    attachments: messageFiles,
  });

  // update the chat's last message which could be utilized to show last message in the list item
  const chat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set: {
        lastMessage: message._id,
      },
    },
    { new: true }
  );

  // structure the message
  const messages = await ChatMessage.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(message._id),
      },
    },
    ...chatMessageCommonAggregation(),
  ]);

  // Store the aggregation result
  const receivedMessage = messages[0];

  if (!receivedMessage) {
    throw new ApiError(500, "Internal server error");
  }

  // logic to emit socket event about the new message created to the other participants
  for (const participantObjectId of chat.participants) {
    // here the chat is the raw instance of the chat in which participants is the array of object ids of users
    // avoid emitting event to the user who is sending the message

    // if (participantObjectId.toString() !== req.user._id.toString()) {
    // if (canEmit) {
    // } else {

    let token = (await User.findById(participantObjectId.toString())).firebaseToken;
    await sendNotification(token, `New message from ${req.user.nameElseUsername}`, content || "", {
      "type": "message"
    });
    // }
    // };

    // emit the receive message event to the other participants with received message as the payload

    emitSocketEvent(
      req,
      `${chat._id}/${participantObjectId.toString()}`,
      ChatEventEnum.MESSAGE_RECEIVED_EVENT,
      receivedMessage
    );

  };

  return res
    .status(201)
    .json(new ApiResponse(201, receivedMessage, "Message saved successfully"));
});



const sendMessageToMany = asyncHandler(async (req, res) => {
  const { chatIds, content } = req.body; // Expecting chatIds to be an array in the request body

  // Validate input
  if (!content && !req.files?.attachments?.length) {
    throw new ApiError(400, "Message content or attachment is required");
  }

  // Check if chatIds is an array and has at least one chat ID
  if (!Array.isArray(chatIds) || chatIds.length === 0) {
    throw new ApiError(400, "Chat IDs are required");
  }

  // Convert chatIds to ObjectId
  const chatIdArray = chatIds.map(id => new mongoose.Types.ObjectId(id));

  // Find all chats based on chatIds
  const selectedChats = await Chat.find({ _id: { $in: chatIdArray } });

  if (selectedChats.length === 0) {
    throw new ApiError(404, "No chats exist with the provided chat IDs");
  }

  const messageFiles = [];

  if (req.files && req.files.attachments?.length > 0) {
    req.files.attachments.map((attachment) => {
      messageFiles.push({
        url: getStaticFilePath(req, attachment.filename),
        localPath: getLocalPath(attachment.filename),
      });
    });
  }

  // Store received messages for emitting later
  const receivedMessages = [];

  // Iterate through each chat ID and create a message for each
  for (const chatId of chatIdArray) {
    const message = await ChatMessage.create({
      sender: new mongoose.Types.ObjectId(req.user._id),
      content: content || "",
      chat: chatId, // Associate message with the current chat ID
      attachments: messageFiles,
    });

    // Update each chat's last message
    await Chat.findByIdAndUpdate(
      chatId,
      {
        $set: {
          lastMessage: message._id,
        },
      },
      { new: true }
    );

    // Structure the message for each chat
    const messages = await ChatMessage.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(message._id),
        },
      },
      ...chatMessageCommonAggregation(),
    ]);

    // Store the aggregation result
    const receivedMessage = messages[0];

    if (!receivedMessage) {
      throw new ApiError(500, "Internal server error");
    }

    receivedMessages.push(receivedMessage);


    // Logic to emit socket event about the new message created to all chat participants
    const chat = selectedChats.find(c => c._id.equals(chatId));


    // Logic to emit socket event about the new message created to all chat participants

    chat.participants.forEach((participantObjectId) => {
      // Avoid emitting event to the user who is sending the message
      if (participantObjectId.toString() === req.user._id.toString()) return;

      // Emit the receive message event to the other participants with received message as the payload
      emitSocketEvent(
        req,
        `${chat._id} / ${participantObjectId.toString()}`,
        ChatEventEnum.MESSAGE_RECEIVED_EVENT,
        receivedMessage
      );

    });

  }

  res.status(200).json(new ApiResponse(200, { messages: receivedMessages }, "Message sent to all specified chats"));
});


const deleteMessage = asyncHandler(async (req, res) => {
  //controller to delete chat messages and attachments

  const { chatId, messageId } = req.params;

  //Find the chat based on chatId and checking if user is a participant of the chat
  const chat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    participants: req.user?._id,
  });

  if (!chat) {
    throw new ApiError(404, "Chat does not exist");
  }

  //Find the message based on message id
  const message = await ChatMessage.findOne({
    _id: new mongoose.Types.ObjectId(messageId),
  });

  if (!message) {
    throw new ApiError(404, "Message does not exist");
  }

  // Check if user is the sender of the message
  if (message.sender.toString() !== req.user._id.toString()) {
    throw new ApiError(
      403,
      "You are not the authorised to delete the message, you are not the sender"
    );
  }
  if (message.attachments.length > 0) {
    //If the message is attachment  remove the attachments from the server
    message.attachments.map((asset) => {
      removeLocalFile(asset.localPath);
    });
  }
  //deleting the message from DB
  await ChatMessage.deleteOne({
    _id: new mongoose.Types.ObjectId(messageId),
  });

  //Updating the last message of the chat to the previous message after deletion if the message deleted was last message
  if (chat.lastMessage.toString() === message._id.toString()) {
    const lastMessage = await ChatMessage.findOne(
      { chat: chatId },
      {},
      { sort: { createdAt: -1 } }
    );

    await Chat.findByIdAndUpdate(chatId, {
      lastMessage: lastMessage ? lastMessage?._id : null,
    });
  }
  // logic to emit socket event about the message deleted  to the other participants
  chat.participants.forEach((participantObjectId) => {
    // here the chat is the raw instance of the chat in which participants is the array of object ids of users
    // avoid emitting event to the user who is deleting the message
    if (participantObjectId.toString() === req.user._id.toString()) return;
    // emit the delete message event to the other participants frontend with delete messageId as the payload
    emitSocketEvent(
      req,
      `${chat._id} / ${participantObjectId.toString()}`,
      ChatEventEnum.MESSAGE_DELETE_EVENT,
      message
    );
  });

  return res
    .status(200)
    .json(new ApiResponse(200, message, "Message deleted successfully"));
});

export { chatMessageCommonAggregation, getAllMessages, sendMessage, sendMessageToMany, deleteMessage };
