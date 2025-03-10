
import dotenv from "dotenv";

dotenv.config({
    path: "./.env",
});

import connectDB from "./db/index.js";

import https from 'https';

import logger from "./logger/winston.logger.js";

import { retrieveQuizTopicList } from "./controllers/quiz/quiz.controllers.js";
import { getChatCompletion } from "./utils/openai.js";

import Quiz from "./models/quiz/Quiz.js";
import PersonalityQuiz from "./models/quiz/PersonalityQuiz.js";

import mongoose from "mongoose"; // Import mongoose to close the connection


import fs from 'fs';
import path from 'path';

import { fileURLToPath } from 'url';



import { bingWebSearch, getWebPages, getImages, getVideos } from "./utils/bing.js";


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
    // await connectDB();

    // const searchTerms = "happy|funny";

    // const limit = 5;


    // const news = await fetchNews(searchTerms, limit);

    // console.log(news);


    // Call the Bing Search API
    let searchResponse = await bingWebSearch("motivational quotes");


    let webPages = getWebPages(searchResponse);
    let images = getImages(searchResponse);
    let videos = getVideos(searchResponse);

    console.log("webpages: ", webPages.length);
    console.log("images: ", images.length);
    console.log("videos: ", videos.length);

    // console.log(webPages);

    // // Given array
    // const a = [10, 20, 30, 40, 50, 60, 70];

    // // Shuffle the array using reduce() and
    // // math.random() methods
    // a.sort(() => Math.random() - 0.5);

    // // Display the shuffled array in the console
    // console.log("Shuffled Array: ", a);


    // Close the connection after task completion
    // await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    console.log(err);
}