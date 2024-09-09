const mongoose = require('mongoose');

const homeworkAnswerSchema = new mongoose.Schema({
    question_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'HomeworkQuestion',
        required: true
    },
    answer_text: {
        type: String,
        required: true
    },
    ai_generated: {
        type: Boolean,
        default: false
    },
    created_at: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('HomeworkAnswer', homeworkAnswerSchema);
