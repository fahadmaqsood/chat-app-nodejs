import express from 'express';
import { getAllTopics, createUserPost, getPosts, voteInPoll, getSpecificPost, deletePost } from '../../controllers/social/userPostController.js';
import { likePost, unlikePost, getLikes } from '../../controllers/social/userLikeController.js';
import { createComment, getComments, likeComment, unlikeComment } from '../../controllers/social/usercommentController.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

// Route to create a new post
router.post('/create-post', validateTokensMiddleware, createUserPost);
router.get('/get/posts', validateTokensMiddleware, getPosts);

router.get('/get/:postId', validateTokensMiddleware, getSpecificPost);

// poll
router.post('/vote-in-poll', validateTokensMiddleware, voteInPoll);

// Route to like a post
router.post('/like-post', validateTokensMiddleware, likePost);
router.post('/unlike-post', validateTokensMiddleware, unlikePost);
router.get('/get/likes', validateTokensMiddleware, getLikes);

// Route to comment on a post
router.post('/create-comment', validateTokensMiddleware, createComment);
router.post('/get-comments', validateTokensMiddleware, getComments);

router.post('/like-comment', validateTokensMiddleware, likeComment);
router.post('/unlike-comment', validateTokensMiddleware, unlikeComment);

router.post('/delete-post', validateTokensMiddleware, deletePost);


router.get("/get-all-topics", getAllTopics);

export default router;
