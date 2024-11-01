import mongoose from 'mongoose';

const quizResultSchema = new mongoose.Schema({
    quiz_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PersonalityQuiz',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    answers: {
        type: mongoose.Schema.Types.Mixed, // json of which options user selected for each question
        required: true
    },
    result: {
        type: String,
        required: true
    },
    completed_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const PersonalityQuizResult = mongoose.model('PersonalityQuizResult', quizResultSchema);


export default PersonalityQuizResult;
