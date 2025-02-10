import mongoose from "mongoose";
import { ChatEventEnum } from "../../constants.js";
import { User } from "../../models/auth/user.models.js";
import { Chat } from "../../models/chat-app/chat.models.js";
import { ChatMessage } from "../../models/chat-app/message.models.js";
import { DontSuggestUserAgain } from "../../models/chat-app/DontSuggestUserAgain.models.js";
import { emitSocketEvent } from "../../socket/index.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { removeLocalFile, calculateAge } from "../../utils/helpers.js";

import { chatMessageCommonAggregation } from '../../controllers/chat-app/message.controllers.js';

/**
 * @description Utility function which returns the pipeline stages to structure the chat schema with common lookups
 * @returns {mongoose.PipelineStage[]}
 */
const chatCommonAggregation = () => {
  return [
    {
      // lookup for the participants present
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "participants",
        as: "participants",
        pipeline: [
          {
            $project: {
              password: 0,
              refreshToken: 0,
              forgotPasswordToken: 0,
              forgotPasswordExpiry: 0,
              emailVerificationToken: 0,
              emailVerificationExpiry: 0,
            },
          },
        ],
      },
    },
    {
      // lookup for the group chats
      $lookup: {
        from: "chatmessages",
        foreignField: "_id",
        localField: "lastMessage",
        as: "lastMessage",
        pipeline: [
          {
            // get details of the sender
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
        ],
      },
    },
    {
      $addFields: {
        lastMessage: { $first: "$lastMessage" },
      },
    },
  ];
};

/**
 *
 * @param {string} chatId
 * @description utility function responsible for removing all the messages and file attachments attached to the deleted chat
 */
const deleteCascadeChatMessages = async (chatId) => {
  // fetch the messages associated with the chat to remove
  const messages = await ChatMessage.find({
    chat: new mongoose.Types.ObjectId(chatId),
  });

  let attachments = [];

  // get the attachments present in the messages
  attachments = attachments.concat(
    ...messages.map((message) => {
      return message.attachments;
    })
  );

  attachments.forEach((attachment) => {
    // remove attachment files from the local storage
    removeLocalFile(attachment.localPath);
  });

  // delete all the messages
  await ChatMessage.deleteMany({
    chat: new mongoose.Types.ObjectId(chatId),
  });
};

const searchAvailableUsers = asyncHandler(async (req, res) => {
  const users = await User.aggregate([
    {
      $match: {
        _id: {
          $ne: req.user._id, // avoid logged in user
        },
      },
    },
    {
      $project: {
        avatar: 1,
        username: 1,
        email: 1,
      },
    },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, users, "Users fetched successfully"));
});



const getUserMessagingFriends = async (req) => {
  const userId = req.user._id; // Get the logged-in user's ID

  const participantIds = await Chat.aggregate([
    {
      $match: {
        participants: { $elemMatch: { $eq: new mongoose.Types.ObjectId(userId.toString()) } }, // User must be a participant
        isGroupChat: false, // Only one-on-one chats
      },
    },
    {
      $project: {
        participantIds: {
          $filter: {
            input: "$participants", // Filter participants
            as: "participant",
            cond: { $ne: ["$$participant", userId] }, // Exclude the current user
          },
        },
      },
    },
    {
      $unwind: "$participantIds", // Flatten the array of participant IDs
    },
    {
      $replaceRoot: {
        newRoot: { _id: "$participantIds" } // Wrap the participant ID in an object
      }
    },
  ]);

  // Return the array of ObjectIds
  return participantIds.map(participant => participant._id);
}


// Function to calculate the start and end dates for a given age
const getAgeDateRange = (age) => {
  const currentDate = new Date();
  const startOfYear = new Date(currentDate.getFullYear(), 0, 1); // January 1st of the current year
  const endOfYear = new Date(currentDate.getFullYear(), 11, 31); // December 31st of the current year

  // Calculate the birthdate range for the given age
  const ageStartDate = new Date(startOfYear);
  ageStartDate.setFullYear(startOfYear.getFullYear() - age);

  const ageEndDate = new Date(endOfYear);
  ageEndDate.setFullYear(endOfYear.getFullYear() - age);

  return { ageStartDate, ageEndDate };
};

