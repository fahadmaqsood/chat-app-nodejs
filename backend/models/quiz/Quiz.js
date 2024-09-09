const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema({
    quiz_title: {
        type: String,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Quiz', quizSchema);
