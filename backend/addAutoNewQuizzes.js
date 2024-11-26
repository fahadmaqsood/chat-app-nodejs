
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

    let quizzesAdded = 0;

    let quizTopics = await retrieveQuizTopicList(100, 0);

    if (quizTopics.length > 0) {

        const difficulties = ['easy', 'medium', 'hard', 'extra hard'];
        const num_questions = [6, 8, 10, 12];

        for (let quizTopic of quizTopics) {
            // console.log(quizTopic.name);

            let openAIResponse;

            const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
            const randomNumQuestions = num_questions[Math.floor(Math.random() * num_questions.length)];


            let instructionMessage = `${JSON.stringify(exampleQuiz)} Choose any specific subtopic from the topic "${quizTopic.name}" and name the title of quiz as the subtopic name only and generate a quiz in the format given above with difficulty ${randomDifficulty} and number of questions ${randomNumQuestions}. the json's topic should have value "${quizTopic._id}". Your output should be valid JSON, there shouldn't be any extra text. there should be no mistakes in JSON. it should be parsable.`;

            try {
                console.log("generating quiz, length: " + instructionMessage.length);

                try {


                    let json;
                    let titleExists = false;

                    do {

                        if (titleExists) {
                            instructionMessage += ` Quiz with title: '${json.title}' already exists. `;
                        }

                        openAIResponse = await getChatCompletion({
                            messages: [{ role: 'system', content: instructionMessage }],
                            user_message: "",
                            model: "gpt-4o-mini"
                        });

                        console.log(openAIResponse);


                        json = JSON.parse(openAIResponse);

                        json.num_questions = json.questions.length;
                        json.difficulty = randomDifficulty;
                        json.topic = quizTopic._id;


                        titleExists = await Quiz.exists({ title: json.title });

                        if (!titleExists) {

                            // console.log(json);
                            // adding this new quiz
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
                            const quizFilePath = path.join(__dirname, './public/quizzes', `${quiz_id}.json`);
                            fs.writeFileSync(quizFilePath, JSON.stringify(json, null, 2));

                            quizzesAdded += 1;
                        } else {
                            console.log("title already exists");
                        }

                    } while (titleExists == true);


                } catch (error) {
                    console.log(error);
                }



            } catch (e) {
                console.log(e.message);
            }
        }

    }


    console.log(`${quizzesAdded} quizzes were added.`)

    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}