// find frineds based on religion, age, country, language
const findMatchingFriends = asyncHandler(async (req, res) => {
  const { religion, age, country, language } = req.query;

  //const age = calculateAge(date_of_birth);

  // Find the current logged-in user
  const currentUser = await User.findById(req.user._id);

  // Check if the user has enough points to perform a search
  if (currentUser.user_points <= 0) {
    return res
      .status(400)
      .json(new ApiResponse(400, null, "You don't have enough coins to use this feature."));
  }

  const userMessagingFriends = await getUserMessagingFriends(req);

  // console.log(userMessagingFriends);

  // Build the query object dynamically based on provided parameters
  const query = {
    _id: {
      $ne: currentUser._id,
      $nin: [...currentUser.followers, ...currentUser.following, ...userMessagingFriends]
    }
  }; // Exclude the current user

  if (religion) query.religion = religion;
  // if (age) query.age = parseInt(age); // Parse age as an integer
  if (country) query.country = country;
  if (language) query.language = language;


  // If age is provided, calculate the date range for the user's birthdate
  if (age) {
    const { ageStartDate, ageEndDate } = getAgeDateRange(parseInt(age));
    query.date_of_birth = { $gte: ageStartDate, $lte: ageEndDate }; // Filter users by date_of_birth range
  }

  // Perform the search query with the dynamically built filters
  const users = await User.aggregate([
    {
      $match: query,
    },
    {
      $project: {
        avatar: 1,
        name: 1,
        username: 1,
        email: 1,
      },
    },
    {
      $limit: 5, // Limit the result to 5 users
    },
  ]);

  // Handle the case where no users are found
  if (!users.length) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "No users found matching the given criteria."));
  }


  // Find users that should not be suggested to the current user
  const dontSuggestIds = await DontSuggestUserAgain.find({
    dontSuggestTo: currentUser._id,
  }).select("dontSuggestWho");

  // Create a set of user IDs that should not be suggested
  const dontSuggestUserIds = new Set(dontSuggestIds.map((record) => record.dontSuggestWho.toString()));

  // Filter out the users that are in the "dont suggest" list
  const filteredUsers = users.filter((user) => !dontSuggestUserIds.has(user._id.toString()));

  // Handle the case where all users are filtered out
  if (!filteredUsers.length) {
    return res
      .status(200)
      .json(new ApiResponse(200, [], "No users available after filtering out the ones you don't want to suggest."));
  }

  filteredUsers.sort(() => Math.random() - 0.5);

  // Deduct 1 point for the search and save the user
  currentUser.user_points -= 1;
  await currentUser.save();

  // Return matching users
  return res
    .status(200)
    .json(new ApiResponse(200, filteredUsers, "Matching users fetched successfully"));
});


