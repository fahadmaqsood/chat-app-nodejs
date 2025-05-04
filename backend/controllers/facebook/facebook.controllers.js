import mongoose from "mongoose";
import axios from "axios";

import { getChatCompletion } from "../../utils/openai.js";
import WhatsappMessage from "../../models/facebook/WhatsappMessage.models.js";


const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN;
const WHATSAPP_API_TOKEN = process.env.WHATSAPP_API_TOKEN; // Get this from Facebook Developer Dashboard
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;      // Replace with your WhatsApp phone number ID


export const whatsappAPIWebhook = async (req, res) => {
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
                            await markMessageAsSeen(messageId);
                            await deleteMessagesBySender({ from });
                            await sendMessage(from, "done.");
                            return;
                        }

                        // translate(text, 'sd', 'en').then(async inputRes => {
                        // console.log("Input in english: " + inputRes.translation);

                        // const textEnglish = inputRes.translation;
                        const textEnglish = text;


                        await markMessageAsSeen(messageId);

                        // Generate bot reply
                        let botReply = await processChatMessage({ from: from, message: textEnglish });
                        let finalReply = botReply;


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
};




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


// Main function for processing chat messages
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
        9) If someone asks you about yourself, you have to tell your creators name, and the company name and the reason you were made.
        10) Sindhi has two ways of saying "I" - "آئون" and "مان". You have to use "آئون" for pronoun "I" instead of "مان".

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
        .limit(5) // Fetch only the last two records
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

    // if (!smallTalk.includes(message)) {
    //     const alternateMessages = await generateAlternateMessages({ history: chatMessages, message });

    //     console.log(`alternateMessages: ${typeof alternateMessages} ${alternateMessages}`);

    //     const metadataTopic = await generateMetaDataTopic({ alternateMessages, chatMessages });

    //     console.log(`metadataTopic: ${metadataTopic}`);

    //     if (metadataTopic != null && metadataTopic != "" && metadataTopic != undefined && metadataTopic != "none" && metadataTopic != "None") {

    //         const alternatemessagesText = alternateMessages.join("\n");

    //         // const relevantTags = await searchByTag(arabicToLatin(metadataTopic));
    //         const relevantTags = await searchByTag(metadataTopic);

    //         console.log("relevantTags: " + relevantTags);

    //         // let relevantTexts = [];
    //         let relevantTexts = await findSimilarInformation({ similar_ids: relevantTags, message: alternatemessagesText });

    //         // for (let alternateMessage of alternateMessages) {
    //         //     let relevantInformation = await findSimilarInformation({ metadataTopic, message: alternateMessage });

    //         //     console.log(`relevantInformation: ${relevantInformation}`);

    //         //     relevantTexts = [...relevantTexts, ...relevantInformation];
    //         // }

    //         // Add relevant text to context
    //         if (relevantTexts.length > 0) {
    //             chatMessages.push({
    //                 role: 'system',
    //                 content: `Here is some information that could be relevant to user query:\n\n${relevantTexts.join("\n\n")}`
    //             });
    //         }
    //     }
    // }



    // Get response from OpenAI API
    let openAIResponse;

    try {
        openAIResponse = await getChatCompletion({
            messages: [instructionMessage, ...chatMessages],
            user_message: message,
            model: "gpt-4.1-mini"
        });

    } catch (e) {
        throw new ApiResponse(500, {}, e.message);
    }

    return openAIResponse;
};
