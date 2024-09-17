import multer from 'multer';
import path from 'path';
import { ApiResponse } from "../../utils/ApiResponse.js";
import { validateAndRefreshTokens } from '../auth/user.controllers.js';

// Multer setup for image storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/uploads/images'); // Specify your upload directory
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage }).array('images', 10); // Handle up to 10 images

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

        // Validate userId from the request body
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json(new ApiResponse(false, "userId is required"));
        }

        // Use multer to handle file uploads
        upload(req, res, function (err) {
            if (err) {
                return res.status(500).json(new ApiResponse(false, {}, "Error uploading files"));
            }

            // Check if files were uploaded
            if (!req.files || req.files.length === 0) {
                return res.status(400).json(new ApiResponse(false, {}, "No files uploaded"));
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

export { uploadImages };
