
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
        const num_questions = [6, 7, 8];

        for (let quizTopic of quizTopics) {
            // console.log(quizTopic.name);

            let openAIResponse;

            const randomDifficulty = difficulties[Math.floor(Math.random() * difficulties.length)];
            const randomNumQuestions = num_questions[Math.floor(Math.random() * num_questions.length)];


            const instructionMessage = `${JSON.stringify(exampleQuiz)} Choose any specific subtopic from the topic "${quizTopic.name}" and name the title of quiz as the subtopic name only and generate a quiz in the format given above with difficulty ${randomDifficulty} and number of questions ${randomNumQuestions}. the json's topic should have value "${quizTopic._id}". Your output should be valid JSON, there shouldn't be any extra text. there should be no mistakes in JSON. it should be parsable.`;

            try {
                console.log("generating quiz, length: " + instructionMessage.length);
                openAIResponse = await getChatCompletion({
                    messages: [{ role: 'system', content: instructionMessage }],
                    user_message: "",
                });

                //console.log(openAIResponse);

                try {
                    let json = JSON.parse(openAIResponse);

                    json.num_questions = json.questions.length;
                    json.difficulty = randomDifficulty;
                    json.topic = quizTopic._id;

                    const titleExists = await Quiz.exists({ title: json.title });

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
                } catch (error) {
                    console.log(error);
                }



            } catch (e) {
                console.log(e.message);
            }
        }

    }


    console.log(`${quizzesAdded} quizzes were added.`)

    // console.log("Adding Personality Quizzes")

    // let personalityQuizzesAdded = 0;

    // for (let i = 0; i < 3; i++) {

    //     let personalityQuizInstructionMessage = `
    //         {
    //             "title": "Which Historical Figure Are You Most Like?",
    //             "num_questions": 6,
    //             "questions": [
    //                 {
    //                 "question": "What inspires you the most?",
    //                 "options": [
    //                     {
    //                     "text": "A strong vision for the future",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "The power of peace",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Justice and equality",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "The pursuit of knowledge",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 },
    //                 {
    //                 "question": "What is your approach to leadership?",
    //                 "options": [
    //                     {
    //                     "text": "Lead from the front",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Inspire others through example",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Focus on principles and fairness",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Encourage creativity in others",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 },
    //                 {
    //                 "question": "What quality do you admire most in others?",
    //                 "options": [
    //                     {
    //                     "text": "Courage",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Compassion",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Integrity",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Ingenuity",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 },
    //                 {
    //                 "question": "How do you define success?",
    //                 "options": [
    //                     {
    //                     "text": "Achieving great things",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Making a positive impact",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Ensuring fairness",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Creating something new",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 },
    //                 {
    //                 "question": "What’s your idea of a great accomplishment?",
    //                 "options": [
    //                     {
    //                     "text": "Leading a great army",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Uniting people for a cause",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Establishing laws for justice",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Inventing a groundbreaking idea",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 },
    //                 {
    //                 "question": "What do you think is the most important legacy?",
    //                 "options": [
    //                     {
    //                     "text": "Conquering new lands",
    //                     "points": {
    //                         "Alexander the Great": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Inspiring non-violence",
    //                     "points": {
    //                         "Mahatma Gandhi": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Ensuring civil rights",
    //                     "points": {
    //                         "Abraham Lincoln": 2
    //                     }
    //                     },
    //                     {
    //                     "text": "Leaving behind art and inventions",
    //                     "points": {
    //                         "Leonardo da Vinci": 2
    //                     }
    //                     }
    //                 ]
    //                 }
    //             ],
    //             "result_logic": {
    //                 "Alexander the Great": "You are a bold leader, ambitious and driven to make your mark!",
    //                 "Mahatma Gandhi": "You believe in the power of peace and non-violence to bring change.",
    //                 "Abraham Lincoln": "You value justice and equality, always striving for fairness.",
    //                 "Leonardo da Vinci": "You are a creative thinker, always seeking to learn and innovate."
    //             }
    //         }

    //         use the template given above to generate a personality quiz, you can choose the topic however you like. num_questions must be 7. 
    //     `;


    //     try {
    //         let openAIResponse = await getChatCompletion({
    //             messages: [{ role: 'system', content: personalityQuizInstructionMessage }],
    //             user_message: "",
    //         });

    //         console.log(openAIResponse);

    //         try {
    //             let json = JSON.parse(openAIResponse);

    //             json.num_questions = json.questions.length;
    //             // json.difficulty = randomDifficulty;
    //             // json.topic = quizTopic._id;

    //             // adding this new quiz
    //             const newQuiz = new PersonalityQuiz({
    //                 title: json.title,
    //                 num_questions: json.num_questions
    //             });

    //             // Save the quiz to the database
    //             await newQuiz.save();


    //             let quiz_id = newQuiz._id;

    //             const quizFilePath = path.join(__dirname, '../../public/personalityQuizzes', `${quiz_id}.json`);
    //             fs.writeFileSync(quizFilePath, JSON.stringify(json, null, 2));


    //             personalityQuizzesAdded++;
    //         } catch (error) {
    //             console.log(error);
    //         }

    //     } catch (e) {
    //         console.log(e.message);
    //     }
    // }


    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}