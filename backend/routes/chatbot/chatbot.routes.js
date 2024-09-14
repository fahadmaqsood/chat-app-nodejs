import express from 'express';
import { Router } from "express";

import { handleChatMessage, getRecentMessages } from '../../controllers/chatbot/chatbotController.js';

const router = Router();

router.post('/get-recent-messages', getRecentMessages);
router.post('/chat', handleChatMessage);


export default router;