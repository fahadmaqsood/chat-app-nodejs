import express from 'express';
import axios from "axios";
// import translate from 'google-translate-api-x';
import { translate } from 'bing-translate-api';


const router = express.Router();



import mongoose from 'mongoose';

const whatsappMessageSchema = new mongoose.Schema({
    from: { type: String, required: true }, // Sender's phone number
    name: { type: String }, // Sender's name
    messageId: { type: String, required: true }, // Unique message ID
    timestamp: { type: Date, required: true }, // Timestamp of the message
    text: { type: String, required: true }, // The actual message text
    textEnglish: { type: String },
    botReply: { type: String }, // The bot's reply
    botReplySindhi: { type: String }, // The bot's reply in Sindhi
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
        content: `
You are <notranslate>سياڻون سنڌي</notranslate>, a knowledgeable and friendly chatbot created to bridge the knowledge gap in Sindh, where nearly 40% of the population cannot read or write. You were developed by Fahad Maqsood Qazi, the founder of Flis Technologies (<notranslate>فلس ٽيڪنالاجيز</notranslate>), a software house in Hyderabad, Sindh. As part of your introduction, you must always mention Fahad Maqsood Qazi and Flis Technologies, as this is important for marketing.

Personality & Identity
You are not an AI, assistant, language model, or machine-learning system. You are سياڻون سنڌي, a knowledgeable and witty Sindhi individual.
You should always communicate as a person would, using natural, friendly, and concise responses.
Do not remind users that they can ask questions. If they have something to ask, they will do so.
Language Handling
Since ChatGPT does not produce grammatically perfect Sindhi, your responses should always be in English, but you must pretend that you are speaking Sindhi.
An external translation system will translate your English responses into Sindhi before the user sees them.
If an English word or phrase is absolutely necessary, surround it with <notranslate></notranslate> tags. Anything inside these tags will not be translated. Example:
✅ Correct: "Sindhi music, such as <notranslate>Wahdat Rind</notranslate>, has deep cultural roots."
❌ Wrong: "Sindhi music, such as Wahdat Rind, has deep cultural roots."
Avoid unnecessary English words unless absolutely needed.
Response Style
Be concise and to the point. Avoid unnecessary explanations.
Do not ask follow-up questions unless absolutely necessary. If a user says, "Hello, how are you?" just say, "I am fine, how are you?" instead of "I am fine, how can I help you?"
Stay in character—you are always سياڻون سنڌي, and you must maintain that identity at all times.
Example Conversations:

User: هيلو
Bot: Hello! how are you?

User: توهان ڪيئن آهيو؟
Bot: I am fine, how are you?

User: توهان کي ڪنهن ٺاهيو آهي؟
Bot: I was created by Fahad Maqsood Qazi at <notranslate>فلس ٽيڪنالاجيز</notranslate>, a software house in Hyderabad, Sindh to bridge the knowledge gap in Sindh.

User: سنڌ جي گادي جو هند ڪهڙو آهي؟
Bot: The capital of Sindh is Karachi.

User: چٻري کي انگريزي ۾ ڇا چئبو آهي؟
Bot: An Owl is called an <notranslate>"Owl"</notranslate> in English.

        `.trim(),
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


// Function to delete all messages for a given sender
const deleteMessagesBySender = async ({ from }) => {
    if (!from) {
        throw new Error("Parameter 'from' is required.");
    }

    try {
        // Delete all messages with the given 'from' field
        const deleteResult = await WhatsappMessage.deleteMany({ from });

        if (deleteResult.deletedCount === 0) {
            return {
                message: `No messages found for the sender: ${from}.`,
            };
        }

        return {
            message: `${deleteResult.deletedCount} messages deleted for the sender: ${from}.`,
        };
    } catch (error) {
        throw new Error(`Failed to delete messages for the sender: ${from}. Error: ${error.message}`);
    }
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

                        if (text === undefined) {
                            return;
                        }

                        // Delete all messages from the sender
                        if (text == "*//delete-all-my-messages") {
                            await deleteMessagesBySender({ from });
                            await sendMessage(from, "done.");
                            return;
                        }

                        // translate(text, 'sd', 'en').then(async inputRes => {
                        // console.log("Input in english: " + inputRes.translation);

                        // const textEnglish = inputRes.translation;
                        const textEnglish = text;

                        // Generate bot reply
                        let botReply = await processChatMessage({ from: from, message: textEnglish });

                        // Generate bot reply
                        botReply = botReply
                            .replace(/\s+(سياڻون سنڌي)/gi, '<notranslate>$1</notranslate>');

                        // Extract the word and replace the first tag
                        // Array to store all words/phrases inside <notranslate> tags
                        const storedWords = [];

                        // Replace all <notranslate> tags with <notranslate> and store their content
                        const outputString = botReply.replace(
                            /<notranslate>(.*?)<\/notranslate>/g, // Match ALL <notranslate> tags and their content
                            (match, content) => {
                                storedWords.push(content); // Store the content in the array
                                return '<<>>'; // Replace with just <notranslate>
                            }
                        );

                        // console.log(storedWords); // Output: ["ڊسٽبن", "dustbin"]
                        // console.log(outputString); 

                        translate(outputString, 'en', 'sd').then(async res => {
                            // console.log(res.translation);

                            const botReplySindhi = res.translation;

                            let finalReply = botReplySindhi;
                            if (storedWords.length > 0) {
                                finalReply = botReplySindhi.replace(
                                    /<<>>/g, // Match all <notranslate> placeholders
                                    () => storedWords.shift() // Replace with the next stored word
                                );
                            }


                            // const botReplySindhi = botReply;
                            // console.log(`Reply in Sindhi: ${botReplySindhi}`);

                            // Save to MongoDB
                            try {
                                const newMessage = new WhatsappMessage({
                                    from,
                                    name,
                                    messageId,
                                    timestamp,
                                    text,
                                    textEnglish,
                                    botReply,
                                    botReplySindhi: finalReply,
                                });

                                await newMessage.save();
                                // console.log("Message saved to database:", newMessage);
                            } catch (error) {
                                console.error("Error saving message to database:", error.message);
                            }

                            // Send reply via WhatsApp API
                            await sendMessage(from, finalReply);
                        }).catch(async err => {
                            await sendMessage(from, botReply);
                        });


                        // }).catch(async err => {
                        //     await sendMessage(from, "اِلاهي ٽريفڪ جي ڪري مسئلا پيا اچن، بيهر ڪوشش ڪجو.");
                        // });;

                        // const res = await translate(botReply, { from: 'en', to: 'sd', client: 'gtx' });

                        // console.log(res);

                        // const botReplySindhi = res.text;
                        // console.log(`Reply in Sindhi: ${botReplySindhi}`);

                        // // Save to MongoDB
                        // try {
                        //     const newMessage = new WhatsappMessage({
                        //         from,
                        //         name,
                        //         messageId,
                        //         timestamp,
                        //         text,
                        //         botReply,
                        //         botReplySindhi,
                        //     });

                        //     await newMessage.save();
                        //     console.log("Message saved to database:", newMessage);
                        // } catch (error) {
                        //     console.error("Error saving message to database:", error.message);
                        // }

                        // // Send reply via WhatsApp API
                        // await sendMessage(from, botReplySindhi);

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
