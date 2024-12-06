
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { retrieveQuizTopicList } from "./controllers/quiz/quiz.controllers.js";
import { getChatCompletion } from "./utils/openai.js";

import { User } from "./models/auth/user.models.js";

import PersonalDiary from "./models/personal-diary/PersonalDiary.js";

import { ChatMessage } from "./models/chat-app/message.models.js";
import UserPost from "./models/social/UserPost.js";


import PostLike from "./models/social/PostLikes.js";

import UserComment from "./models/social/UserComment.js";

import { PostTopics } from "./models/social/PostTopics.js";

import Quiz from "./models/quiz/Quiz.js";
import QuizResult from "./models/quiz/QuizResult.js";

import PersonalityQuiz from "./models/quiz/PersonalityQuiz.js";
import PersonalityQuizResult from "./models/quiz/PersonalityQuizResult.js";

import mongoose from "mongoose"; // Import mongoose to close the connection


import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

import moment from "moment"; // For easier date manipulation


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
                        then: { name: '$chatDetails.name', isGroupChat: true }, // Return the group chat name
                        else: {
                            $let: {
                                vars: {
                                    recipient: {
                                        $arrayElemAt: [
                                            {
                                                $filter: {
                                                    input: '$participantsDetails',
                                                    as: 'participant',
                                                    cond: { $ne: ['$$participant._id', new mongoose.Types.ObjectId(userId)] } // Exclude the sender
                                                },
                                            },
                                            0 // Take the first (only) participant (other than the sender)
                                        ]
                                    }
                                },
                                in: {
                                    name: '$$recipient.name',
                                    username: '$$recipient.username',
                                    isGroupChat: false
                                }
                            }
                        },

                    },
                },
            },
        },
        {
            $project: {
                //sender: 1, // Include sender field
                content: 1, // Include message content
                attachments: 1,
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
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        // Fetch user's posts from the database using userId
        const posts = await UserPost.find({ user_id: userId, createdAt: { $gte: last24Hours } })
            .sort({ createdAt: -1 })
            // .populate({
            //     path: 'user_id', // The field to populate
            //     select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            // })
            .populate({
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


            const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: userId }); // Check if user has liked the post

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
                        isVotedByUser: option.votedBy.includes(userId)
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
            liked_at: { $gte: last24Hours }  // Filter likes within the last 24 hours
        }).select('post_id liked_at');  // Only select the post_id field

        if (!postLikes || postLikes.length === 0) {
            return []; // No posts liked in the last 24 hours
        }

        const postLikesMap = postLikes.reduce((acc, like) => {
            acc[like.post_id] = like.liked_at; // Store liked_at for each post_id
            return acc;
        }, {});

        // Extract the post_ids from the postLikes array
        const postIds = postLikes.map(like => like.post_id);

        // Fetch the posts corresponding to the liked post_ids
        const posts = await UserPost.find({
            _id: { $in: postIds } // Get posts that are in the liked post list
        })
            .sort({ createdAt: -1 }) // Sort by most recent post
            .populate({
                path: 'user_id',  // The field to populate
                select: 'username name' // Fields to select from the User model
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

            postObject.liked_at = postLikesMap[post._id.toString()];

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


const getPostsCommented = async (userId) => {
    try {
        // Get the current date and subtract 24 hours to get the date range for likes
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        // Find posts liked by the user in the last 24 hours
        const postLikes = await UserComment.find({
            user_id: userId,
            createdAt: { $gte: last24Hours }  // Filter likes within the last 24 hours
        }).select('post_id createdAt comment_text');  // Only select the post_id field

        if (!postLikes || postLikes.length === 0) {
            return []; // No posts liked in the last 24 hours
        }

        const postLikesMap = postLikes.reduce((acc, like) => {
            acc[like.post_id] = { createdAt: like.createdAt, comment_text: like.comment_text }
            return acc;
        }, {});

        // Extract the post_ids from the postLikes array
        const postIds = postLikes.map(like => like.post_id);

        // Fetch the posts corresponding to the liked post_ids
        const posts = await UserPost.find({
            _id: { $in: postIds } // Get posts that are in the liked post list
        })
            .sort({ createdAt: -1 }) // Sort by most recent post
            .populate({
                path: 'user_id',  // The field to populate
                select: 'username name' // Fields to select from the User model
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

            postObject.userComment = {};
            postObject.userComment.commented_at = postLikesMap[post._id.toString()].createdAt;
            postObject.userComment.comment_text = postLikesMap[post._id.toString()].comment_text;

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

const findUserName = async (userId) => {

    let user = await User.findById(userId);

    // If the user is found, return the name and username

    return {
        name: user.name,
        username: user.username,
        nameElseUsername: user.name.trim() == "" ? user.username : user.name,
    };

};


const findAllUsers = async () => {
    // Fetch all users from the database
    let users = await User.find();

    // Map through the users and return only the necessary fields (_id, name, username, nameElseUsername)
    return users.map(user => ({
        _id: user._id,
        name: user.name,
        username: user.username,
        nameElseUsername: user.name.trim() === "" ? user.username : user.name,
    }));
};



const getQuizResults = async (userId) => {
    try {
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        // Fetch user's quiz results from the database using userId
        const quizResults = await QuizResult.find({
            user_id: userId,
            completed_at: { $gte: last24Hours }
        })
            .sort({ completed_at: -1 })
            .populate({
                path: 'quiz_id', // Populate the quiz details
                select: 'title description' // Fields to select from the Quiz model
            })
            .exec();

        if (!quizResults || quizResults.length === 0) {
            return [];
        }

        return quizResults;
    } catch (error) {
        console.error("Error in getPersonalityQuizResults:", error);
        return [];
    }
};



const getPersonalityQuizResults = async (userId) => {
    try {
        const last24Hours = new Date();
        last24Hours.setHours(last24Hours.getHours() - 24);

        // Fetch user's quiz results from the database using userId
        const quizResults = await PersonalityQuizResult.find({
            user_id: userId,
            createdAt: { $gte: last24Hours }
        })
            .sort({ createdAt: -1 })
            .populate({
                path: 'quiz_id', // Populate the quiz details
                select: 'title' // Fields to select from the PersonalityQuiz model
            })
            .exec();

        if (!quizResults || quizResults.length === 0) {
            return [];
        }

        // // Prepare the response with any necessary details
        // const resultPromises = quizResults.map(async (quizResult) => {
        //     const quizResultObject = quizResult.toObject();

        //     // You can process the `answers` or `result` fields if necessary
        //     // For instance, adding additional information like the options selected, etc.
        //     quizResultObject.quizDetails = quizResultObject.quiz_id; // Add quiz details under quizDetails key
        //     delete quizResultObject.quiz_id; // Remove quiz_id field from the result

        //     // Process the answers field if you need to display the options chosen by the user
        //     // You can also format or analyze the answers based on your specific needs
        //     // quizResultObject.answers = quizResultObject.answers; // (e.g. detailed user answers or selections)

        //     // delete quizResultObject.answers;

        //     return quizResultObject;
        // });

        // const formattedResults = await Promise.all(resultPromises);

        return quizResults;
    } catch (error) {
        console.error("Error in getPersonalityQuizResults:", error);
        return [];
    }
};



const exampleDelta = `[{"insert":"📝 "},{"insert":"Diary Entry - November 25, 2024","attributes":{"bold":true}},{"insert":"\n\n"},{"insert":"Today was quite an eventful day! I started off my morning by forwarding some messages to my friend testu7. It's always nice to share information and keep in touch. 📱\n\nI also sent a quiz result to testu7, which was a bit disappointing for me. Scored 36 out of 100 on the Science Quiz. I guess I need to hit the books harder! 📚😅\n\nLater in the day, I shared some audio and video clips with testu7. It’s a fun way to connect and share moments. 🎧📹\n\nIn the evening, I posted a poll asking how everyone was doing. I genuinely wanted to know! I felt happy when people engaged with it. The content was simple, just \"hiii, how are you doing\". It’s always nice to check in with friends. 😊\n\nI liked some posts today, especially one that resonated with me. The mood was happy, and I couldn't help but comment \"hello\" on it. It feels great to interact with others and share thoughts. 💬\n\nOverall, it was a day filled with connections and sharing. Looking forward to more engaging days ahead!\n\n"},{"insert":"End of Entry","attributes":{"bold":true}},{"insert":"\n"}]`;

try {
    await connectDB();

    // let userId = "66e845248e5cca16bfbb73f4";

    // let currentUserName = (await findUserName(userId)).nameElseUsername;

    let all_users = await findAllUsers();

    console.log(`${all_users.length} users founds!`);

    let entriesAdded = 0;

    for (let user of all_users) {
        let userId = user._id;
        let currentUserName = user.nameElseUsername;

        let messages = await getUserMessagesLast24Hours(userId);

        let postsPosted = await getProfilePosts(userId);


        let postsLiked = await getPostsLiked(userId);

        let postsCommented = await getPostsCommented(userId);


        let quizResults = await getQuizResults(userId);


        let personalityQuizResults = await getPersonalityQuizResults(userId);


        let inputText = "";

        if (messages.length > 0) {

            inputText += `Messages sent by ${currentUserName} today: \n`;


            // console.log(messages);
            let i = 1;
            for (let message of messages) {
                inputText += `${i}) Content: "${message["content"]}", attachments: "${message["attachments"].map(attachment => attachment.url).join(", ")}" to ${message["recipientName"]["isGroupChat"] == true ? "Group:" : "User:"} "${message["recipientName"]["name"].trim() == "" ? message["recipientName"]["username"] : message["recipientName"]["name"]}" at ${message["createdAt"]}\n`;

                i++;
            }
        }

        // console.log(postsPosted);


        if (postsPosted.length > 0) {
            inputText += `\n\nPosts posted by ${currentUserName} today: \n`;

            let i = 1;
            for (let post of postsPosted) {

                inputText += `${i}) ${JSON.stringify(post)}\n`;

                i++;
            }
        }


        if (postsLiked.length > 0) {
            inputText += `\n\nPosts liked by ${currentUserName} today: \n`;

            let i = 1;
            for (let post of postsLiked) {

                inputText += `${i}) ${JSON.stringify(post)}\n`;

                i++;
            }
        }


        if (postsCommented.length > 0) {
            inputText += `\n\nPosts on which ${currentUserName} commented today: \n`;

            let i = 1;
            for (let post of postsCommented) {

                inputText += `${i}) ${JSON.stringify(post)}\n`;

                i++;
            }
        }


        if (quizResults.length > 0) {
            inputText += `\n\nInformational Quizzes that ${currentUserName} took today: \n`;

            let i = 1;
            for (let result of quizResults) {

                inputText += `${i}) ${JSON.stringify(result)}\n`;

                i++;
            }
        }


        if (personalityQuizResults.length > 0) {
            inputText += `\n\nPersonality quizzes that ${currentUserName} took today: \n`;

            let i = 1;
            for (let result of personalityQuizResults) {

                inputText += `${i}) ${JSON.stringify(result)}\n`;

                i++;
            }
        }


        // console.log(postsLiked);

        // console.log(inputText);

        // console.log(personalityQuizResults);

        if (inputText.trim() != "") {




            let openAIResponse = await getChatCompletion({
                messages: [{ role: 'system', content: `Take ${exampleDelta} as example, Use delta format like that (in json) that can be used by flutter_quill to Write a short diary entry from ${currentUserName}'s perspective based on this information: ${inputText}. You can use bold, italic, underline, strike through and all other text forms you want, You should also add headings, emojis to make the diary entry lively and beautiful. Return only json and nothing else. don't surround output with three back ticks and "json" label. directly give output as list of {"insert"}s. new lines should be a separate insert array element like '{"insert":"\\n"}' . the last element of this array should be '{"insert":"\\n"}'. if any message has content like ~~forward~~ then don't add write that message in your response.` }],
                user_message: "",
            });


            // console.log(openAIResponse);

            const newEntry = new PersonalDiary({
                user_id: userId,
                title: moment().subtract(2, 'hours').format('MMMM Do, YYYY'),
                content: JSON.stringify(JSON.parse(openAIResponse)),
            });

            // Save the entry to the database
            await newEntry.save();


            entriesAdded++;

        }



    }

    console.log(`${entriesAdded}/${all_users.length} entries added`);


    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}