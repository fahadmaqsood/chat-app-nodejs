import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import PersonalityQuizResult from "../../models/quiz/PersonalityQuizResult.js";
import PersonalityQuiz from "../../models/quiz/PersonalityQuiz.js";

import moment from "moment"; // For easier date manipulation

import mongoose from "mongoose";

import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';

// Define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



export const getPersonalityQuizList = async (req, res) => {
    try {
        const { limit, skip } = req.query;

        const quizzes = await PersonalityQuiz.find({
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

export const savePersonalityQuizResult = async (req, res) => {
    try {
        const { quiz_id, answers, result } = req.body;

        const user_id = req.user.id; // Assuming user ID is coming from the authenticated request

        // Validate input
        if (!quiz_id || !answers || !result) {
            return res.status(400).json(new ApiResponse(400, {}, 'Quiz ID, Answers and result are required.'));
        }

        // Check if the quiz exists
        const quizExists = await PersonalityQuiz.findById(quiz_id);
        if (!quizExists) {
            return res.status(404).json(new ApiResponse(404, {}, 'Quiz not found.'));
        }

        // Create a new quiz result
        const quizResult = new PersonalityQuizResult({
            quiz_id,
            user_id,
            answers, // Include the user's answers
            result,
        });

        // Save the quiz result
        await quizResult.save();

        return res.status(201).json(new ApiResponse(201, quizResult, 'Quiz result saved successfully.'));
    } catch (error) {
        console.error(error);
        res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error'));
    }
};



export const searchPersonalityQuizzesByName = async (req, res) => {
    try {
        const { name, limit = 10, skip = 0 } = req.query;

        if (!name) {
            return res.status(400).json(new ApiResponse(400, {}, 'Quiz name is required for searching.'));
        }

        // Use a case-insensitive search on the 'name' field
        const quizzes = await PersonalityQuiz.find({
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




export const getMostPopularPersonalityQuizzes = async (req, res) => {
    try {
        const { limit = 10, skip = 0 } = req.query;

        // Get the timestamp for last Sunday midnight (12:00 AM)
        const lastSundayMidnight = moment().startOf('week').subtract(1, 'week').toDate();

        // Aggregate to get the number of completions per quiz, sorted by most completions, starting from the past week
        const popularQuizzes = await PersonalityQuiz.aggregate([
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


export const checkIfUserCompletedPersonalityQuiz = async (req, res) => {
    try {
        const { quizId } = req.query;

        // Find the quiz result for the user and quiz
        const result = await PersonalityQuizResult.findOne({
            user_id: new mongoose.Types.ObjectId(req.user._id),
            quiz_id: new mongoose.Types.ObjectId(quizId)
        }).lean();


        // If a result is found, return the quiz result data
        if (result) {

            const quizDetails = await PersonalityQuiz.findById(quizId).lean();

            return res.status(200).json(new ApiResponse(200, { quizDetails: quizDetails, ...result }, "User has completed the quiz."));

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









export const addPersonalityQuiz = async (req, res) => {
    try {
        const { json } = req.body;

        // Validate required fields
        if (!json) {
            return res.status(400).json(new ApiResponse(400, {}, 'json for quiz is required'));
        }

        if (!json.title || !json.questions || !json.num_questions) {
            return res.status(400).json(new ApiResponse(400, {}, 'All fields are required: title, questions, num_questions'));
        }

        // Create a new quiz
        const newQuiz = await new PersonalityQuiz({
            title: json.title,
            num_questions: json.num_questions
        });

        // Save the quiz to the database
        await newQuiz.save();

        let quiz_id = newQuiz._id;

        // Save the quiz JSON to a file in public/quizzes/ folder
        const quizFilePath = path.join(__dirname, '../../public/personalityQuizzes', `${quiz_id}.json`);
        fs.writeFileSync(quizFilePath, JSON.stringify(json, null, 2));

        return res.status(201).json(new ApiResponse(201, newQuiz, 'Personality Quiz created successfully.'));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, {}, 'Server encountered an error while creating the quiz.'));
    }
};
