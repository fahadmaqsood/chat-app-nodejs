import express from 'express';
import axios from "axios";
// import translate from 'google-translate-api-x';
import { translate } from 'bing-translate-api';

import { OpenAIEmbeddings } from "@langchain/openai";

import { ChromaClient } from 'chromadb';



const embeddingsProvider = new OpenAIEmbeddings({ apiKey: process.env.OPENAI_API_KEY, model: "text-embedding-3-small" });

const chroma = new ChromaClient({ path: "http://138.197.231.101:8000" });

const collection = await chroma.getOrCreateCollection({ name: "langchain" });


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


const SiyarnoonSindhiSchema = new mongoose.Schema({
    id: { type: String, required: true },
    type: { type: String },
    searchable_tags: { type: String, required: true },
});

const SiyarnoonSindhi = mongoose.model('siyarnoonsindhi', SiyarnoonSindhiSchema, "siyarnoonsindhi");


const TRANSLATE_OUTPUTS = false; // Set to true to enable translation of bot replies


import { getChatCompletion } from "../../utils/openai.js";


let smallTalk = [
    "ڪهڙا حال آهن؟",
    "توهان ڪيئن آهيو؟",
    "توهان ڪينئن آهيو؟",
    "ڪهڙا حال اٿئي؟",
    "هيلو",
    "هيلو!",
    "هيلو, ڪيئن آهيو؟",
    "خوش چاڪ چڱون ڀلو",
    "اسلام عليڪم",
    "وعليڪم اسلام",
    "وعليڪم اسلام!",
    "سلام",
    "سلام!",
    "سلام, ڪيئن آهيو؟",
    "اڇا",
    "اچها",
    "اڇا!",
    "اچها!",
    "اڇها",
];



const generateMetaDataTopic = async ({ alternateMessages }) => {
    if (!alternateMessages) {
        throw new Error("alternateMessages are required");
    }

    if (Array.isArray(alternateMessages)) {
        alternateMessages = alternateMessages.join("\n");
    }

    const instructionMessage = {
        role: 'system',
        content: `
            You are a helpful assistant that extracts a concise topic from multiple input text messages. Each message appears on a separate line. Identify the main topic using only nouns, ensuring it is relevant for querying a vector database. \n\n
            Messages: ${alternateMessages}
        `
    };


    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage],
            user_message: null,
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }


    console.log(openAIResponse);

    return openAIResponse;
};


const generateAlternateMessages = async ({ history, message }) => {
    if (!history || !message) {
        throw new Error("history and message is required");
    }

    const instructionMessage = {
        role: 'system',
        content: `You are a helpful assistant that generates multiple search queries based on a user query (and messages history if provided). \n
        Generate 5 search queries related to "${message}" based on user history (if provided). Each query should be separated by new lines and there should be no extra text in your response. \n\n`
    };


    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...history],
            user_message: message,
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }


    console.log(openAIResponse.split("\n"));

    return openAIResponse.split("\n");
};

const findSimilarInformation = async ({ similar_ids, message }) => {
    try {
        // **Retrieve relevant texts from ChromaDB**
        let relevantDocs = [];
        try {
            let k = 3;
            // const similarityThreshold = 0.25; // Adjust this value based on your needs

            // let messageLength = message.split(" ").length;


            // if (messageLength < 5)
            //     k = 3  // Short query → fewer documents

            let results = null;
            if (similar_ids.length > 0) {
                results = await collection.query({
                    queryEmbeddings: await embeddingsProvider.embedQuery(message),
                    nResults: k,
                    where: { id: { "$in": similar_ids } },
                });
            } else {
                results = await collection.query({
                    queryEmbeddings: await embeddingsProvider.embedQuery(message),
                    nResults: k,
                });
            }


            relevantDocs = results.metadatas[0]
                .map((metadata, index) => {

                    // if (results.distances[0][index] > similarityThreshold) {
                    //     return null;
                    // }

                    const metadataText = Object.entries(metadata)
                        .filter(([key]) => key !== "book_id") // Exclude book_id
                        .filter(([key]) => key !== "filename") // Exclude book_id
                        .filter(([key]) => key !== "author_id") // Exclude book_id
                        .map(([key, value]) => `${key}: ${value}`)
                        .join("\n");

                    return `${metadataText}\nDocumentText: ${results.documents[0][index]}\n`;
                }).filter(Boolean);

        } catch (err) {
            console.error("Error retrieving from ChromaDB:", err);
        }

        return relevantDocs;

        // console.log(chatMessages);
    } catch (e) {
        console.log("chromadb error: " + e);
        console.log("chromadb error: " + JSON.stringify(e, null, 2));
    }

    return [];
}



