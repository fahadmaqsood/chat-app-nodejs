import express from 'express';
import { createUserPost, getPosts } from '../../controllers/social/userPostController.js';
import { likePost, getLikes } from '../../controllers/social/userLikeController.js';
import { createComment, getComments } from '../../controllers/social/usercommentController.js';

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

const router = express.Router();

// Route to create a new post
router.post('/create-post', validateTokensMiddleware, createUserPost);
router.get('/get/posts', validateTokensMiddleware, getPosts);

// Route to like a post
router.post('/like-post', likePost);
router.get('/get/likes', getLikes);

// Route to comment on a post
router.post('/create-comment', createComment);
router.get('/get/comments', getComments);

export default router;
