// utils/openai.js

import { OpenAI } from 'openai';


let openai = null;

// model = gpt-4o-mini or gpt-3.5-turbo
export const getChatCompletion = async ({ messages, user_message, model = "gpt-4o-mini" }) => {
    try {
        if (!openai) {
            openai = new OpenAI({
                apiKey: process.env.OPENAI_API_KEY,
            });
        }

        let allMessages = [...messages];
        if (user_message !== null) {
            allMessages.push({ role: 'user', content: user_message });
        }
        let totalResponse = '';
        let finishReason = '';

        do {
            const response = await openai.chat.completions.create({
                model: model,
                messages: allMessages,
                max_tokens: 1000, // Increase this limit for longer responses
                temperature: 0.7,
            });

            // console.log("got response", response.choices[0].message.content);
            // console.log("allMessages", allMessages);

            const completion = response.choices[0].message.content;
            totalResponse += completion;
            finishReason = response.choices[0].finish_reason;

            console.log(finishReason);

            // Append the assistant's message to continue the conversation
            allMessages.push({ role: 'assistant', content: completion });

        } while (finishReason === 'length'); // If the response was cut off due to max_tokens, continue the loop

        return totalResponse;
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