
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { retrieveQuizTopicList } from "./controllers/quiz/quiz.controllers.js";
import { getChatCompletion } from "./utils/openai.js";

import { ChatMessage } from "./models/chat-app/message.models.js";
import UserPost from "./models/social/UserPost.js";

import Quiz from "./models/quiz/Quiz.js";
import PersonalityQuiz from "./models/quiz/PersonalityQuiz.js";

import mongoose from "mongoose"; // Import mongoose to close the connection


import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';


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


const getUserMessagesLast24Hours = async (userId) => {
    // Get the current date and subtract 24 hours to get the timestamp for 24 hours ago
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Fetch messages sent by the user in the last 24 hours
    const messages = await ChatMessage.aggregate([
        {
            $match: {
                sender: new mongoose.Types.ObjectId(userId), // Filter by sender (userId)
                createdAt: { $gte: twentyFourHoursAgo }, // Filter by messages sent within the last 24 hours
            },
        },
        {
            $sort: {
                createdAt: 1, // Sort messages by creation time, most recent last
            },
        },
        {
            $lookup: {
                from: 'chats', // Join with the 'Chat' collection
                localField: 'chat', // Field in the message to match chat
                foreignField: '_id', // Field in 'chats' to match
                as: 'chatDetails', // Alias for the joined chat data
            },
        },
        {
            $unwind: {
                path: '$chatDetails', // Unwind the array so we can access the chat details
            },
        },
        {
            $lookup: {
                from: 'users', // Lookup the users who are participants in the chat
                localField: 'chatDetails.participants', // Use the participants field in the chat to match users
                foreignField: '_id', // Match with _id in the users collection
                as: 'participantsDetails', // Alias for participants data
            },
        },
        {
            $addFields: {
                recipientName: {
                    $cond: {
                        if: { $eq: ['$chatDetails.isGroupChat', true] }, // Check if it's a group chat
                        then: '$chatDetails.name', // Return the group chat name
                        else: {
                            $arrayElemAt: [
                                {
                                    $filter: {
                                        input: '$participantsDetails',
                                        as: 'participant',
                                        cond: { $ne: ['$$participant._id', new mongoose.Types.ObjectId(userId)] }, // Exclude the sender
                                    },
                                },
                                0, // Take the first (only) participant (other than the sender)
                            ],
                        }, // Else, return the other participant's name
                    },
                },
            },
        },
        {
            $project: {
                sender: 1, // Include sender field
                messageContent: 1, // Include message content
                createdAt: 1, // Include message creation date
                recipientName: 1, // Include the calculated recipientName
            },
        },
    ])
        .exec();

    return messages;
};




const getProfilePosts = async (userId) => {
    try {
        // Fetch user's posts from the database using userId
        const posts = await UserPost.find({ user_id: userId })
            .sort({ createdAt: -1 })
            .populate({
                path: 'user_id', // The field to populate
                select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            }).populate({
                path: 'topics', // The field to populate
                select: 'name description' // Fields to select from the User model
            }).exec();

        if (!posts || posts.length === 0) {
            return [];
        }

        // Prepare the response with numLikes and numComments
        const postPromises = posts.map(async (post) => {
            const postObject = post.toObject();
            postObject.user = postObject.user_id; // Add user info under user key
            delete postObject.user_id; // Remove user_id field

            // Count likes and comments
            const numLikes = await PostLike.countDocuments({ post_id: post._id });
            const numComments = await UserComment.countDocuments({ post_id: post._id });


            const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

            postObject.numLikes = numLikes; // Add numLikes to the post object
            postObject.numComments = numComments; // Add numComments to the post object

            postObject.hasUserLiked = !!hasUserLiked;

            // handling polls
            if (post.poll && Array.isArray(post.poll.options)) {
                postObject.poll.options = post.poll.options.map((option) => {
                    return {
                        _id: option._id,
                        option: option.option,
                        numVotes: option.votedBy.length,
                        isVotedByUser: option.votedBy.includes(req.user._id)
                    };
                });
            }

            return postObject;
        });


        const formattedPosts = await Promise.all(postPromises);

        return formattedPosts;
    } catch (error) {
        console.error("Error in getProfilePosts:", error);
        return [];
    }
};



const getPostsLiked = async (userId) => {
    try {
        // Get the current date and subtract 24 hours to get the date range for likes
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        // Find posts liked by the user in the last 24 hours
        const postLikes = await PostLike.find({
            user_id: userId,
            createdAt: { $gte: last24Hours }  // Filter likes within the last 24 hours
        }).select('post_id');  // Only select the post_id field

        if (!postLikes || postLikes.length === 0) {
            return []; // No posts liked in the last 24 hours
        }

        // Extract the post_ids from the postLikes array
        const postIds = postLikes.map(like => like.post_id);

        // Fetch the posts corresponding to the liked post_ids
        const posts = await UserPost.find({
            _id: { $in: postIds } // Get posts that are in the liked post list
        })
            .sort({ createdAt: -1 }) // Sort by most recent post
            .populate({
                path: 'user_id',  // The field to populate
                select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            }).populate({
                path: 'topics', // The field to populate
                select: 'name description' // Fields to select from the Topic model
            }).exec();

        if (!posts || posts.length === 0) {
            return [];
        }

        // Prepare the response with numLikes and numComments
        const postPromises = posts.map(async (post) => {
            const postObject = post.toObject();
            postObject.user = postObject.user_id; // Add user info under user key
            delete postObject.user_id; // Remove user_id field

            // Count likes and comments
            const numLikes = await PostLike.countDocuments({ post_id: post._id });
            const numComments = await UserComment.countDocuments({ post_id: post._id });

            const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: userId }); // Check if user has liked the post

            postObject.numLikes = numLikes; // Add numLikes to the post object
            postObject.numComments = numComments; // Add numComments to the post object
            postObject.hasUserLiked = !!hasUserLiked;

            // handling polls (if any)
            if (post.poll && Array.isArray(post.poll.options)) {
                postObject.poll.options = post.poll.options.map((option) => {
                    return {
                        _id: option._id,
                        option: option.option,
                        numVotes: option.votedBy.length,
                        isVotedByUser: option.votedBy.includes(userId)
                    };
                });
            }

            return postObject;
        });

        const formattedPosts = await Promise.all(postPromises);

        return formattedPosts;
    } catch (error) {
        console.error("Error in getPostsLiked:", error);
        return [];
    }
};


try {
    await connectDB();

    let userId = "66e845248e5cca16bfbb73f4";

    let messages = await getUserMessagesLast24Hours(userId);

    let postsPosted = await getProfilePosts(userId);


    let postsLiked = await getPostsLiked(userId);


    console.log(messages);

    console.log(postsPosted);

    console.log(postsLiked);



    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}