// don't suggest this same user again in find friends feature.
const dontSuggestUserAsFriendAgain = asyncHandler(async (req, res) => {
  const { dontSuggestWho } = req.body;

  //const age = calculateAge(date_of_birth);


  try {

    const dontSuggestTo = req.user._id;

    // Check if both fields are provided
    if (!dontSuggestTo || !dontSuggestWho) {
      return res.status(400).json({ error: "Both 'dontSuggestTo' and 'dontSuggestWho' are required." });
    }

    // Create a new record
    const newRecord = new DontSuggestUserAgain({
      dontSuggestTo,
      dontSuggestWho
    });

    // Save the record to the database
    await newRecord.save();

    // Send a success response
    return res.status(201).json({ message: "Record successfully added", data: newRecord });


  } catch (error) {
    // Handle errors
    console.error(error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});



const getListOfUserChats = asyncHandler(async (req, res) => {
  const userId = req.user._id; // Get the logged-in user's ID

  const { limit = 15, skip = 0 } = req.body;

  const chats = await Chat.aggregate([
    {
      $match: {
        participants: { $elemMatch: { $eq: new mongoose.Types.ObjectId(userId.toString()) } }, // User must be a participant
      },
    },
    {
      // Lookup the last message for each chat
      $lookup: {
        from: "chatmessages",
        localField: "_id",
        foreignField: "chat",
        as: "lastMessage",
        pipeline: [
          {
            $sort: { createdAt: -1 }, // Sort messages by creation time
          },
          {
            $limit: 1, // Limit to the most recent message regardless of sender
          },
        ],
      },
    },
    {
      $addFields: {
        lastMessage: { $first: "$lastMessage" }, // Get the most recent message
        numberOfParticipants: { $size: "$participants" }, // Add the number of participants
      },
    },
    {
      // Lookup participant details from the 'users' collection
      $lookup: {
        from: "users", // Assuming 'users' is the user collection
        localField: "participants",
        foreignField: "_id", // Match user IDs in participants array
        as: "participantDetails",
      },
    },
    {
      $addFields: {
        participantDetails: {
          $cond: {
            if: { $eq: ["$isGroupChat", false] }, // Only include participant details if it's not a group chat
            then: {
              $filter: {
                input: "$participantDetails",
                as: "participant",
                cond: { $ne: ["$$participant._id", userId] }, // Exclude the current user
              },
            },
            else: "$participantDetails", // Keep details for group chats
          },
        },
      },
    },
    {
      // Optional: project only the needed fields
      $project: {
        _id: 1,
        isGroupChat: 1,
        lastMessage: 1,
        createdAt: 1,
        name: 1,
        numberOfParticipants: 1,
        participantDetails: {
          $map: {
            input: "$participantDetails",
            as: "participant",
            in: {
              _id: "$$participant._id",
              name: "$$participant.name",
              username: "$$participant.username",
              avatar: "$$participant.avatar",
            },
          },
        },
      },
    },
    {
      $addFields: {
        sortField: {
          $cond: {
            if: { $ifNull: ["$lastMessage", false] },
            then: "$lastMessage.createdAt",
            else: "$createdAt", // Assuming 'createdAt' exists for chats
          },
        },
      },
    },
    {
      $sort: { sortField: -1 }, // Sort by the calculated field
    },
    // Add skip and limit stages for pagination
    { $skip: parseInt(skip) },
    { $limit: parseInt(limit) },
  ]);

  return res
    .status(200)
    .json(new ApiResponse(200, chats, "Chats fetched successfully"));
});



const createOrGetAOneOnOneChat = asyncHandler(async (req, res) => {
  const { receiverId } = req.params;

  console.log(receiverId);
  console.log(req.user._id.toString());

  // Check if it's a valid receiver
  const receiver = await User.findById(receiverId);

  if (!receiver) {
    throw new ApiError(404, "Receiver does not exist");
  }

  // check if receiver is not the user who is requesting a chat
  if (receiver._id.toString() === req.user._id.toString()) {
    throw new ApiError(400, "You cannot chat with yourself");
  }

  const chat = await Chat.aggregate([
    {
      $match: {
        isGroupChat: false, // Ensure it's a one-on-one chat (not a group chat)
        participants: {
          $all: [  // Use $all to ensure both participants are in the chat
            new mongoose.Types.ObjectId(req.user._id.toString()),  // Current user
            new mongoose.Types.ObjectId(receiverId.toString()),  // Receiver
          ],
        },
      },
    },
    ...chatCommonAggregation(),
  ]);

  console.log(chat.length);

  if (chat.length) {
    // Use aggregation pipeline to fetch messages
    let messages = await ChatMessage.aggregate([
      {
        $match: {
          chat: new mongoose.Types.ObjectId(chat[0]._id.toString()),
        },
      },
      {
        $sort: {
          createdAt: -1, // Sort by creation time, newest first
        },
      },
      {
        $limit: 20, // Limit to the last 20 messages
      },
    ]).sort({ createdAt: 1 }).exec();

    // console.log(messages);

    chat[0]["recentMessages"] = messages;

    const responsePayload = {
      chat: chat[0]
    };

    // Return chat with recent messages
    return res
      .status(200)
      .json(new ApiResponse(200, responsePayload, "Chat and recent messages retrieved successfully"));
  }

  // if not we need to create a new one on one chat
  const newChatInstance = await Chat.create({
    name: "One on one chat",
    participants: [new mongoose.Types.ObjectId(req.user._id.toString()), new mongoose.Types.ObjectId(receiverId)], // add receiver and logged in user as participants
    admin: new mongoose.Types.ObjectId(req.user._id.toString()),
  });

  // structure the chat as per the common aggregation to keep the consistency
  const createdChat = await Chat.aggregate([
    {
      $match: {
        _id: newChatInstance._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = { chat: createdChat[0] }; // store the aggregation result

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  payload["chat"]["recentMessages"] = [];

  // logic to emit socket event about the new chat added to the participants
  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is initiating the chat

    // emit event to other participants with new chat as a payload
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum.NEW_CHAT_EVENT,
      payload
    );
  });

  return res
    .status(201)
    .json(new ApiResponse(201, payload, "Chat retrieved successfully"));
});

const createAGroupChat = asyncHandler(async (req, res) => {
  const { name, participants } = req.body;

  // Check if user is not sending himself as a participant. This will be done manually
  if (participants.includes(req.user._id.toString())) {
    throw new ApiError(
      400,
      "Participants array should not contain the group creator"
    );
  }

  const members = [...new Set([...participants, req.user._id.toString()])]; // check for duplicates

  if (members.length < 3) {
    // check after removing the duplicate
    // We want group chat to have minimum 3 members including admin
    throw new ApiError(
      400,
      "Seems like you have passed duplicate participants."
    );
  }

  // Create a group chat with provided members
  const groupChat = await Chat.create({
    name,
    isGroupChat: true,
    participants: members,
    admin: req.user._id,
  });

  // structure the chat
  const chat = await Chat.aggregate([
    {
      $match: {
        _id: groupChat._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  // logic to emit socket event about the new group chat added to the participants
  payload?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is initiating the chat
    // emit event to other participants with new chat as a payload
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum.NEW_CHAT_EVENT,
      payload
    );
  });

  return res
    .status(201)
    .json(new ApiResponse(201, payload, "Group chat created successfully"));
});

const getGroupChatDetails = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const groupChat = await Chat.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const chat = groupChat[0];

  if (!chat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, chat, "Group chat fetched successfully"));
});

const renameGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;
  const { name } = req.body;

  // check for chat existence
  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  // only admin can change the name
  if (groupChat.admin?.toString() !== req.user._id?.toString()) {
    throw new ApiError(404, "You are not an admin");
  }

  const updatedGroupChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $set: {
        name,
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    {
      $match: {
        _id: updatedGroupChat._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  // logic to emit socket event about the updated chat name to the participants
  payload?.participants?.forEach((participant) => {
    // emit event to all the participants with updated chat as a payload
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum.UPDATE_GROUP_NAME_EVENT,
      payload
    );
  });

  return res
    .status(200)
    .json(
      new ApiResponse(200, chat[0], "Group chat name updated successfully")
    );
});

const deleteGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  // check for the group chat existence
  const groupChat = await Chat.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(chatId),
        isGroupChat: true,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const chat = groupChat[0];

  if (!chat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  // check if the user who is deleting is the group admin
  if (chat.admin?.toString() !== req.user._id?.toString()) {
    throw new ApiError(404, "Only admin can delete the group");
  }

  await Chat.findByIdAndDelete(chatId); // delete the chat

  await deleteCascadeChatMessages(chatId); // remove all messages and attachments associated with the chat

  // logic to emit socket event about the group chat deleted to the participants
  chat?.participants?.forEach((participant) => {
    if (participant._id.toString() === req.user._id.toString()) return; // don't emit the event for the logged in use as he is the one who is deleting
    // emit event to other participants with left chat as a payload
    emitSocketEvent(
      req,
      participant._id?.toString(),
      ChatEventEnum.LEAVE_CHAT_EVENT,
      chat
    );
  });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Group chat deleted successfully"));
});

const deleteOneOnOneChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  // check for chat existence
  const chat = await Chat.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(chatId),
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(404, "Chat does not exist");
  }

  await Chat.findByIdAndDelete(chatId); // delete the chat even if user is not admin because it's a personal chat

  await deleteCascadeChatMessages(chatId); // delete all the messages and attachments associated with the chat

  const otherParticipant = payload?.participants?.find(
    (participant) => participant?._id.toString() !== req.user._id.toString() // get the other participant in chat for socket
  );

  // emit event to other participant with left chat as a payload
  emitSocketEvent(
    req,
    otherParticipant._id?.toString(),
    ChatEventEnum.LEAVE_CHAT_EVENT,
    payload
  );

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Chat deleted successfully"));
});

const leaveGroupChat = asyncHandler(async (req, res) => {
  const { chatId } = req.params;

  // check if chat is a group
  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  const existingParticipants = groupChat.participants;

  // check if the participant that is leaving the group, is part of the group
  if (!existingParticipants?.includes(req.user?._id)) {
    throw new ApiError(400, "You are not a part of this group chat");
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: {
        participants: req.user?._id, // leave the group
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    {
      $match: {
        _id: updatedChat._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Left a group successfully"));
});

const addNewParticipantInGroupChat = asyncHandler(async (req, res) => {
  const { chatId, participantId } = req.params;

  // check if chat is a group
  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  // check if user who is adding is a group admin
  if (groupChat.admin?.toString() !== req.user._id?.toString()) {
    throw new ApiError(404, "You are not an admin");
  }

  const existingParticipants = groupChat.participants;

  // check if the participant that is being added in a part of the group
  if (existingParticipants?.includes(participantId)) {
    throw new ApiError(409, "Participant already in a group chat");
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $push: {
        participants: participantId, // add new participant id
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    {
      $match: {
        _id: updatedChat._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  // emit new chat event to the added participant
  emitSocketEvent(req, participantId, ChatEventEnum.NEW_CHAT_EVENT, payload);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Participant added successfully"));
});

const removeParticipantFromGroupChat = asyncHandler(async (req, res) => {
  const { chatId, participantId } = req.params;

  // check if chat is a group
  const groupChat = await Chat.findOne({
    _id: new mongoose.Types.ObjectId(chatId),
    isGroupChat: true,
  });

  if (!groupChat) {
    throw new ApiError(404, "Group chat does not exist");
  }

  // check if user who is deleting is a group admin
  if (groupChat.admin?.toString() !== req.user._id?.toString()) {
    throw new ApiError(404, "You are not an admin");
  }

  const existingParticipants = groupChat.participants;

  // check if the participant that is being removed in a part of the group
  if (!existingParticipants?.includes(participantId)) {
    throw new ApiError(400, "Participant does not exist in the group chat");
  }

  const updatedChat = await Chat.findByIdAndUpdate(
    chatId,
    {
      $pull: {
        participants: participantId, // remove participant id
      },
    },
    { new: true }
  );

  const chat = await Chat.aggregate([
    {
      $match: {
        _id: updatedChat._id,
      },
    },
    ...chatCommonAggregation(),
  ]);

  const payload = chat[0];

  if (!payload) {
    throw new ApiError(500, "Internal server error");
  }

  // emit leave chat event to the removed participant
  emitSocketEvent(req, participantId, ChatEventEnum.LEAVE_CHAT_EVENT, payload);

  return res
    .status(200)
    .json(new ApiResponse(200, payload, "Participant removed successfully"));
});

const getAllChats = asyncHandler(async (req, res) => {
  const chats = await Chat.aggregate([
    {
      $match: {
        participants: { $elemMatch: { $eq: req.user._id } }, // get all chats that have logged in user as a participant
      },
    },
    {
      $sort: {
        updatedAt: -1,
      },
    },
    ...chatCommonAggregation(),
  ]);

  return res
    .status(200)
    .json(
      new ApiResponse(200, chats || [], "User chats fetched successfully!")
    );
});

export {
  addNewParticipantInGroupChat,
  createAGroupChat,
  getListOfUserChats,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
  findMatchingFriends,
  dontSuggestUserAsFriendAgain,
  getUserMessagingFriends
};
