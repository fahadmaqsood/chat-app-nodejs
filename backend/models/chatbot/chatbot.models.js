import mongoose, { Schema } from "mongoose";

const chatbotSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ['user', 'chatbot'], required: true },
    subject: { type: String }
}, {
    timestamps: true
});

export default mongoose.model('ChatBot', chatbotSchema);