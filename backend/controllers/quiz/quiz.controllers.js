import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";

import QuizTopics from "../../models/quiz/QuizTopics.js";
import QuizResult from "../../models/quiz/QuizResult.js";
import Quiz from "../../models/quiz/Quiz.js";



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
