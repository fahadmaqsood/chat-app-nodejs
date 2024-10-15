import express from 'express';
import { Router } from "express";

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';

import { handleChatMessage, getRecentMessages, handleGenerativeAiImages, handleMathSolvingSteps } from '../../controllers/chatbot/chatbotController.js';

const router = Router();

router.post('/get-recent-messages', getRecentMessages);
router.post('/chat', handleChatMessage);

router.get('/generate-ai-image', validateTokensMiddleware, handleGenerativeAiImages);


router.post('/get-math-steps', validateTokensMiddleware, handleMathSolvingSteps);

export default router;