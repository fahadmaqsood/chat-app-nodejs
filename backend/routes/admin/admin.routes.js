import express from 'express';
import { reportUser } from '../../controllers/reports/userReport.controllers.js';

import { loginAdmin, addAdmin, removeAdmin, changeRole, resetPassword, updateUserReportStatus, deleteMessageCloseMessageReport, closeMessageReportWithMessage, updateMessageReportStatus, terminateUserCloseMessageReport, terminateUserCloseReport, closeComplaintWithMessage } from '../../controllers/admin/admin.controllers.js';


import { Admin } from "../../models/auth/admin.models.js";

import jwt from "jsonwebtoken";



export const validateTokensMiddleware = async (req, res, next) => {
    try {
        const accessToken = req.cookies.accessToken;
        const refreshToken = req.cookies.refreshToken;


        if (!accessToken || !refreshToken) {
            if (!accessToken || !refreshToken) throw new Error("Tokens missing");

        }

        const decodedAccessToken = jwt.decode(accessToken);
        const decodedRefreshToken = jwt.decode(refreshToken);
        if (!decodedAccessToken || !decodedRefreshToken) if (!accessToken || !refreshToken) throw new Error("Invalid tokens!");




        const userId = decodedAccessToken._id;

        const user = await Admin.findById(decodedAccessToken._id);
        if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");


        try {
            // Try to verify access token
            jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
        } catch (err) {
            if (err.name === "TokenExpiredError") {
                // Access token expired, verify and refresh
                const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
                if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

                const newAccessToken = user.generateAccessToken(); // Your model method
                res.cookie("accessToken", newAccessToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                    sameSite: "strict",
                    maxAge: 1000 * 60 * 60 // 1 hour
                });
            } else {
                throw new Error("Invalid access token");
            }
        }


        req.user = user;

        next(); // Proceed to the next middleware/route handler
    } catch (err) {
        console.error("Error in validateTokensMiddleware:", err);
        return res.status(403).json(new ApiResponse(403, {}, 'Invalid or expired tokens'));
    }
};


const router = express.Router();


router.post('/login', loginAdmin);


router.post('/add-admin', addAdmin);

router.post('/remove-admin', removeAdmin);

router.post('/change-role', changeRole);

router.post('/reset-password', resetPassword);



router.post('/terminate-user-close-report', validateTokensMiddleware, terminateUserCloseReport);

router.post('/terminate-user-close-message-report', validateTokensMiddleware, terminateUserCloseMessageReport);

router.post('/update-report-status', validateTokensMiddleware, updateUserReportStatus);

router.post('/update-message-report-status', validateTokensMiddleware, updateMessageReportStatus);

router.post('/close-message-report-with-message', validateTokensMiddleware, closeMessageReportWithMessage);

router.post('/delete-message-and-close-message-report', validateTokensMiddleware, deleteMessageCloseMessageReport);


router.post('/close-complaint', validateTokensMiddleware, closeComplaintWithMessage);



export default router;
