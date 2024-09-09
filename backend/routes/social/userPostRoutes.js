const express = require('express');
const router = express.Router();
const userPostController = require('../controllers/userPostController');
const userLikeController = require('../controllers/userLikeController');
const userCommentController = require('../controllers/usercommentController');

// Route to create a new post
router.post('/create-post', userPostController.createUserPost);
router.get('/get/posts', userPostController.getPosts);

// Route to like a post
router.post('/like-post', userLikeController.likePost);
router.get('/get/likes', userLikeController.getLikes);

// Route to comment on a post
router.post('/create-comment', userCommentController.createComment);
router.get('/get/comments', userCommentController.getComments);

module.exports = router;
