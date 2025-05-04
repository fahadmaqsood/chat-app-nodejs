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

export default WhatsappMessage;