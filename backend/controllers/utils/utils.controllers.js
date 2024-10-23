import jwt from 'jsonwebtoken';
import multer from 'multer';
import path from 'path';
import { ApiResponse } from "../../utils/ApiResponse.js";
import { validateAndRefreshTokens } from '../auth/user.controllers.js';

import { SentimentAnalysis } from "./SentimentAnalysis.js";

import path from 'path';

const _sentimentAnalysis = new SentimentAnalysis();

// Multer setup for image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../../public/uploads/images');

        cb(null, uploadPath); // Specify your upload directory
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${req.userIdForFileName}-${file.originalname}`);
    }
});

const upload = multer({ storage }).array('image', 10); // Handle up to 10 images

const uploadImages = async (req, res) => {
    try {
        // Extract tokens from headers
        const accessToken = req.headers['access-token'];
        const refreshToken = req.headers['refresh-token'];

        // Validate and refresh tokens
        const tokenResponse = await validateAndRefreshTokens(accessToken, refreshToken);
        let newAccessToken = tokenResponse?.accessToken;

        let hasNewAccessToken = true;

        if (!newAccessToken) {
            hasNewAccessToken = false;
            newAccessToken = accessToken;
        }

        // Decode access token to get user ID
        const decodedToken = jwt.decode(newAccessToken);
        const userId = decodedToken._id;

        req.userIdForFileName = userId;

        // Use multer to handle file uploads
        upload(req, res, function (err) {
            if (err) {
                console.log(err);
                return res.status(500).json(new ApiResponse(500, {}, "Error uploading files"));
            }

            // Check if files were uploaded
            if (!req.files || req.files.length === 0) {
                return res.status(400).json(new ApiResponse(400, {}, "No files uploaded"));
            }

            // Prepare the response array with file paths and original names
            const uploadedFiles = req.files.map(file => ({
                originalName: file.originalname,
                filePath: file.path
            }));

            return res
                .status(200)
                .json(new ApiResponse(200, { files: uploadedFiles, ...(hasNewAccessToken ? { accessToken: newAccessToken } : {}) }, "Images uploaded successfully"));
        });
    } catch (err) {
        console.error("Error in uploadImages:", err);
        res.status(500).json(new ApiResponse(500, {}, err.message || "Internal server error"));
    }
};


const sentimentAnalysis = async (req, res) => {

    if (req.body.text) {

        const response = _sentimentAnalysis.performAnalysis(req.body.text);


        return res
            .status(200)
            .json(new ApiResponse(200, { category: response.category }, "Performed Sentiment Analysis Successfully"));
    } else {
        return res.status(500).json(new ApiResponse(500, {}, "No text was provided"));
    }
};

export { uploadImages, sentimentAnalysis };
