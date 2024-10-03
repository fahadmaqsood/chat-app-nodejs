import express from 'express';
import { getQuizList, getQuizListByTopic, getTopicList, saveQuizResult } from '../../controllers/quiz/quiz.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.get('/get-quiz-list', validateTokensMiddleware, getQuizList);

router.get('/get-quiz-list-by-topic', validateTokensMiddleware, getQuizListByTopic);


router.get('/get-quiz-topics', validateTokensMiddleware, getTopicList);


router.post('/save-quiz-result', validateTokensMiddleware, saveQuizResult);

export default router;
