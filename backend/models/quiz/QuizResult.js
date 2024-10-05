import mongoose from 'mongoose';

const quizResultSchema = new mongoose.Schema({
    quiz_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Quiz',
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
    timeTaken: {
        type: Number, // time in seconds
        required: true,
    },
    correctAnswers: {
        type: Number,
        required: true
    },
    score: {
        type: Number,
        required: true
    },
    completed_at: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

const QuizResult = mongoose.model('QuizResult', quizResultSchema);


export default QuizResult;
