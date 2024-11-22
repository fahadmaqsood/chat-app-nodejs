import mongoose from 'mongoose';

const personalDiarySchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true
    },
    content: {
        type: String,
        required: true,
    },
}, { timestamps: true });

const PersonalDiary = mongoose.model('PersonalDiary', personalDiarySchema);

export default PersonalDiary;
