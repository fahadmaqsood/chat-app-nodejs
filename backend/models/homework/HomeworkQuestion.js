const mongoose = require('mongoose');

const homeworkQuestionSchema = new mongoose.Schema({
    subject_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HomeworkSubject',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    question_text: {
        type: String,
        required: true
    },
    uploaded_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('HomeworkQuestion', homeworkQuestionSchema);
