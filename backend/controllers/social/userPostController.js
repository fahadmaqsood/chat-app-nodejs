import { User } from '../../models/auth/user.models.js';
import UserPost from '../../models/social/UserPost.js';
import PostLike from '../../models/social/PostLikes.js';
import UserComment from '../../models/social/UserComment.js';

import { getBlogPosts } from "./blogPostController.js";

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


export const createUserPost = async (req, res) => {
    let { content, attachments, postPrivacy, mood, poll } = req.body;

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


            // categorizing post into topics
            let openAIResponse2;
            try {
                openAIResponse2 = await getChatCompletion({
                    messages: [],
                    user_message: moodRecognitionInstructionMsg(Object.keys(_sentimentAnalysis.moodScores), content),
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

        // Build poll structure if provided
        let pollData = null;
        if (poll && Array.isArray(poll.options) && poll.options.length > 0) {
            pollData = {
                question: poll.question,
                options: poll.options.map(option => ({
                    option: option, // Each string becomes the value for the "option" field
                    votedBy: []     // Initialize the "votedBy" field as an empty array
                }))
            };
        }

        const newPost = new UserPost({
            user_id: user_id,
            content: content,
            attachments: attachments,
            postPrivacy: postPrivacy,
            mood: mood,
            topics: topicIds, // Add references to related topics
            poll: pollData
        });

        const savedPost = await newPost.save();

        const post = await populateAndFormatPost(req, savedPost);


        res.status(201).json(new ApiResponse(201, { post: post }, "Post created successfully"));
    } catch (err) {
        res.status(500).json({ success: false, message: 'Server error', error: err.message });
    }
};

export const voteInPoll = async (req, res) => {
    const { postId, optionId } = req.body; // Get postId and optionId from the request body
    const userId = req.user._id; // Get user ID from the authenticated user

    try {
        // Find the post by its ID
        const post = await UserPost.findById(postId);
        if (!post) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Find the poll option that corresponds to the given optionId
        const option = post.poll.options.find(opt => opt._id.toString() === optionId.toString());
        if (!option) {
            return res.status(404).json(new ApiResponse(404, {}, 'Poll option not found'));
        }

        // Check if the user has already voted
        if (option.votedBy.includes(userId)) {
            return res.status(400).json(new ApiResponse(400, {}, 'User has already voted for this option'));
        }

        // Add the user ID to the votedBy array of the selected option
        option.votedBy.push(userId);

        // Save the updated post
        const savedPost = await post.save();

        if (!req.user._id.equals(post.user_id)) {
            addNotification(post.user_id, `voted on your poll!`, option.option, { doer: req.user._id, additionalData: { open: "post", post_id: postId, option_id: optionId } });
        }

        return res.status(200).json(new ApiResponse(200, savedPost, 'Vote recorded successfully'));
    } catch (err) {
        return res.status(500).json(new ApiResponse(500, {}, 'Server error', err.message));
    }
};


export const getPollVoters = async (req, res) => {
    const { postId } = req.params; // Extract postId from URL params
    let { limit = 10, skip = 0 } = req.query; // Default: limit 10, skip 0

    // Convert query params to integers
    limit = parseInt(limit);
    skip = parseInt(skip);

    try {
        // Fetch the post with voters populated
        const post = await UserPost.findById(postId).populate({
            path: "poll.options.votedBy",
            select: "name username avatar", // Fetch only relevant user fields
        });

        if (!post) {
            return res.status(404).json(new ApiResponse(404, {}, "Post not found"));
        }

        if (!post.poll || !post.poll.options.length) {
            return res.status(404).json(new ApiResponse(404, {}, "Poll not found"));
        }

        // Define option letters (A, B, C, ...)
        const optionLabels = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

        // Extract voters and map them to the required structure
        let votersList = [];
        post.poll.options.forEach((option, index) => {
            const voteLetter = optionLabels[index] || "?"; // Assign letter or fallback
            option.votedBy.forEach(user => {
                votersList.push({
                    _id: user._id,
                    name: user.name,
                    username: user.username,
                    avatar: user.avatar,
                    vote: voteLetter
                });
            });
        });

        // Apply pagination on the final user list
        const paginatedVoters = votersList.slice(skip, skip + limit);

        return res.status(200).json(new ApiResponse(200, { voters: paginatedVoters, totalVoters: votersList.length }, "Voters retrieved successfully"));
    } catch (err) {
        return res.status(500).json(new ApiResponse(500, {}, "Server error", err.message));
    }
};




async function populateAndFormatPost(req, _post) {
    let post = await UserPost.findById(_post._id).populate({
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
    const numLikes = await PostLike.countDocuments({ post_id: post._id });
    const numComments = await UserComment.countDocuments({ post_id: post._id });


    const hasUserLiked = await PostLike.exists({ post_id: post._id, user_id: req.user._id }); // Check if user has liked the post

    postObject.numLikes = numLikes; // Add numLikes to the post object
    postObject.numComments = numComments; // Add numComments to the post object

    postObject.hasUserLiked = !!hasUserLiked;

    postObject.type = "post";

    // handling polls
    if (post.poll && Array.isArray(post.poll.options)) {
        postObject.poll.options = post.poll.options.map((option) => {
            return {
                _id: option._id,
                option: option.option,
                numVotes: option.votedBy.length,
                isVotedByUser: option.votedBy.includes(req.user._id)
            };
        });
    }

    return postObject;

}


function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min)) + min;
}


const fetchNews = async (searchTerms, limit, page = 1) => {
    const apiToken = process.env.THE_NEWS_API;

    const url = `https://api.thenewsapi.com/v1/news/top?api_token=${apiToken}&search=${searchTerms}&search_fields=title,description,main_text&locale=us&limit=${limit}&page=${page}`;


    const response = await axios.get(url);

    const news = response.data;  // Handle the response data

    return news.data.map((arr) => { arr["type"] = "news"; return arr; });
}




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



export const getPosts = async (req, res) => {
    const { mood, topics, start_from = 0, postsNewsPaginationPage = 1 } = req.query;
    const limit = 10;

    console.log(req.query);

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

        let posts = await UserPost.aggregate([
            { $match: query }, // Filter by query
            { $sort: { createdAt: -1 } },
            { $skip: parseInt(start_from) },
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

            // ➕ Add blocked status flags
            {
                $addFields: {
                    "user.hasCurrentUserBlockedThem": {
                        $in: ["$user._id", req.user.blocklist || []]
                    },
                    "user.isCurrentUserBlockedByThem": {
                        $in: [req.user._id, "$user.blocklist"]
                    }
                }
            },


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
                    from: "postlikes",
                    localField: "_id",
                    foreignField: "post_id",
                    as: "likes"
                }
            },

            // Step 3: Lookup comments count
            {
                $lookup: {
                    from: "usercomments",
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

        console.log(posts);



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

        console.log("posts after sorting: ");
        console.log(posts);


        // If we have fewer posts than requested, try to fill in with related moods
        // if (posts.length < limit) {
        //     const currentMoodScore = _sentimentAnalysis.moodScores[mood] ?? 61;
        //     const moodKeys = Object.keys(_sentimentAnalysis.moodScores);
        //     const moodScores = Object.values(_sentimentAnalysis.moodScores);

        //     // Find the index of the current mood score
        //     const currentMoodIndex = moodScores.findIndex(score => score === currentMoodScore);

        //     let relevantMoods = [];

        //     // Collect relevant moods, prioritizing right neighbors first
        //     let leftIndex = currentMoodIndex + 1; // Start from the right neighbor
        //     let rightIndex = currentMoodIndex - 1; // Then check the left neighbor

        //     // Keep fetching until we have enough relevant moods
        //     while (relevantMoods.length < moodKeys.length && (leftIndex < moodScores.length || rightIndex >= 0)) {
        //         // First try to get from the right side (higher scores)
        //         if (leftIndex < moodScores.length) {
        //             relevantMoods.push(moodKeys[leftIndex]);
        //             leftIndex++;
        //         }

        //         // Then check the left side (lower scores)
        //         if (rightIndex >= 0 && relevantMoods.length < limit) {
        //             relevantMoods.push(moodKeys[rightIndex]);
        //             rightIndex--;
        //         }
        //     }

        //     // Fetch additional posts from related moods if needed

        //     while (posts.length < limit && relevantMoods.length > 0) {
        //         // const randomMood = relatedMoods[Math.floor(Math.random() * relatedMoods.length)];
        //         // query.mood = randomMood;

        //         query.mood = relevantMoods[0];


        //         if (topics) {
        //             const allTopics = await getCachedTopicNames();
        //             const topicNames = allTopics.map(topic => topic.name);
        //             const topicIDs = allTopics.map(topic => topic.id);

        //             // Check if topics is provided and is an array
        //             if (topics && Array.isArray(topics)) {

        //                 const topicIdsFromRequest = topics
        //                     .filter(topic => topicNames.includes(topic)) // Filter only valid topic names
        //                     .map(topic => {
        //                         const index = topicNames.indexOf(topic);
        //                         return topicIDs[index]; // Get corresponding ID
        //                     });


        //                 query.topics = { $in: topicIdsFromRequest }; // Filter by specific topics if provided
        //             } else if (topics && typeof topics === "string") {
        //                 const filteredTopic = allTopics.filter((topic) => topic.name == topics);


        //                 if (filteredTopic.length !== 0) {
        //                     query.topics = { $in: [filteredTopic[0]["id"]] };
        //                 }
        //             }
        //         }


        //         const additionalPosts = await UserPost.find(query)

        //             .sort({ createdAt: -1 })
        //             .skip(parseInt(start_from))
        //             .limit(limit - posts.length).exec(); // Limit to what is needed


        //         posts = posts.concat(additionalPosts);



        //         // Remove the used mood from the relatedMoods array
        //         relevantMoods.splice(relevantMoods.indexOf(query.mood), 1);
        //     }
        // }




        // Prepare the response with numLikes and numComments
        const postPromises = posts.slice(0, limit).map(async (post) => {

            return await populateAndFormatPost(req, post);

        });


        let formattedPosts = await Promise.all(postPromises);

        console.log("posts length: ", formattedPosts.length);


        try {
            let blogs = await getBlogPosts(req, mood, topics, 5, postsNewsPaginationPage);

            // Create a new array to hold the posts and blogs in the correct pattern
            let updatedPosts = [];
            let blogIndex = 0;

            if (formattedPosts.length < 2) {
                formattedPosts.push(...blogs);
            } else {

                // Loop through the `formattedPosts` array
                for (let i = 0; i < formattedPosts.length; i++) {
                    // Add the current post
                    updatedPosts.push(formattedPosts[i]);

                    // After every two posts, insert one item from blogs (if there are still blogs items left)
                    if ((i + 1) % 2 === 0 && blogIndex < blogs.length) {
                        updatedPosts.push(blogs[blogIndex]);  // Insert one blogs item
                        blogIndex++;  // Move to the next blogs item
                    }
                }

                updatedPosts.push(...blogs.slice(blogIndex, blogs.length));

                // The `updatedPosts` array now contains the interspersed posts and blogs, so we assign it to `formattedPosts`
                formattedPosts = updatedPosts;
            }
        } catch (error) {
            console.log(error);
        }

        formattedPosts.sort((a, b) => b.createdAt - a.createdAt);

        // try {
        //     let news = [];

        //     if (mood == "happy" || mood == "laughing" || mood == "rofl") {


        //         let searchTerms;
        //         if (topics && Array.isArray(topics)) {
        //             searchTerms = topics;
        //         } else {
        //             searchTerms = ["celebrity", "news", "fashion", "tech"];
        //         }

        //         console.log(searchTerms.join("|"));



        //         news = await fetchNews(searchTerms.join("|"), 5, getRandomInt(parseInt(postsNewsPaginationPage), parseInt(postsNewsPaginationPage) + 100));
        //     } else {



        //         let searchTerms;
        //         if (topics && Array.isArray(topics)) {
        //             searchTerms = topics;
        //         } else {
        //             searchTerms = ["happy", "funny", "peace", "motivational", "inspirational"];
        //         }

        //         console.log(searchTerms.join("|"));

        //         // const news = await fetchNews(searchTerms.join("|"), 5, getRandomInt(parseInt(postsNewsPaginationPage), parseInt(postsNewsPaginationPage) + 100));
        //         let searchResponse = await bingWebSearch(searchTerms.join("|"), postsNewsPaginationPage);

        //         let webPages = getWebPages(searchResponse);
        //         let images = getImages(searchResponse);
        //         let videos = getVideos(searchResponse);

        //         news = [...webPages, ...images, ...videos];

        //         news.sort(() => Math.random() - 0.5);
        //     }


        //     // Create a new array to hold the posts and news in the correct pattern
        //     let updatedPosts = [];
        //     let newsIndex = 0;

        //     if (formattedPosts.length < 2) {
        //         formattedPosts.push(...news);
        //     } else {

        //         // Loop through the `formattedPosts` array
        //         for (let i = 0; i < formattedPosts.length; i++) {
        //             // Add the current post
        //             updatedPosts.push(formattedPosts[i]);

        //             // After every two posts, insert one item from news (if there are still news items left)
        //             if ((i + 1) % 2 === 0 && newsIndex < news.length) {
        //                 updatedPosts.push(news[newsIndex]);  // Insert one news item
        //                 newsIndex++;  // Move to the next news item
        //             }
        //         }

        //         updatedPosts.push(...news.slice(newsIndex, news.length));

        //         // The `updatedPosts` array now contains the interspersed posts and news, so we assign it to `formattedPosts`
        //         formattedPosts = updatedPosts;
        //     }
        // } catch (error) {
        //     console.log(error);
        // }

        res.status(200).json(new ApiResponse(200, { posts: formattedPosts }));
    } catch (err) {
        console.error(err.message);
        res.status(500).json(new ApiResponse(500, {}, err.message));
    }
};


export const getSpecificPost = async (req, res) => {
    const { postId } = req.params; // Get postId from the URL params

    try {
        // Validate postId
        if (!postId) {
            return res.status(400).json(new ApiResponse(400, {}, 'Post ID is required'));
        }

        // Query the specific post by ID
        const post = await UserPost.findById(postId);

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


export const deletePost = async (req, res) => {
    const { postId } = req.body; // Get postId from the URL params
    const userId = req.user._id;   // Assume userId is extracted from the request, e.g., via authentication middleware

    try {
        // Validate postId
        if (!postId) {
            return res.status(400).json(new ApiResponse(400, {}, 'Post ID is required'));
        }

        // Find the post by ID
        const post = await UserPost.findById(postId);

        // If post is not found, return a 404 response
        if (!post) {
            return res.status(404).json(new ApiResponse(404, {}, 'Post not found'));
        }

        // Check if the user is authorized to delete the post
        if (post.user_id.toString() !== userId.toString()) {
            return res.status(400).json(new ApiResponse(400, {}, 'You can only delete your own posts.;'));
        }

        // Delete the post
        await UserPost.findByIdAndDelete(postId);

        // Return success response
        return res.status(200).json(new ApiResponse(200, {}, 'Post deleted successfully'));
    } catch (err) {
        // Handle errors
        return res.status(500).json(new ApiResponse(500, {}, err.message));
    }
};



export const getAllTopics = async (req, res) => {
    const topics = await getCachedTopicNames();


    return res.status(200).json(new ApiResponse(200, { topics }, "Topics retrieved successfully"));
}