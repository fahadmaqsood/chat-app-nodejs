import mongoose from 'mongoose';

const blogCommentSchema = new mongoose.Schema({
    post_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlogPost',
        required: true
    },
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    parent_comment_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'BlogPostComment',
        default: null
    },
    comment_text: {
        type: String,
        required: true
    },

    likes: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    ] // Array to store user IDs who liked the comment
}, { timestamps: true });

const BlogPostComment = mongoose.model('BlogPostComment', blogCommentSchema);

export default BlogPostComment;