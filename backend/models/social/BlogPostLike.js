import mongoose from 'mongoose';

const blogPostLikeSchema = new mongoose.Schema({
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
    liked_at: {
        type: Date,
        default: Date.now
    }
});

blogPostLikeSchema.index({ post_id: 1, user_id: 1 }, { unique: true });

const BlogPostLike = mongoose.model('BlogPostLike', blogPostLikeSchema);

export default BlogPostLike;