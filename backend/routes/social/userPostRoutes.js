import express from 'express';
import { createUserPost, getPosts, voteInPoll, getSpecificPost } from '../../controllers/social/userPostController.js';
import { likePost, unlikePost, getLikes } from '../../controllers/social/userLikeController.js';
import { createComment, getComments } from '../../controllers/social/usercommentController.js';

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

export default router;
