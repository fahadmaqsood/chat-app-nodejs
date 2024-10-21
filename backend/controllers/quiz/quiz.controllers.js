import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import QuizTopics from "../../models/quiz/QuizTopics.js";
import QuizResult from "../../models/quiz/QuizResult.js";
import Quiz from "../../models/quiz/Quiz.js";

import moment from "moment"; // For easier date manipulation

import mongoose from "mongoose";

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

// Define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const getTopicList = async (req, res) => {
    try {
        const { limit, skip } = req.query;

        // Prepare the query
        let query = QuizTopics.find({}).sort({ createdAt: -1 });

        // Only apply skip and limit if they are defined
        if (skip) {
            query = query.skip(Number(skip));
        }
        if (limit) {
            query = query.limit(Number(limit));
        }

        // Execute the query
        const topics = await query.exec();

        return res.status(200).json(new ApiResponse(200, topics, "Topics fetched successfully"));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};



export const getQuizList = async (req, res) => {
    try {
        const { limit, skip } = req.query;

        const quizzes = await Quiz.find({
        }).populate({
            path: 'topic', // The field to populate
            select: 'name description' // Fields to select from the topic model
        })
            .sort({ createdAt: -1 })
            .skip(Number(skip || 0))
            .limit(Number(limit || 15))
            .exec();

        return res.status(200).json(new ApiResponse(200, quizzes, "fetched successfully"));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};


export const getQuizListByTopic = async (req, res) => {
    try {
        const { limit, skip, topic } = req.query;

        if (!topic) {
            return res.status(404).json(new ApiResponse(404, {}, 'Topic is required'));
        }

        const topicDoc = await QuizTopics.findOne({ name: topic }).select('_id');

        if (!topicDoc) {
            return res.status(404).json(new ApiResponse(404, {}, 'Topic not found'));
        }

        // Find the quizzes where the related topic's name matches the provided topic
        const quizzes = await Quiz.find({
            topic: topicDoc._id // Use a MongoDB query that looks for quizzes with a topic name that matches the provided 'topic'
        }).populate({
            path: 'topic',
            match: { name: topic }, // Filter quizzes by the 'name' field in the Topic model
            select: 'name description' // Fields to select from the Topic model
        })
            .sort({ createdAt: -1 })
            .skip(Number(skip || 0))
            .limit(Number(limit || 15))
            .exec();

        return res.status(200).json(new ApiResponse(200, quizzes, "fetched successfully"));

    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};





export const saveQuizResult = async (req, res) => {
    try {
        const { quiz_id, score, timeTaken, correctAnswers, answers } = req.body;

        const user_id = req.user.id; // Assuming user ID is coming from the authenticated request

        // Validate input
        if (!quiz_id || score === undefined || !timeTaken || !correctAnswers || !answers) {
            return res.status(400).json(new ApiResponse(400, {}, 'Quiz ID, Score, Time Taken, Correct Answers, and Answers are required.'));
        }

        // Check if the quiz exists
        const quizExists = await Quiz.findById(quiz_id);
        if (!quizExists) {
            return res.status(404).json(new ApiResponse(404, {}, 'Quiz not found.'));
        }

        // Create a new quiz result
        const quizResult = new QuizResult({
            quiz_id,
            user_id,
            correctAnswers,
            timeTaken,
            answers, // Include the user's answers
            score,
        });

        // Save the quiz result
        await quizResult.save();

        return res.status(201).json(new ApiResponse(201, quizResult, 'Quiz result saved successfully.'));
    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};




export const getLeaderboard = async (req, res) => {
    try {
        const { by_time, limit = 30, skip = 0 } = req.query;

        // Determine the date filter based on the "by_time" parameter
        let dateFilter = {};
        if (by_time === 'week') {
            // Get the current date and time, and calculate the last Sunday at 12:00 AM
            const today = moment().startOf('day'); // Start of today
            const lastSunday = today.day(0).startOf('day'); // Get last Sunday at 12:00 AM

            console.log(lastSunday);
            console.log(lastSunday.toDate());

            // Set the filter to include only results after last Sunday midnight
            dateFilter = {
                createdAt: { $gte: lastSunday.toDate() }
            };
        }

        // Aggregate scores by user
        const leaderboardResults = await QuizResult.aggregate([
            {
                $match: dateFilter // Filter by date if specified
            },
            {
                $group: {
                    _id: '$user_id', // Group by user_id
                    totalScore: { $sum: '$score' }, // Sum the scores
                }
            },
            {
                $lookup: {
                    from: 'users', // Ensure this matches your User model collection name
                    localField: '_id',
                    foreignField: '_id',
                    as: 'userDetails'
                }
            },
            {
                $unwind: '$userDetails' // Unwind user details
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    totalScore: 1,
                    name: '$userDetails.name',
                    username: '$userDetails.username',
                    avatar: '$userDetails.avatar',
                    country: '$userDetails.country',
                }
            },
            {
                $sort: { totalScore: -1 } // Sort by totalScore in descending order
            },
            {
                $skip: Number(skip) // Skip for pagination
            },
            {
                $limit: Number(limit) // Limit results
            }
        ]).exec();

        return res.status(200).json(new ApiResponse(200, leaderboardResults, 'Leaderboard fetched successfully'));
    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};



export const searchQuizzesByName = async (req, res) => {
    try {
        const { name, limit = 10, skip = 0 } = req.query;

        if (!name) {
            return res.status(400).json(new ApiResponse(400, {}, 'Quiz name is required for searching.'));
        }

        // Use a case-insensitive search on the 'name' field
        const quizzes = await Quiz.find({
            title: { $regex: name, $options: 'i' } // 'i' for case-insensitive search
        })
            .sort({ createdAt: -1 }) // Sort by most recent quizzes
            .skip(Number(skip)) // Skip for pagination
            .limit(Number(limit)) // Limit for pagination
            .exec();

        // Check if any quizzes were found
        if (quizzes.length === 0) {
            return res.status(404).json(new ApiResponse(404, [], 'No quizzes found.'));
        }

        return res.status(200).json(new ApiResponse(200, quizzes, 'Quizzes fetched successfully.'));
    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};




export const getMostPopularQuizzes = async (req, res) => {
    try {
        const { limit = 10, skip = 0 } = req.query;

        // Get the timestamp for last Sunday midnight (12:00 AM)
        const lastSundayMidnight = moment().startOf('week').subtract(1, 'week').toDate();

        // Aggregate to get the number of completions per quiz, sorted by most completions, starting from the past week
        const popularQuizzes = await Quiz.aggregate([
            {
                $lookup: {
                    from: 'quizresults', // Reference the QuizResult collection
                    localField: '_id',
                    foreignField: 'quiz_id',
                    as: 'completions',
                }
            },
            {
                $addFields: {
                    completionsInWeek: {
                        $size: {
                            $filter: {
                                input: '$completions',
                                as: 'completion',
                                cond: { $gte: ['$$completion.createdAt', lastSundayMidnight] } // Filter completions from the past week
                            }
                        }
                    },
                    totalCompletions: { $size: '$completions' }, // Total completions for the quiz

                    userHasCompleted: {
                        $cond: {
                            if: {
                                $gt: [
                                    {
                                        $size: {
                                            $filter: {
                                                input: '$completions',
                                                as: 'completion',
                                                cond: {
                                                    $and: [
                                                        { $eq: ['$$completion.user_id', new mongoose.Types.ObjectId(req.user._id)] }, // Match userId
                                                        { $eq: ['$$completion.quiz_id', '$_id'] }  // Match quizId
                                                    ]
                                                }
                                            }
                                        }
                                    },
                                    0
                                ]
                            },
                            then: true,
                            else: false
                        }
                    }
                }
            },
            {
                $sort: {
                    completionsInWeek: -1, // First, sort by the number of completions in the past week (descending)
                    totalCompletions: -1,  // Then sort by total completions (descending) for overall popularity
                    createdAt: -1          // Finally, sort by the creation date to break ties

                }
            },
            {
                $skip: Number(skip) // Pagination: Skip
            },
            {
                $limit: Number(limit) // Pagination: Limit
            },
            {
                $project: {
                    completionsInWeek: 1, // Show completions in the past week
                    totalCompletions: 1,  // Show total completions
                    title: 1,              // Include quiz name or other fields you want to display
                    topic: 1,
                    difficulty: 1,
                    num_questions: 1,
                    userHasCompleted: 1,   // Show whether the user has completed the quiz
                    createdAt: 1
                }
            }
        ]).exec();

        // Check if any quizzes were found
        if (popularQuizzes.length === 0) {
            return res.status(404).json(new ApiResponse(404, [], 'No popular quizzes found.'));
        }

        return res.status(200).json(new ApiResponse(200, popularQuizzes, 'Popular quizzes fetched successfully.'));
    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};





// Function to search for quiz topics by name
export const searchQuizTopics = async (req, res) => {
    try {
        const { searchTerm, limit, skip } = req.query;

        if (!searchTerm) {
            return res.status(400).json(new ApiResponse(400, {}, "Search term is required"));
        }

        // Use a case-insensitive regex search to find topics with the matching name
        let query = QuizTopics.find({
            name: { $regex: searchTerm, $options: 'i' } // 'i' for case-insensitive
        }).sort({ createdAt: -1 }); // Sort by creation date (newest first)

        // Apply skip and limit if provided
        if (skip) {
            query = query.skip(Number(skip));
        }
        if (limit) {
            query = query.limit(Number(limit));
        }

        const topics = await query.exec();

        return res.status(200).json(new ApiResponse(200, topics, "Topics fetched successfully"));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, {}, "Server encountered an error"));
    }
};




export const getFriendsByScore = async (req, res) => {
    try {
        const userId = req.user._id; // Extract userId from route params
        const { limit = 15, skip = 0 } = req.query; // Pagination values from query params

        // Get the current date and calculate the last Sunday at 12:00 AM
        const today = moment().startOf('day'); // Start of today
        const lastSunday = today.day(0).startOf('day'); // Last Sunday at 12:00 AM

        // Fetch the user's followers and following lists
        const user = await User.findById(userId)
            .populate('followers', 'name username avatar') // Populate followers
            .populate('following', 'name username avatar') // Populate following
            .lean()
            .exec();

        if (!user) {
            return res.status(404).json(new ApiResponse(404, {}, 'User not found'));
        }

        // Create a Set of the user's following IDs
        const followingIds = new Set(user.following.map(follow => follow._id.toString()));

        // Find mutual friends (people who follow you and you follow them back)
        const mutualFriends = user.followers.filter(follower => {
            return followingIds.has(follower._id.toString());
        });

        if (mutualFriends.length === 0) {
            return res.status(200).json(new ApiResponse(200, [], 'No mutual friends found.'));
        }

        // Get mutual friend IDs
        const mutualFriendIds = mutualFriends.map(friend => friend._id);

        const friendsLeaderboard = await User.aggregate([
            {
                $match: { _id: { $in: mutualFriendIds } } // Match mutual friends
            },
            {
                $lookup: {
                    from: 'quizresults', // Reference the 'quizresults' collection
                    let: { userId: '$_id' }, // Use user ID
                    pipeline: [
                        {
                            $match: {
                                $expr: { $eq: ['$user_id', '$$userId'] }, // Match user ID
                                createdAt: { $gte: lastSunday.toDate() } // Only get scores from the past week
                            }
                        },
                        {
                            $group: {
                                _id: null,
                                totalScore: { $sum: '$score' } // Sum scores
                            }
                        }
                    ],
                    as: 'quizResults' // Save results here
                }
            },
            {
                $unwind: { path: '$quizResults', preserveNullAndEmptyArrays: true } // Unwind, but keep those without scores
            },
            {
                $project: {
                    _id: 0,
                    userId: '$_id',
                    name: '$name',
                    username: '$username',
                    avatar: '$avatar',
                    totalScore: { $ifNull: ['$quizResults.totalScore', 0] } // Default score of 0 if no quiz
                }
            },
            {
                $sort: { totalScore: -1 } // Sort by total score in descending order
            },
            {
                $skip: Number(skip), // Pagination
            },
            {
                $limit: Number(limit), // Limit the results
            }
        ]).exec();

        return res.status(200).json(new ApiResponse(200, friendsLeaderboard, 'Friends leaderboard fetched successfully'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, {}, 'Something went wrong while fetching friends leaderboard.'));
    }
};




export const checkIfUserCompletedQuiz = async (req, res) => {
    try {
        const { quizId } = req.query;

        // Find the quiz result for the user and quiz
        const result = await QuizResult.findOne({
            user_id: new mongoose.Types.ObjectId(req.user._id),
            quiz_id: new mongoose.Types.ObjectId(quizId)
        });


        // If a result is found, return the quiz result data
        if (result) {

            const quizDetails = await Quiz.findById(quizId);

            result["quizDetails"] = quizDetails;

            return res.status(200).json(new ApiResponse(200, result, "User has completed the quiz."));

        } else {
            // If no result is found, return a message indicating the user hasn't completed the quiz
            return res.status(404).json(new ApiResponse(404, {}, "User hasn't completed the quiz"));
        }
    } catch (error) {
        console.error(error);
        return {
            status: 500,
            data: {},
            message: "Server error while checking quiz completion."
        };
    }
};









export const addQuiz = async (req, res) => {
    try {
        const { json } = req.body;

        // Validate required fields
        if (!json) {
            return res.status(400).json(new ApiResponse(400, {}, 'json for quiz is required'));
        }

        if (!json.title || !json.topic || !json.difficulty || !json.questions || !json.num_questions) {
            return res.status(400).json(new ApiResponse(400, {}, 'All fields are required: title, topic, difficulty, questions, num_questions'));
        }

        // // Check if the topic exists
        // const topicDoc = await QuizTopics.findOne({ name: topic });
        // if (!topicDoc) {
        //     return res.status(404).json(new ApiResponse(404, {}, 'Topic not found.'));
        // }

        // Create a new quiz
        const newQuiz = new Quiz({
            title: json.title,
            topic: json.topic, // Reference the topic by its ID
            difficulty: json.difficulty,
            questions: json.questions, // Assuming questions is an array of question objects
            num_questions: json.num_questions
        });

        // Save the quiz to the database
        await newQuiz.save();

        let quiz_id = newQuiz._id;

        // Save the quiz JSON to a file in public/quizzes/ folder
        const quizFilePath = path.join(__dirname, '../../public/quizzes', `${quiz_id}.json`);
        fs.writeFileSync(quizFilePath, JSON.stringify(json, null, 2));

        return res.status(201).json(new ApiResponse(201, newQuiz, 'Quiz created successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error while creating the quiz.'));
    }
};
