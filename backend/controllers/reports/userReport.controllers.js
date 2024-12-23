import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import mongoose from "mongoose";


import UserReport from "../../models/reports/userReports.models.js";

// Report a user
const reportUser = async (req, res) => {
    try {
        const { reportedId, additionalContext } = req.body;
        const reporterId = req.user._id; // Get the current user from the request

        if (!reportedId || !additionalContext) {
            return res.status(400).json(new ApiResponse(400, {}, "reportedId and additionalContext are required"));
        }

        // Create new user report
        const newUserReport = new UserReport({
            reporterId,
            reportedId,
            additionalContext,
            reportStatus: 'in review', // Default report status
        });

        await newUserReport.save();

        return res.status(201).json(new ApiResponse(201, { userReport: newUserReport }, "User reported successfully"));
    } catch (error) {
        console.error("Error in reportUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Get all reports for a user
const getReportsByUser = async (req, res) => {
    try {
        const currentUserId = req.user._id; // Get the current user from the request

        // Fetch all reports where the current user is either the reporter or the reported
        const reports = await UserReport.find({
            $or: [
                { reporterId: currentUserId }, // Reports where the current user is the reporter
                { reportedId: currentUserId }  // Reports where the current user is the reported
            ]
        })
            .populate('reporterId', 'name username') // Populate reporter details
            .populate('reportedId', 'name username') // Populate reported user details
            .lean();

        if (!reports || reports.length === 0) {
            return res.status(200).json(new ApiResponse(200, { reports: [] }, "No reports found for this user"));
        }

        return res.status(200).json(new ApiResponse(200, { reports }, "Reports fetched successfully"));
    } catch (error) {
        console.error("Error in getReportsByUser:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

// Change the status of a report (e.g., mark as closed)
const updateReportStatus = async (req, res) => {
    try {
        const { reportId, reportStatus, reviewerRemarks } = req.body;

        // Ensure report status is valid
        if (!['in review', 'closed'].includes(reportStatus)) {
            return res.status(400).json(new ApiResponse(400, {}, "Invalid report status"));
        }

        // Find and update the report
        const updatedReport = await UserReport.findByIdAndUpdate(
            reportId,
            { reportStatus, reviewerRemarks },
            { new: true } // Return the updated document
        );

        if (!updatedReport) {
            return res.status(404).json(new ApiResponse(404, {}, "Report not found"));
        }

        return res.status(200).json(new ApiResponse(200, { userReport: updatedReport }, "Report status updated successfully"));
    } catch (error) {
        console.error("Error in updateReportStatus:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};

export { reportUser, getReportsByUser, updateReportStatus };