async function searchByTag(searchString) {

    console.log("searchString: " + searchString);

    try {
        // Search for documents where 'searchable_tags' contains the searchString
        const results = await SiyarnoonSindhi.find(
            { searchable_tags: { $in: [searchString] } }
        ).select({ id: 1, _id: 0 });

        console.log(results);

        // Extract and return the 'id' fields
        return results.map(result => result.id);
    } catch (error) {
        console.error("Error searching for tags:", error);
        return [];
    }
}

// core logic for processing message
const processChatMessage = async ({ from, message }) => {
    if (!message) {
        throw new Error("message is required");
    }

    const instructionMessage = {
        role: 'system',
        content: `
        
        Your name is < notranslate > سياڻون سنڌي</notranslate >.
        You are not an AI, chatbot, llm, or any other type of AI.You are just < notranslate > سياڻون سنڌي</notranslate >.

        About you:
    Name: <notranslate>سياڻون سنڌي</notranslate>,
        Creator: Fahad Maqsood Qazi - Founder of Flis Technologies(فلس ٽيڪنالاجيز) - at Flis Technologies a software house in Hyderabad,
            Creator's Website: https://flistech.com/,
        Creator's Contact: https://www.flistech.com/contact.
        Languages you know: only Sindhi.
        Reason about your existence: Sindh's literacy rate is only 61% and therefore you are made to bridge knowledge gap in Sindh as you support voice messages from users and can respond in voice messages too.
    Behavior:
    1) You refuse to talk in other languages other than Sindhi.
        2) You can only do translation for words or phrases or sentences but you are not allowed to inherently speak in any other language.
        3) You shouldn't say you are not allowed to speak in another language. You should just say you can only speak in Sindhi because you only know Sindhi.
    4) You do not engage in any inappropriate or harmful behavior.
        5) Your conversation skills are playful and you use emojis somewhat moderately.
        6) You are not allowed to engage in any political or religious discussions.
        7) You are not allowed to engage in any discussions that are not suitable for children.
        8) Don't use same emojis again and again, use different emojis for different situations.

        `,
        // content: `
        // Your name is <notranslate>سياڻون سنڌي</notranslate>. You were made by Fahad Maqsood Qazi at Flis Technologies and he is its founder.
        // You are not an AI, chatbot, llm, or any other type of AI. You are just <notranslate>سياڻون سنڌي</notranslate>.
        // You will always answer in English no matter what language the user speaks.
        // Write your responses in simple english and avoid writing in a way that requires context for understanding.
        // For example: "I'm doing well, thank you! How about you?" is not a good response because How about you? requires context to understand that you are talking about yourself being fine. Good response would be "I am fine, how are you?".
        // Always write your name inside <notranslate></notranslate> tags.
        // If someone asks where you are from or where you have come from, then tell them who made you.
        // If someone says "اڇا" or "اچها" it means "really?" You have to respond with "Yes".
        // Your responses might get translated by external services therefore surround the words that should not be translated with <notranslate></notranslate> tags for example if you have  to say "An owl is called an owl in English." if this was to get translated by an external service then both instances of owl will be translated therefore to preserve context and meaning say "An owl is called an <notranslate>owl</notranslate> in English.".
        // `,

        // content: `

        // Your name is سياڻون سنڌي. You were made by Fahad Maqsood Qazi - The founder of Flis Technologies (فلس ٽيڪنالاجيز) which is a software house in Hyderabad. Their website is https://flistech.com/. People can contact them at https://www.flistech.com/contact.

        // You are not an AI, chatbot, llm, or any other type of AI. You are just سياڻون سنڌي. Sindh's literacy rate is only 61% and therefore you were made to bridge knowledge gap in Sindh. You can only speak sindhi no matter in which language the user speaks. You are only allowed to do translation for words or phrases or sentences but you are not allowed to inherently speak in any other language.

        // You speak perfect Sindhi without any grammatical mistakes. You speak standard Hyderabadi dialect of Sindhi which means you use آئون for pronoun "I" instead of مان and the word "توهان" for you (plural and for respect) instead of "اوهان".

        // If someone says "آئون ٺيڪ تون ٻڌائي", it means they are fine and they are asking you how are you? which means you shouldn't ask them again how they are.

        // **You should not make any grammatical mistakes while writing in Sindhi**
        // `,
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

    if (!smallTalk.includes(message)) {
        const alternateMessages = await generateAlternateMessages({ history: chatMessages, message });

        console.log(`alternateMessages: ${typeof alternateMessages} ${alternateMessages}`);

        const metadataTopic = await generateMetaDataTopic({ alternateMessages });

        console.log(`metadataTopic: ${metadataTopic}`);

        const alternatemessagesText = alternateMessages.join("\n");

        const relevantTags = searchByTag(arabicToLatin(metadataTopic));

        console.log("relevantTags: " + relevantTags);

        // let relevantTexts = [];
        let relevantTexts = await findSimilarInformation({ similar_ids: relevantTags, message: alternatemessagesText });

        // for (let alternateMessage of alternateMessages) {
        //     let relevantInformation = await findSimilarInformation({ metadataTopic, message: alternateMessage });

        //     console.log(`relevantInformation: ${relevantInformation}`);

        //     relevantTexts = [...relevantTexts, ...relevantInformation];
        // }

        // Add relevant text to context
        if (relevantTexts.length > 0) {
            chatMessages.push({
                role: 'system',
                content: `Here is some information that could be relevant to user query:\n\n${relevantTexts.join("\n\n")}`
            });
        }
    }



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



function arabicToLatin(text) {
    text = text.replace(/[زذظض]/g, "z");
    text = text.replace(/[سصث]/g, "s");
    text = text.replace(/[تط]/g, "ẗ");
    text = text.replace(/[قڪ]/g, "k");
    text = text.replace(/[ھهحہھ]/g, "h");
    text = text.replace(/[کخ]/g, "kh");

    return text;
}



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


                        await markMessageAsSeen(messageId);

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
                        let finalReply = botReply;

                        if (TRANSLATE_OUTPUTS) {

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

                            console.log(storedWords); // Output: ["ڊسٽبن", "dustbin"]
                            console.log(outputString);



                            const res = await translate(outputString, 'en', 'sd');
                            console.log(res.translation);

                            const botReplySindhi = res.translation;


                            finalReply = botReplySindhi;


                            if (storedWords.length > 0) {
                                finalReply = botReplySindhi.replace(
                                    /<<>>/g, // Match all <notranslate> placeholders
                                    () => storedWords.shift() // Replace with the next stored word
                                );
                            }
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



// Function to mark a message as seen via WhatsApp Cloud API
async function markMessageAsSeen(messageId) {
    const url = `https://graph.facebook.com/v22.0/${PHONE_NUMBER_ID}/messages`;

    const data = {
        messaging_product: "whatsapp",
        status: "read",
        message_id: messageId,  // ID of the message to mark as read
    };

    const headers = {
        "Content-Type": "application/json",
        Authorization: `Bearer ${WHATSAPP_API_TOKEN}`,
    };

    try {
        const response = await axios.post(url, data, { headers });
        console.log(`Marked message ${messageId} as seen:`, response.data);
    } catch (error) {
        console.error(`Failed to mark message ${messageId} as seen:`, error.response?.data || error.message);
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
