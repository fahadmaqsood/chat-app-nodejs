import express from 'express';
import { addQuiz, getQuizList, getQuizListByTopic, getTopicList, saveQuizResult, getLeaderBoardByDate, checkIfUserCompletedQuiz, getLeaderboard, getFriendsByScore, searchQuizTopics, getMostPopularQuizzes, searchQuizzesByName } from '../../controllers/quiz/quiz.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

import { getPersonalityQuizList, savePersonalityQuizResult, searchPersonalityQuizzesByName, getMostPopularPersonalityQuizzes, checkIfUserCompletedPersonalityQuiz, addPersonalityQuiz } from '../../controllers/quiz/personalityQuiz.controllers.js'; // Adjust path accordingly


const router = express.Router();


router.get('/get-quiz-list', validateTokensMiddleware, getQuizList);

router.get('/get-quiz-list-by-topic', validateTokensMiddleware, getQuizListByTopic);


router.get('/get-quiz-topics', getTopicList);


router.post('/save-quiz-result', validateTokensMiddleware, saveQuizResult);


router.get('/get-leaderboard', validateTokensMiddleware, getLeaderboard);

router.get('/get-leaderboard-by-date', validateTokensMiddleware, getLeaderBoardByDate);


router.get('/search-quizzes-by-name', validateTokensMiddleware, searchQuizzesByName);

router.get('/popular-quizzes', validateTokensMiddleware, getMostPopularQuizzes);


router.get('/search-quiz-topics', validateTokensMiddleware, searchQuizTopics);

router.get('/get-friends-by-score', validateTokensMiddleware, getFriendsByScore);


router.get('/check-quiz-status', validateTokensMiddleware, checkIfUserCompletedQuiz);


router.post('/add-quiz', addQuiz);




// personality quizzes
router.get('/get-personality-quiz-list', validateTokensMiddleware, getPersonalityQuizList);

router.post('/save-personality-quiz-result', validateTokensMiddleware, savePersonalityQuizResult);

router.get('/search-personality-quizzes-by-name', validateTokensMiddleware, searchPersonalityQuizzesByName);

router.get('/popular-personality-quizzes', validateTokensMiddleware, getMostPopularPersonalityQuizzes);

router.get('/check-personality-quiz-status', validateTokensMiddleware, checkIfUserCompletedPersonalityQuiz);

router.post('/add-personality-quiz', addPersonalityQuiz);

export default router;
