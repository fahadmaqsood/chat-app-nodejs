
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


const personalityExampleQuiz = {
    "title": "Which Historical Figure Are You Most Like?",
    "num_questions": 6,
    "questions": [
        {
            "question": "What inspires you the most?",
            "options": [
                {
                    "text": "A strong vision for the future",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "The power of peace",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Justice and equality",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "The pursuit of knowledge",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        },
        {
            "question": "What is your approach to leadership?",
            "options": [
                {
                    "text": "Lead from the front",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "Inspire others through example",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Focus on principles and fairness",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "Encourage creativity in others",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        },
        {
            "question": "What quality do you admire most in others?",
            "options": [
                {
                    "text": "Courage",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "Compassion",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Integrity",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "Ingenuity",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        },
        {
            "question": "How do you define success?",
            "options": [
                {
                    "text": "Achieving great things",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "Making a positive impact",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Ensuring fairness",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "Creating something new",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        },
        {
            "question": "What’s your idea of a great accomplishment?",
            "options": [
                {
                    "text": "Leading a great army",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "Uniting people for a cause",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Establishing laws for justice",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "Inventing a groundbreaking idea",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        },
        {
            "question": "What do you think is the most important legacy?",
            "options": [
                {
                    "text": "Conquering new lands",
                    "points": {
                        "Alexander the Great": 2
                    }
                },
                {
                    "text": "Inspiring non-violence",
                    "points": {
                        "Mahatma Gandhi": 2
                    }
                },
                {
                    "text": "Ensuring civil rights",
                    "points": {
                        "Abraham Lincoln": 2
                    }
                },
                {
                    "text": "Leaving behind art and inventions",
                    "points": {
                        "Leonardo da Vinci": 2
                    }
                }
            ]
        }
    ],
    "result_logic": {
        "Alexander the Great": "You are a bold leader, ambitious and driven to make your mark!",
        "Mahatma Gandhi": "You believe in the power of peace and non-violence to bring change.",
        "Abraham Lincoln": "You value justice and equality, always striving for fairness.",
        "Leonardo da Vinci": "You are a creative thinker, always seeking to learn and innovate."
    }
};

const num_questions = [8, 10, 12];

const randomNumQuestions = num_questions[Math.floor(Math.random() * num_questions.length)];


let personalityQuizInstructionMessage = `${JSON.stringify(personalityExampleQuiz)} use the template given above to generate a personality quiz, you can choose the topic however you like. num_questions must be ${randomNumQuestions}. Your output should be valid JSON, there shouldn't be any extra text. there should be no mistakes in JSON. it should be parsable. PLEASE NO MISTAKES IN JSON! `;


try {
    await connectDB();

    console.log("Adding Personality Quizzes")

    let personalityQuizzesAdded = 0;

    for (let i = 0; i < 3; i++) {

        let instructionMessage = personalityQuizInstructionMessage;


        try {
            let titleExists = false;
            let json;
            do {

                if (titleExists) {
                    instructionMessage += ` Personality Quiz with title: '${json.title}' already exists, don't make a quiz related to that. `;
                }


                console.log("generating completion");

                let openAIResponse = await getChatCompletion({
                    messages: [{ role: 'system', content: instructionMessage }],
                    user_message: "",
                });

                // console.log(openAIResponse);

                json = JSON.parse(openAIResponse);

                json.num_questions = json.questions.length;
                // json.difficulty = randomDifficulty;
                // json.topic = quizTopic._id;


                titleExists = await PersonalityQuiz.exists({ title: json.title });

                if (titleExists == null) {
                    titleExists = false;
                } else {
                    titleExists = true;
                }

                console.log("exists: ", titleExists);

                if (!titleExists) {

                    // adding this new quiz
                    const newQuiz = new PersonalityQuiz({
                        title: json.title,
                        num_questions: json.num_questions
                    });

                    // Save the quiz to the database
                    await newQuiz.save();


                    let quiz_id = newQuiz._id;

                    const quizFilePath = path.join(__dirname, './public/personalityQuizzes', `${quiz_id}.json`);
                    fs.writeFileSync(quizFilePath, JSON.stringify(json, null, 2));


                    personalityQuizzesAdded++;
                } else {
                    console.log("Personality quiz title already exists.");
                }


            } while (titleExists == true)


            console.log("quiz added");

        } catch (e) {
            console.log(e.message);
        }
    }


    console.log(`${personalityQuizzesAdded} personality quizzes added.`);


    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}