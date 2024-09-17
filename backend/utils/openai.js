// utils/openai.js

import { OpenAI } from 'openai';

const openai = null;

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

        return response.data.choices[0].message.content;
    } catch (error) {
        console.error('Error getting chat completion from OpenAI:', error);
        throw new Error('Error getting chat completion from OpenAI');
    }
};
