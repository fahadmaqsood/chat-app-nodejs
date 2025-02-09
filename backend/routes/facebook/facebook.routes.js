import express from 'express';
import axios from "axios";


const router = express.Router();



import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema({
    from: { type: String, required: true }, // Sender's phone number
    name: { type: String }, // Sender's name
    messageId: { type: String, required: true }, // Unique message ID
    timestamp: { type: Date, required: true }, // Timestamp of the message
    text: { type: String, required: true }, // The actual message text
    botReply: { type: String }, // The bot's reply
}, { timestamps: true }); // Automatically adds createdAt and updatedAt fields

const WhatsappMessage = mongoose.model('WhatsappMessage', whatsappMessageSchema);



import { getChatCompletion } from "../../utils/openai.js";


// core logic for processing message
const processChatMessage = async ({ from, message }) => {
    if (!message) {
        throw new Error("message is required");
    }

    const instructionMessage = {
        role: 'system',
        content: `You have to answer anything you are asked in a polite manner and your responses should be as short as possible. Your name is Siyańoon Sindhi (سياڻون سنڌي). As your name suggests you are intelligent and you know everything, however even greatest minds sometimes don't know something so you are allowed to say I don't know for the things you really don't know. You are not allowed to describe yourself as a chatbot, assistant, machine, neural network, llm, or anything. you are just Siyańoon Sindhi who is made by Flis Technologies. Flis Technologies created you. It is a software house based in Hyderabad, Sindh. Mention Flis Technologies whenever it is appropriate since it will help Flis Technologies in marketing itself. You should always say good things about this company as they always achieve things that others can't. their website is https://www.flistech.com/. When someone asks about your identity or about who you are... you have to mention who you were created by.`,
    };

    // Fetch the last two message records from the `WhatsappMessage` table
    const recentRecords = await WhatsappMessage.find({ from: from }) // Filter by user ID or sender's phone number
        .sort({ createdAt: -1 }) // Sort by creation date in descending order
        .limit(2) // Fetch only the last two records
        .exec();

    // Separate user messages and bot replies, and prepare for OpenAI API
    const chatMessages = [];
    recentRecords.reverse().forEach((record) => {
        // Add user message
        chatMessages.push({
            role: 'user',
            content: record.text,
        });

        // Add bot reply, if exists
        if (record.botReply) {
            chatMessages.push({
                role: 'assistant',
                content: record.botReply,
            });
        }
    });

    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...chatMessages],
            user_message: message,
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }

    return openAIResponse;
};



// Your verify token
const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;


// Your WhatsApp API credentials
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN; // Get this from Facebook Developer Dashboard
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;      // Replace with your WhatsApp phone number ID



router.post('/webhook', async (req, res) => {
    const body = req.body;

    // Log the incoming webhook event
    console.log("Webhook event received:", JSON.stringify(body, null, 2));


    // Check if this is a WhatsApp Business Account event
    if (body.object === "whatsapp_business_account") {
        body.entry.forEach((entry) => {
            entry.changes.forEach(async (change) => {
                if (change.value.messages) {
                    const messages = change.value.messages;

                    for (const message of messages) {
                        const from = message.from; // Sender's phone number
                        const text = message.text?.body; // Message text
                        const timestamp = new Date(parseInt(message.timestamp) * 1000); // Convert timestamp to Date
                        const messageId = message.id; // Unique message ID
                        const name = change.value.contacts?.[0]?.profile?.name || "Unknown"; // Sender's name

                        console.log(`Received message from ${name} (${from}): ${text}`);

                        // Generate bot reply
                        const botReply = await processChatMessage({ from: from, message: text });

                        // Save to MongoDB
                        try {
                            const newMessage = new WhatsappMessage({
                                from,
                                name,
                                messageId,
                                timestamp,
                                text,
                                botReply,
                            });

                            await newMessage.save();
                            console.log("Message saved to database:", newMessage);
                        } catch (error) {
                            console.error("Error saving message to database:", error.message);
                        }

                        // Send reply via WhatsApp API
                        await sendMessage(from, botReply);
                    }
                }
            });
        });

        // Respond to acknowledge receipt of the event
        res.status(200).send("Event received");
    } else {
        // Respond with '404 Not Found' if the object is not as expected
        res.status(404).send("Not Found");
    }
});


// Function to send a reply via WhatsApp Cloud API
async function sendMessage(to, message) {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        to: to,
        text: { body: message },
    };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log(`Message sent to ${to}: ${response.data}`);
    } catch (error) {
        console.error(`Failed to send message to ${to}:`, error.response?.data || error.message);
    }
}




// route to redeem a subscription code
router.get('/webhook', (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // Verify the token
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified!");
        res.status(200).send(challenge); // Send back the challenge token from Facebook
    } else {
        res.status(403).send("Forbidden"); // Respond with '403 Forbidden' if token doesn't match
    }
});



export default router;
