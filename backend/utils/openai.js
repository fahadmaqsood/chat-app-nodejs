// utils/openai.js

import { OpenAI } from 'openai';


let openai = null;

// Function to get chat completion from OpenAI
export const getChatCompletion = async ({ messages, user_message }) => {
    try {
        if (!openai) {
            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY, // Make sure to set this in your environment variables
            });
        }

        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo', // or another model if you prefer
            messages: [
                ...messages,
                { role: 'user', content: user_message },
            ],
            max_tokens: 150, // Adjust as needed
            temperature: 0.7, // Adjust as needed
        });

        console.log(response);

        return response.choices[0].message.content;
    } catch (error) {
        console.error('Error getting chat completion from OpenAI:', error);
        throw new Error('Error getting chat completion from OpenAI');
    }
};




// Function to generate three images from a text description
export const generateImagesFromText = async ({ description }) => {
    try {
        if (!openai) {
            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY, // Ensure this is set in your environment variables
            });
        }

        // Request to generate images based on text description
        const response = await openai.images.generate({
            prompt: description, // Text description for generating the images
            n: 1, // Number of images to generate
            size: '512x512', // Image size (can be '256x256', '512x512', or '1024x1024')
        });


        console.log(response);

        // Return the URLs of the generated images
        return response.data.map(image => image.url);
    } catch (error) {
        console.error('Error generating images from text:', error);
        throw new Error('Error generating images from text ' + error.message);
    }
};