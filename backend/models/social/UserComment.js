import mongoose from 'mongoose';

const userCommentSchema = new mongoose.Schema({
    post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserPost',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parent_comment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'UserComment',
        default: null
    },
    comment_text: {
        type: String,
        required: true
    }
}, { timestamps: true });

const UserComment = mongoose.model('UserComment', userCommentSchema);

export default UserComment;