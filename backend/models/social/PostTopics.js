import mongoose from 'mongoose';


// Related Topic Schema
const postTopicsSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true // Ensure unique topic names
    },
    description: {
        type: String
    }
}, {
    timestamps: true,
});

// Function to get all topic names
async function getAllTopicNames() {
    try {
        // Fetch all topics
        const topics = await PostTopics.find({}, '_id name'); // Retrieve only the 'name' field
        // Extract and return names
        return topics.map(topic => ({ id: topic._id, name: topic.name }));
    } catch (error) {
        console.error("Error fetching topic names:", error);
        throw error; // Rethrow the error for further handling if needed
    }
}

const PostTopics = mongoose.model('PostTopic', postTopicsSchema);

export {
    getAllTopicNames, PostTopics
}