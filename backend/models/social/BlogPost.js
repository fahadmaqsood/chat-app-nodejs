import mongoose from 'mongoose';


// Updated User Post Schema with related topics
const blogPostSchema = new mongoose.Schema({
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
    mood: {
        type: String
    },
    postPrivacy: {
        type: String,
        enum: ['public', "friends", 'private'],
        required: true,
    },
    topics: [{  // Array of references to related topics
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PostTopic'
    }],
}, {
    timestamps: true,
});

const BlogPost = mongoose.model('BlogPost', blogPostSchema);

export default BlogPost;
