const mongoose = require('mongoose');

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
    score: {
        type: Number,
        required: true
    },
    completed_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('QuizResult', quizResultSchema);
