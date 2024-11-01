import mongoose from 'mongoose';

const personalityQuizSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    num_questions: {
        type: Number,
        required: true,
    }
}, { timestamps: true });

const PersonalityQuiz = mongoose.model('PersonalityQuiz', personalityQuizSchema);

export default PersonalityQuiz;
