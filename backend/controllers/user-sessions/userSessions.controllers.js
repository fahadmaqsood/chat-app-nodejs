import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import UserSchedule from "../../models/user-sessions/UserSchedule.js";
import mongoose from "mongoose";


import { Chat } from "../../models/chat-app/chat.models.js";



const getChatsForReceivers = async (user_id, receiverIds) => {

    // Ensure that receiverIds is an array and not empty
    if (!Array.isArray(receiverIds) || receiverIds.length === 0) {
        throw new ApiError(400, "Receiver IDs are required and must be a non-empty array");
    }

    // Check if receiverIds contains duplicates (this step is optional but good practice)
    const uniqueReceiverIds = [...new Set(receiverIds)];

    // Find all one-on-one chats where participants are only req.user._id and any of the receiverIds
    const chats = await Chat.aggregate([
        {
            $match: {
                isGroupChat: false, // Ensure it's a one-on-one chat (not a group chat)
                participants: {
                    $all: [  // Ensure both participants are in the chat
                        new mongoose.Types.ObjectId(user_id.toString()),
                        { $in: uniqueReceiverIds.map(id => new mongoose.Types.ObjectId(id.toString())) } // Receivers
                    ],
                },
            },
        },
        {
            $project: {
                _id: 1, // Only return the chat ID
            },
        },
    ]);

    // Extract the chat IDs
    const chatIds = chats.map(chat => chat._id);

    // Return the list of chat IDs if found
    return chatIds;
};



