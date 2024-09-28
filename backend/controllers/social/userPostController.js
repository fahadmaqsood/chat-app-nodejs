import { User } from '../../models/auth/user.models.js';
import UserPost from '../../models/social/UserPost.js';
import PostLike from '../../models/social/PostLikes.js';
import UserComment from '../../models/social/UserComment.js';

import { PostTopics, getAllTopicNames } from '../../models/social/PostTopics.js';
import { getChatCompletion } from "../../utils/openai.js";

import { SentimentAnalysis } from "../utils/SentimentAnalysis.js";
import { ApiResponse } from '../../utils/ApiResponse.js';

const _sentimentAnalysis = new SentimentAnalysis();


let cache = {
    cached_time: Date.now()
};

getAllTopicNames().then((result) => {
    console.log("result", result);
    cache["topicNames"] = result;
    cache["cache_time"] = Date.now();
});


async function getCachedTopicNames() {
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    const currentTime = Date.now();

    // Check if cache is older than 5 minutes
    if (currentTime - cache.cached_time > fiveMinutes) {
        console.log("Cache is stale, reloading topic names...");
        cache.topicNames = await getAllTopicNames(); // Reload topic names
        cache.cached_time = currentTime; // Update cache time
    } else {
        console.log("Using cached topic names.");
    }

    return cache.topicNames;
}


function findTopicIdByName(allTopics, topicName) {
    const topic = allTopics.find(topic => topic.name === topicName);
    return topic ? topic.id : null; // Return the ID if found, otherwise return null
}

const topicRetrievalInstructionMsg = (topics, text) => {
    return `Following are the topics we have for user posts: ${topics}. \n\n This is the user text: ${text}. Now categorize this text into the above topics and only reply with those topic names (comma-separated) like "topic1, topic2, topic3" nothing else.`;
};


export const createUserPost = async (req, res) => {
    let { content, attachments, mood, poll } = req.body;

    const user_id = req.user._id;

    console.log(user_id);

    try {
        const user = await User.findById(user_id);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        const allTopics = await getCachedTopicNames();
        console.log(allTopics);
        const topicNames = allTopics.map(topic => topic.name);
        console.log(topicNames);


        // categorizing post into topics
        let openAIResponse;
        try {
            openAIResponse = await getChatCompletion({
                messages: [],
                user_message: topicRetrievalInstructionMsg(topicNames, content),
            });
        } catch (e) {
            throw new ApiResponse(500, {}, e.message);
        }

        console.log(openAIResponse);

        if (!openAIResponse) {
            openAIResponse = "generic";
        }

        const topicNamesArray = openAIResponse.split(',').map(name => name.trim());
        const topicIds = topicNamesArray.map(topicName => findTopicIdByName(allTopics, topicName)).filter(id => id); // Filter out null IDs

        console.log("topic ids", topicIds);


        if (!mood || mood == "") {
            mood = _sentimentAnalysis.performAnalysis(content)["category"].toLowerCase();
        }


        // Build poll structure if provided
        let pollData = null;
        if (poll && Array.isArray(poll.options) && poll.options.length > 0) {
            pollData = {
                question: poll.question,
                options: poll.options.map(option => ({
                    option: option.option,
                    votedBy: [] // Initialize with an empty array
                }))
            };
        }

        const newPost = new UserPost({
            user_id: user_id,
            content: content,
            attachments: attachments,
            mood: mood,
            topics: topicIds, // Add references to related topics
            poll: pollData
        });

        const savedPost = await newPost.save();

        res.status(201).json(new ApiResponse(201, savedPost, "Post created successfully"));
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

export const getPosts = async (req, res) => {
    const { mood, topics, start_from = 0 } = req.query;
    const limit = 10;

    try {
        // Validate input
        if (!mood) {
            return res.status(400).json({ success: false, message: 'Mood is required' });
        }

        // Create a base query object
        const query = { mood: mood }; // Filter by mood_status



        if (topics) {
            const allTopics = await getCachedTopicNames();
            console.log(allTopics);
            const topicNames = allTopics.map(topic => topic.name);
            console.log(topicNames);

            // Check if topics is provided and is an array
            if (topics && Array.isArray(topics)) {
                query.topics = { $in: topics }; // Filter by specific topics if provided
            }
        }
        let posts = await UserPost.find(query)
            .populate({
                path: 'user_id', // The field to populate
                select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
            })
            .populate({
                path: 'topics', // The field to populate
                select: 'name description' // Fields to select from the User model
            })
            .sort({ created_at: -1 })
            .skip(parseInt(start_from))
            .limit(limit);


        // If we have fewer posts than requested, try to fill in with related moods
        if (posts.length < limit) {
            const currentMoodScore = _sentimentAnalysis.moodScores[mood] ?? 61;
            const moodKeys = Object.keys(_sentimentAnalysis.moodScores);
            const moodScores = Object.values(_sentimentAnalysis.moodScores);

            // Find the index of the current mood score
            const currentMoodIndex = moodScores.findIndex(score => score === currentMoodScore);

            let relevantMoods = [];

            // Collect relevant moods, prioritizing right neighbors first
            let leftIndex = currentMoodIndex + 1; // Start from the right neighbor
            let rightIndex = currentMoodIndex - 1; // Then check the left neighbor

            // Keep fetching until we have enough relevant moods
            while (relevantMoods.length < moodKeys.length && (leftIndex < moodScores.length || rightIndex >= 0)) {
                // First try to get from the right side (higher scores)
                if (leftIndex < moodScores.length) {
                    relevantMoods.push(moodKeys[leftIndex]);
                    leftIndex++;
                }

                // Then check the left side (lower scores)
                if (rightIndex >= 0 && relevantMoods.length < limit) {
                    relevantMoods.push(moodKeys[rightIndex]);
                    rightIndex--;
                }
            }

            let relatedMoods = relevantMoods;

            // Fetch additional posts from related moods if needed
            while (posts.length < limit && relatedMoods.length > 0) {
                const randomMood = relatedMoods[Math.floor(Math.random() * relatedMoods.length)];
                query.mood = randomMood;

                const additionalPosts = await UserPost.find(query)
                    .populate({
                        path: 'user_id',
                        select: 'avatar username name email privacySettings notificationSettings'
                    })
                    .populate({
                        path: 'topics',
                        select: 'name description'
                    })
                    .sort({ created_at: -1 })
                    .limit(limit - posts.length); // Limit to what is needed


                posts = posts.concat(additionalPosts);

                // Remove the used mood from the relatedMoods array
                relatedMoods.pop(randomMood);
            }
        }


        // Prepare the response with numLikes and numComments
        const postPromises = posts.map(async (post) => {
            const postObject = post.toObject();
            postObject.user = postObject.user_id; // Add user info under user key
            delete postObject.user_id; // Remove user_id field

            // Count likes and comments
            const numLikes = await PostLike.countDocuments({ post_id: post._id });
            const numComments = await UserComment.countDocuments({ post_id: post._id });


            const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

            postObject.numLikes = numLikes; // Add numLikes to the post object
            postObject.numComments = numComments; // Add numComments to the post object

            postObject.hasUserLiked = !!hasUserLiked;

            return postObject;
        });

        // const formattedPosts = posts.map(post => {
        //     const postObject = post.toObject();
        //     postObject.user = postObject.user_id; // Add user info under user key
        //     delete postObject.user_id; // Remove user_id field
        //     return postObject;
        // });

        const formattedPosts = await Promise.all(postPromises);


        res.status(200).json(new ApiResponse(200, formattedPosts));
    } catch (err) {
        res.status(500).json(new ApiResponse(500, {}, err.message));
    }
};