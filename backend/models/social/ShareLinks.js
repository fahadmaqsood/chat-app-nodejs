import mongoose from 'mongoose';


// Updated User Post Schema with related topics
const shareLinksSchema = new mongoose.Schema({
    data: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

const ShareLinks = mongoose.model('ShareLinks', shareLinksSchema);

export default ShareLinks;
