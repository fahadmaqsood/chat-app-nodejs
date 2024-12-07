import mongoose from 'mongoose';


// Updated User Post Schema with related topics
const shareLinksSchema = new mongoose.Schema({
    type: {
        type: String,
        required: true
    },
    data: {
        type: String,
        required: true,
    },
    social_media_title: {
        type: String
    },

    social_media_content: {
        type: String
    },

    social_media_picture: {
        type: String
    },
}, {
    timestamps: true,
});

const ShareLinks = mongoose.model('ShareLinks', shareLinksSchema);

export default ShareLinks;