const sendMessageToMany = async (chatIds, content) => {

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

    // Store received messages for emitting later
    const receivedMessages = [];

    // Iterate through each chat ID and create a message for each
    for (const chatId of chatIdArray) {
        const message = await ChatMessage.create({
            sender: new mongoose.Types.ObjectId(req.user._id),
            content: content || "",
            chat: chatId, // Associate message with the current chat ID
            attachments: [],
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

    return receivedMessages;
};


// Schedule a session
const scheduleSession = async (req, res) => {
    try {
        const { title, description, participants, startTime, endTime, sendMessageToParticipants } = req.body;
        const currentUserId = req.user._id; // Get the current user from the request

        if (!startTime || !endTime) {
            return res.status(400).json(new ApiResponse(400, {}, "startTime, and endTime are required"));
        }



        // Create new session
        const newSession = new UserSchedule({
            title,
            description,
            participants: [...participants, currentUserId], // Include the current user as a participant
            date: new Date(startTime),
            endTime: new Date(endTime),
            organizer: currentUserId
        });

        await newSession.save();

        if (sendMessageToParticipants) {
            // send messages to conversation where only userId and participantId is included

            let chatIds = await getChatsForReceivers(req.user._id.toString(), participants);
            await sendMessageToMany(chatIds, `~~forward~~/session/?name=${title}&description=${description}&startTime=${startTime}&endTime=${endTime}`);
        }

        return res.status(201).json(new ApiResponse(201, { session: newSession }, "Session scheduled successfully"));
    } catch (error) {
        console.error("Error in scheduleSession:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Get sessions for a specific date
const getSessionsByDate = async (req, res) => {
    try {
        const { date } = req.query; // Get the date from the query parameters
        const currentUserId = req.user._id; // Get the current user from the request

        if (!date) {
            return res.status(400).json(new ApiResponse(400, {}, "Date is required"));
        }


        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0); // Set to the start of the day

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999); // Set to the end of the day


        // Fetch sessions for the given date
        const sessions = await UserSchedule.find({
            date: { $gte: startOfDay, $lte: endOfDay },
            $or: [
                { organizer: currentUserId }, // Check if currentUserId is the organizer
                { participants: { $in: [currentUserId] } } // Check if currentUserId is in participants
            ]
        })
            // .populate('participants', 'name username avatar email') // Populate participant details
            .lean();


        if (!sessions || sessions.length === 0) {
            return res.status(200).json(new ApiResponse(200, { sessions: [] }, "No sessions found for this date"));
        }

        return res.status(200).json(new ApiResponse(200, { sessions }, "Sessions fetched successfully"));
    } catch (error) {
        console.error("Error in getSessionsByDate:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};



const getSessionDetails = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(new ApiResponse(400, {}, "sessionId is required"));
        }

        // Find the session by its ID and populate participant details
        const session = await UserSchedule.findById(sessionId)
            .populate('participants', 'name username email avatar')
            .populate('userId', 'name username email avatar') // Populate the creator's info
            .lean();

        if (!session) {
            return res.status(404).json(new ApiResponse(404, {}, "Session not found"));
        }

        return res.status(200).json(new ApiResponse(200, { session }, "Session details fetched successfully"));
    } catch (error) {
        console.error("Error in getSessionDetails:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred while fetching session details'));
    }
};





const editSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(new ApiResponse(400, {}, "sessionId is required"));
        }

        const { title, description, participants, startTime, endTime, sendMessageToParticipants } = req.body;
        const currentUserId = req.user._id; // Get the current user from the request

        if (!startTime || !endTime) {
            return res.status(400).json(new ApiResponse(400, {}, "startTime and endTime are required"));
        }

        // Find the existing session by sessionId
        const session = await UserSchedule.findById(sessionId);

        if (!session) {
            return res.status(404).json(new ApiResponse(404, {}, "Session not found"));
        }

        // Update session details (only the fields provided in the request body)
        session.title = title || session.title;
        session.description = description || session.description;
        session.startTime = new Date(startTime) || session.startTime;
        session.endTime = new Date(endTime) || session.endTime;

        // Ensure participants list is updated, adding current user if not present
        session.participants = [...new Set([...session.participants, ...participants, currentUserId])]; // Avoid duplicates
        session.organizer = currentUserId; // Ensure the organizer is the current user

        // Save the updated session
        await session.save();

        if (sendMessageToParticipants) {
            // Send messages to the conversation where only userId and participantId are included
            let chatIds = await getChatsForReceivers(req.user._id.toString(), participants);
            await sendMessageToMany(chatIds, `~~forward~~/session/?name=${title}&description=${description}&startTime=${startTime}&endTime=${endTime}`);
        }

        // Populate participant details and return the updated session
        // const populatedSession = await UserSchedule.findById(sessionId)
        //     .populate('participants', 'name username email avatar')
        //     .populate('userId', 'name username email avatar') // Populate the creator's info
        //     .lean();

        return res.status(200).json(new ApiResponse(200, {}, "Session details updated successfully"));

    } catch (error) {
        console.error("Error in editSession:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred while updating session details'));
    }
};


const deleteSession = async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessionId) {
            return res.status(400).json(new ApiResponse(400, {}, "sessionId is required"));
        }

        // Delete the session
        await UserSchedule.findByIdAndDelete(sessionId);

        return res.status(200).json(new ApiResponse(200, {}, "Session deleted successfully"));
    } catch (error) {
        console.error("Error in deleteSession:", error);
        return res.status(500).json(new ApiResponse(500, {}, 'An error occurred while deleting the session'));
    }
};



// Get currently scheduled sessions
const getCurrentSessions = async (req, res) => {
    try {
        // Get the current date and time
        const now = new Date();

        const startOfMinute = new Date(now.setSeconds(0, 0)); // Current minute, seconds = 0
        const endOfMinute = new Date(startOfMinute.getTime() + 60000); // Start of next minute

        // Fetch sessions that are ongoing right now
        const currentSessions = await UserSchedule.find({
            date: { $gte: startOfMinute, $lt: endOfMinute }, // Start time must be in the past or now
            endTime: { $gt: now } // End time must be in the future or now
        })
            .populate('organizer', '_id username name') // Populate organizer's name
            .populate('participants', '_id username name') // Populate participants' names
            .select('organizer participants') // Only select organizer and participants
            .lean();

        if (!currentSessions || currentSessions.length === 0) {
            return [];
        }

        return currentSessions;
    } catch (error) {
        console.error("Error in getCurrentSessions:", error);
        return [];
    }
};


export { scheduleSession, getSessionsByDate, getSessionDetails, getCurrentSessions, editSession, deleteSession };
