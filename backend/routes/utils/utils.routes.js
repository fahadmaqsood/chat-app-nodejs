import express from 'express';
import { uploadImages, sentimentAnalysis } from '../../controllers/utils/utils.controllers.js'; // Adjust path accordingly

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = express.Router();


router.post('/upload-images', uploadImages);

router.post('/sentiment-analysis', validateTokensMiddleware, sentimentAnalysis);

export default router;
