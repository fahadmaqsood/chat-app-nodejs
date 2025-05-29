import { User } from '../../models/auth/user.models.js';
import BlogPost from '../../models/social/BlogPost.js';
import BlogPostLike from '../../models/social/BlogPostLike.js';
import BlogPostComment from '../../models/social/BlogPostComment.js';

import { PostTopics, getAllTopicNames } from '../../models/social/PostTopics.js';
import { getChatCompletion } from "../../utils/openai.js";

import { SentimentAnalysis } from "../utils/SentimentAnalysis.js";
import { ApiResponse } from '../../utils/ApiResponse.js';

import { addNotification } from '../notification/notificationController.js';


import { bingWebSearch, getWebPages, getImages, getVideos } from "../../utils/bing.js";


import axios from 'axios';

const _sentimentAnalysis = new SentimentAnalysis();


let cache = {
    cached_time: Date.now()
};

getAllTopicNames().then((result) => {
    cache["topicNames"] = result;
    cache["cache_time"] = Date.now();
});


export async function getCachedTopicNames() {
    const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
    const currentTime = Date.now();

    // Check if cache is older than 5 minutes
    if (currentTime - cache.cached_time > fiveMinutes) {
        // console.log("Cache is stale, reloading topic names...");
        cache.topicNames = await getAllTopicNames(); // Reload topic names
        cache.cached_time = currentTime; // Update cache time
    } else {
        // console.log("Using cached topic names.");
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


const moodRecognitionInstructionMsg = (topics, text) => {
    return `Following are the moods or emotions we have for user posts, you have to categorize user post into only one of the moods: ${topics}. \n\n This is the user text: ${text}. Now categorize this text into the above moods and only output one word and that should be from the moods, you should not output anything else only one word.`;
};


export const createBlogPost = async (req, res) => {
    let { title, content, postPrivacy, mood } = req.body;

    const user_id = req.user._id;

    console.log("creating blog post");
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
                user_message: topicRetrievalInstructionMsg(topicNames, `Title: ${title}, Content: ${content}`),
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


            // categorizing post into topics
            let openAIResponse2;
            try {
                openAIResponse2 = await getChatCompletion({
                    messages: [],
                    user_message: moodRecognitionInstructionMsg(Object.keys(_sentimentAnalysis.moodScores), `Title: ${title}, Content: ${content}`),
                });
            } catch (e) {
                throw new ApiResponse(500, {}, e.message);
            }

            // console.log(openAIResponse2);

            if (!openAIResponse2) {
                mood = _sentimentAnalysis.performAnalysis(content)["category"].toLowerCase();
            } else {
                mood = openAIResponse2.toLowerCase();
            }
        }

        const newPost = new BlogPost({
            user_id: user_id,
            title: title,
            content: content,
            mood: mood,
            postPrivacy: postPrivacy,
            topics: topicIds, // Add references to related topics
        });

        const savedPost = await newPost.save();

        const post = await populateAndFormatPost(req, savedPost);


        res.status(201).json(new ApiResponse(201, { post: post }, "Post created successfully"));
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};




const getUserFriendsAndFollowing = async (userId) => {
    const user = await User.findById(userId)
        .populate("followers", "_id")
        .populate("following", "_id")
        .lean()
        .exec();

    if (!user) throw new ApiError(404, "User not found");

    const followingIds = new Set(user.following.map((f) => f._id.toString()));
    const friends = user.followers
        .filter((follower) => followingIds.has(follower._id.toString()))
        .map((friend) => friend._id);

    return { friends, following: user.following.map((f) => f._id) };
};


export const getBlogPosts = async (req, mood, topics, limit = 10, page = 1) => {

    try {
        // Validate input
        if (!mood) {
            return res.status(400).json({ success: false, message: 'Mood is required' });
        }

        const userId = req.user.id; // Assuming authenticated user
        const { friends, following } = await getUserFriendsAndFollowing(userId);


        // Create a base query object
        const query = {
            mood: mood,

            $or: [
                { postPrivacy: { $in: ["public", undefined] } }, // Treat missing as public
                { postPrivacy: "friends", user: { $in: friends } },
                { postPrivacy: "private", user: userId },
            ],
        }; // Filter by mood_status and post privacy




        if (topics) {
            const allTopics = await getCachedTopicNames();
            const topicNames = allTopics.map(topic => topic.name);
            const topicIDs = allTopics.map(topic => topic.id);

            // Check if topics is provided and is an array
            if (topics && Array.isArray(topics)) {

                const topicIdsFromRequest = topics
                    .filter(topic => topicNames.includes(topic)) // Filter only valid topic names
                    .map(topic => {
                        const index = topicNames.indexOf(topic);
                        return topicIDs[index]; // Get corresponding ID
                    });


                query.topics = { $in: topicIdsFromRequest }; // Filter by specific topics if provided
            } else if (topics && typeof topics === "string") {
                const filteredTopic = allTopics.filter((topic) => topic.name == topics);


                if (filteredTopic.length !== 0) {
                    query.topics = { $in: [filteredTopic[0]["id"]] };
                }
            }
        }


        // let posts = await BlogPost.find(query)
        //     .sort({ createdAt: -1 })
        //     .skip(parseInt(limit * (page - 1)))
        //     .limit(limit).exec();


        let posts = await BlogPost.aggregate([
            { $match: query }, // Filter by query
            { $sort: { createdAt: -1 } },
            { $skip: parseInt(limit * (page - 1)) },
            { $limit: 100 }, // Fetch a larger pool for better ranking

            {
                $lookup: {
                    from: "users",
                    localField: "user_id", // Ensure this matches your schema field
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" }, // Convert user array to an object

            {
                $match: {
                    "user._id": { $nin: req.user.blocklist || [] },
                    $expr: {
                        $not: {
                            $in: [req.user._id, "$user.blocklist"]                // OP has NOT blocked current user
                        }
                    }
                }
            },


            // Step 2: Lookup likes count
            {
                $lookup: {
                    from: "BlogPostLike",
                    localField: "_id",
                    foreignField: "post_id",
                    as: "likes"
                }
            },

            // Step 3: Lookup comments count
            {
                $lookup: {
                    from: "BlogPostComment",
                    localField: "_id",
                    foreignField: "post_id",
                    as: "comments"
                }
            },

            // Step 4: Add like and comment counts
            {
                $addFields: {
                    likeCount: { $size: "$likes" },
                    commentCount: { $size: "$comments" }
                }
            },

            // Step 5: Only return required fields
            {
                $project: {
                    likes: 0,
                    comments: 0 // Remove full arrays to save memory
                }
            }
        ]);


        const scorePost = (post) => {
            const engagement = post.likeCount * 3 + post.commentCount * 2;
            const hoursSinceCreation = (Date.now() - new Date(post.createdAt)) / (1000 * 60 * 60);
            const timeDecay = Math.pow(0.9, hoursSinceCreation);
            let priority = 0;

            if (friends.includes(post.user.toString())) priority += 1000; // Highest priority for friends
            else if (following.includes(post.user.toString())) priority += 500; // Medium priority for followings

            return engagement * timeDecay + priority;
        };


        // Rank posts based on the calculated score
        posts.sort((a, b) => {
            console.log(`${scorePost(b)} ${scorePost(a)}`);
            return scorePost(b) - scorePost(a)
        });

        // Prepare the response with numLikes and numComments
        const postPromises = posts.slice(0, limit).map(async (post) => {

            return await populateAndFormatPost(req, post);

        });





        let formattedPosts = await Promise.all(postPromises);

        return formattedPosts;
    } catch (err) {
        console.log(err.message);
        return [];
    }
};


async function populateAndFormatPost(req, _post) {
    let post = await BlogPost.findById(_post._id).populate({
        path: 'user_id', // The field to populate
        select: 'avatar username name email privacySettings notificationSettings' // Fields to select from the User model
    }).populate({
        path: 'topics', // The field to populate
        select: 'name description' // Fields to select from the User model
    });


    const postObject = post.toObject();
    postObject.user = postObject.user_id; // Add user info under user key
    delete postObject.user_id; // Remove user_id field

    // Count likes and comments
    const numLikes = await BlogPostLike.countDocuments({ post_id: post._id });
    const numComments = await BlogPostComment.countDocuments({ post_id: post._id });


    const hasUserLiked = await BlogPostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

    postObject.numLikes = numLikes; // Add numLikes to the post object
    postObject.numComments = numComments; // Add numComments to the post object

    postObject.hasUserLiked = !!hasUserLiked;

    postObject.type = "blog_post";

    return postObject;

}


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}

export const getSpecificBlogPost = async (req, res) => {
    const { postId } = req.params; // Get postId from the URL params

    try {
        // Validate postId
        if (!postId) {
            return res.status(400).json(new ApiResponse(400, {}, 'Post ID is required'));
        }

        // Query the specific post by ID
        const post = await BlogPost.findById(postId);

        // If post is not found, return a 404 response
        if (!post) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Populate the post and format it if needed
        const formattedPost = await populateAndFormatPost(req, post);

        // Return the specific post
        return res.status(200).json(new ApiResponse(200, { post: formattedPost }));
    } catch (err) {
        // Handle errors
        return res.status(500).json(new ApiResponse(500, {}, err.message));
    }
};


export const deleteBlogPost = async (req, res) => {
    const { postId } = req.body; // Get postId from the URL params
    const userId = req.user._id;   // Assume userId is extracted from the request, e.g., via authentication middleware

    try {
        // Validate postId
        if (!postId) {
            return res.status(400).json(new ApiResponse(400, {}, 'Post ID is required'));
        }

        // Find the post by ID
        const post = await BlogPost.findById(postId);

        // If post is not found, return a 404 response
        if (!post) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Check if the user is authorized to delete the post
        if (post.user_id.toString() !== userId.toString()) {
            return res.status(400).json(new ApiResponse(400, {}, 'You can only delete your own posts.;'));
        }

        // Delete the post
        await BlogPost.findByIdAndDelete(postId);

        // Return success response
        return res.status(200).json(new ApiResponse(200, {}, 'Post deleted successfully'));
    } catch (err) {
        // Handle errors
        return res.status(500).json(new ApiResponse(500, {}, err.message));
    }
};