
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


import axios from 'axios';


// Define __dirname manually
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const fetchNews = async (searchTerms, limit) => {
    try {
        const apiToken = process.env.THE_NEWS_API;

        const url = `https://api.thenewsapi.com/v1/news/top?api_token=${apiToken}&search=${searchTerms}&search_fields=title,description,main_text&locale=us&limit=${limit}`;


        const response = await axios.get(url);

        const news = response.data;  // Handle the response data


        return news.data.map((arr) => { arr["type"] = "news"; return arr; });

    } catch (error) {
        console.log(error);
    }
}

try {
    await connectDB();

    const searchTerms = "happy|funny";

    const limit = 5;


    const news = await fetchNews(searchTerms, limit);

    console.log(news);


    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}