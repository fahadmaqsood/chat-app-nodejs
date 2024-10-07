import express from 'express';
import { getQuizList, getQuizListByTopic, getTopicList, saveQuizResult, getLeaderboard, getFriendsByScore, searchQuizTopics, getMostPopularQuizzes, searchQuizzesByName } from '../../controllers/quiz/quiz.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.get('/get-quiz-list', validateTokensMiddleware, getQuizList);

router.get('/get-quiz-list-by-topic', validateTokensMiddleware, getQuizListByTopic);


router.get('/get-quiz-topics', validateTokensMiddleware, getTopicList);


router.post('/save-quiz-result', validateTokensMiddleware, saveQuizResult);


router.get('/get-leaderboard', validateTokensMiddleware, getLeaderboard);


router.get('/search-quizzes-by-name', validateTokensMiddleware, searchQuizzesByName);

router.get('/popular-quizzes', validateTokensMiddleware, getMostPopularQuizzes);


router.get('/search-quiz-topics', validateTokensMiddleware, searchQuizTopics);

router.get('/get-friends-by-score', validateTokensMiddleware, getFriendsByScore);

export default router;
