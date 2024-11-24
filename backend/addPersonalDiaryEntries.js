
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { retrieveQuizTopicList } from "./controllers/quiz/quiz.controllers.js";
import { getChatCompletion } from "./utils/openai.js";

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


const exampleQuiz = {
    "title": "General Knowledge Quiz",
    "topic": "general_knowledge",
    "difficulty": "medium",
    "num_questions": 2,
    "questions": [
        {
            "question": "Who wrote 'Hamlet'?",
            "options": [
                "Leo Tolstoy",
                "Mark Twain",
                "William Shakespeare",
                "Charles Dickens"
            ],
            "correct_option": 3
        },
        {
            "question": "What is the largest ocean on Earth?",
            "options": [
                "Atlantic Ocean",
                "Indian Ocean",
                "Arctic Ocean",
                "Pacific Ocean"
            ],
            "correct_option": 4
        }
    ]
};


try {
    await connectDB();



    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}