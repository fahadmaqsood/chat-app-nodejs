
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import mongoose from "mongoose"; // Import mongoose to close the connection


import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

// importing models
import { User } from "./models/auth/user.models.js";
import { ScheduledAccountDeletion } from "./models/auth/ScheduledAccountDeletion.js";
import { UserSchedule } from "./models/schedule/userSchedule.models.js";
import QuizResult from "./models/quiz/QuizResult.js";
import PersonalityQuizResult from "./models/quiz/PersonalityQuizResult.js";
import PersonalDiary from "./models/personal-diary/PersonalDiary.js";
import Notification from "./models/notification/Notification.js";
import ChatBot from "./models/chatbot/chatbot.models.js";
import { Chat } from "./models/chat-app/chat.models.js";
import { deleteCascadeChatMessages } from "./controllers/chat-app/chat.controllers.js";


// Define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isValidJson(jsonString) {
    try {
        // Try to parse the JSON string
        JSON.parse(jsonString);
        return true;  // If no error, the string is valid JSON
    } catch (e) {
        return false; // If error occurs, the string is not valid JSON
    }
}


async function removeUserQuizResults(userIds) {
    if (!userIds.length) return;

    // Remove personality quiz results
    const deletedPersonalityResults = await PersonalityQuizResult.deleteMany({ user_id: { $in: userIds } });
    console.log(`Deleted ${deletedPersonalityResults.deletedCount} personality quiz results.`);

    // Remove normal quiz results
    const deletedQuizResults = await QuizResult.deleteMany({ user_id: { $in: userIds } });
    console.log(`Deleted ${deletedQuizResults.deletedCount} normal quiz results.`);
}



async function removeFromFollowersAndFollowing(userIds) {
    if (!userIds.length) return;

    // Remove users from other users' following lists
    const updatedFollowing = await User.updateMany(
        { following: { $in: userIds } },
        { $pull: { following: { $in: userIds } } }
    );

    console.log(`Removed deleted users from ${updatedFollowing.modifiedCount} users' following lists.`);

    // Remove users from other users' followers lists
    const updatedFollowers = await User.updateMany(
        { followers: { $in: userIds } },
        { $pull: { followers: { $in: userIds } } }
    );

    console.log(`Removed deleted users from ${updatedFollowers.modifiedCount} users' followers lists.`);
}


async function removeUserDiaryEntries(userIds) {
    if (!userIds.length) return;

    // Delete personal diary entries for these users
    const deletedDiaries = await PersonalDiary.deleteMany({ user_id: { $in: userIds } });

    console.log(`Deleted ${deletedDiaries.deletedCount} personal diary entries.`);
}


async function removeUserNotifications(userIds) {
    if (!userIds.length) return;

    // Delete all notifications related to these users
    const deletedNotifications = await Notification.deleteMany({ user_id: { $in: userIds } });

    console.log(`Deleted ${deletedNotifications.deletedCount} notifications.`);
}

async function removeUserChatbotMessages(userIds) {
    if (!userIds.length) return;

    // Delete all chatbot messages related to these users
    const deletedMessages = await ChatBot.deleteMany({ user: { $in: userIds } });

    console.log(`Deleted ${deletedMessages.deletedCount} chatbot messages.`);
}

async function removeUserSchedules(userIds) {
    // Remove schedules where the user is the organizer
    const deletedSchedules = await UserSchedule.deleteMany({ organizer: { $in: userIds } });

    console.log(`Deleted ${deletedSchedules.deletedCount} schedules where the user was the organizer.`);

    // Remove the user from participants array in schedules
    const updatedSchedules = await UserSchedule.updateMany(
        { participants: { $in: userIds } },
        { $pull: { participants: { $in: userIds } } }
    );

    console.log(`Updated ${updatedSchedules.modifiedCount} schedules by removing deleted users from participants.`);
}



async function deleteUserChats(userIds) {
    // Loop over each userId to find chats where they are participants
    for (const userId of userIds) {
        // Find chats where the user is a participant and it's not a group chat
        const participantChats = await Chat.find({
            participants: { $in: [userId] }, // Using $in to check if userId is in the participants array
            isGroupChat: false
        });

        for (const chat of participantChats) {
            await deleteCascadeChatMessages(chat._id);
            await Chat.findByIdAndDelete(chat._id);
        }

        console.log(`Chats where user ${userId} is a participant and is not a group chat:`, participantChats);

        // You can add additional logic here to handle these chats (e.g., delete messages, delete chats, etc.)
    }
}





try {
    await connectDB();


    if (scheduledDeletions.length === 0) {
        console.log("No accounts scheduled for deletion.");
    } else {
        console.log("Scheduled account deletions:", scheduledDeletions);

        // Extract user IDs
        const userIds = scheduledDeletions.map(record => record.user);

        // Delete users from the User collection
        // const deleteResult = await User.deleteMany({ _id: { $in: userIds } });

        // console.log(`Deleted ${deleteResult.deletedCount} users.`);

        console.log("Deleted corresponding user records.");


        await removeFromFollowersAndFollowing(userIds);

        await removeUserQuizResults(userIds);


        await removeUserDiaryEntries(userIds);

        await removeUserNotifications(userIds);

        await removeUserChatbotMessages(userIds);

        await removeUserSchedules(userIds);


        await deleteUserChats(userIds);




        // Update status to "deleted" in ScheduledAccountDeletion
        await ScheduledAccountDeletion.updateMany(
            { user: { $in: userIds } },
            { $set: { status: "deleted" } }
        );

        console.log("Deleted corresponding scheduled deletion records.");
    }



    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}