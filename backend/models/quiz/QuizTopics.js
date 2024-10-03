
import mongoose from 'mongoose';

const quizTopicsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    description: {
        type: String,
        required: true
    }
});

const QuizTopics = mongoose.model('QuizTopics', quizTopicsSchema);


export default QuizTopics;