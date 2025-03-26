import mongoose from 'mongoose';


// Updated User Post Schema with related topics
const userPostSchema = new mongoose.Schema({
    user_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    content: {
        type: String,
        required: function () {
            // Content is required if there are no poll options and no attachments
            return !(
                (this.poll && this.poll.options && this.poll.options.length > 0) ||
                (this.attachments && this.attachments.length > 0)
            );
        }
    },
    postPrivacy: {
        type: String,
        enum: ['public', "friends", 'private'],
        required
    },
    attachments: [{  // Array of URLs for attachments
        type: String
    }],
    mood: {
        type: String
    },
    topics: [{  // Array of references to related topics
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PostTopic'
    }],
    poll: {
        question: {
            type: String,
            required: function () { return this.poll && this.poll.options && this.poll.options.length > 0; } // Only required if poll exists
        },
        options: [{
            option: {
                type: String,
                required: true
            },
            votedBy: [{
                type: mongoose.Schema.Types.ObjectId,
                ref: 'User'
            }]
        }] // Array of poll options, each with its own votedBy array
    }
}, {
    timestamps: true,
});

const UserPost = mongoose.model('UserPost', userPostSchema);

export default UserPost;
