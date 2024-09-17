import express from 'express';
import { uploadImages } from '../../controllers/utils/utils.controllers.js'; // Adjust path accordingly

const router = express.Router();


router.post('/upload-images', uploadImages);

export default router;
