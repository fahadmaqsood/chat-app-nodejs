import { Admin } from "../../models/auth/admin.models.js";
import { User } from "../../models/auth/user.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
import { ChatMessage } from "../../models/chat-app/message.models.js";
import UserReport from "../../models/reports/userReports.models.js";
import Complaint from "../../models/reports/Complaint.models.js";
import ReportedMessage from "../../models/reports/ReportedMessage.models.js";
import mongoose from "mongoose";




const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await Admin.findById(userId);

        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        // attach refresh token to the user document to avoid refreshing the access token with multiple refresh tokens
        user.refreshToken = refreshToken;

        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating the access token"
        );
    }
};



// Report a user
const loginAdmin = async (req, res) => {
    try {
        const { email, password } = req.body;


        if (!email && !password) {
            throw new ApiError(400, "Email and Password are required");
        }


        const admin = await Admin.findOne({
            email: email
        });


        if (!admin) {
            throw new ApiError(404, "Invalid email or password");
        }


        // Compare the incoming password with hashed password
        const isPasswordValid = await admin.isPasswordCorrect(password);

        if (!isPasswordValid) {
            throw new ApiError(404, "Invalid email or password");
        }


        const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
            admin._id
        );


        const loggedInUser = await Admin.findById(admin._id).select(
            "-password -refreshToken"
        );


        const options = {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
        };


        return res
            .status(200)
            .cookie("accessToken", accessToken, options) // set the access token in the cookie
            .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
            .json(
                new ApiResponse(
                    200,
                    { user: loggedInUser }, // send access and refresh token in response if client decides to save them by themselves
                    "User logged in successfully"
                )
            );
    } catch (error) {
        console.error("Error in admin login:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};




const addAdmin = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        if (!name || !email || !password || !role) {
            throw new ApiError(400, "All fields (name, email, password, role) are required.");
        }

        // Check if admin with same email already exists
        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            throw new ApiError(409, "Admin with this email already exists.");
        }

        // Create new admin
        const newAdmin = await Admin.create({
            name,
            email,
            password,
            role
        });

        return res.status(201).json(
            new ApiResponse(201, { admin: { name: newAdmin.name, email: newAdmin.email, role: newAdmin.role } }, "Admin created successfully.")
        );
    } catch (error) {
        console.error("Error in addAdmin:", error);
        return res.status(error.status || error.statusCode || 500).json(
            new ApiResponse(error.status || error.statusCode || 500, {}, error.message || "Failed to add admin")
        );
    }
};



const removeAdmin = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            throw new ApiError(400, "Email is required");
        }

        // Find the admin or reports manager by email
        const admin = await Admin.findOne({ email });

        if (!admin) {
            throw new ApiError(404, "Admin or Reports Manager not found");
        }

        // Delete the admin or reports manager
        await Admin.deleteOne({ email });

        return res.status(200).json(
            new ApiResponse(200, {}, "Admin or Reports Manager removed successfully.")
        );
    } catch (error) {
        console.error("Error in removeAdmin:", error);
        return res.status(error.status || error.statusCode || 500).json(
            new ApiResponse(error.status || error.statusCode || 500, {}, error.message || "Failed to remove admin")
        );
    }
};




const changeRole = async (req, res) => {
    try {
        const { email, role } = req.body;

        if (!email || !role) {
            throw new ApiError(400, "Email and role are required");
        }

        // Check if the provided role is valid
        if (role !== "admin" && role !== "reports manager") {
            throw new ApiError(400, "Invalid role. Valid roles are 'admin' and 'reports manager'.");
        }

        // Find the admin or reports manager by email
        const admin = await Admin.findOne({ email });

        if (!admin) {
            throw new ApiError(404, "Admin or Reports Manager not found");
        }

        // Update the role
        admin.role = role;
        await admin.save();

        return res.status(200).json(
            new ApiResponse(200, { admin: { email: admin.email, role: admin.role } }, `Role changed to ${role} successfully.`)
        );
    } catch (error) {
        console.error("Error in changeRole:", error);
        return res.status(error.status || error.statusCode || 500).json(
            new ApiResponse(error.status || error.statusCode || 500, {}, error.message || "Failed to change role")
        );
    }
};


const resetPassword = async (req, res) => {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
        return res.status(400).json(new ApiResponse(400, {}, "Email and new password are required"));
    }

    try {
        const admin = await Admin.findOne({ email });

        if (!admin) {
            return res.status(404).json(new ApiResponse(404, {}, "Admin not found"));
        }

        // Update the password
        admin.password = newPassword;
        await admin.save();

        return res.status(200).json(new ApiResponse(200, {}, "Password reset successfully"));
    } catch (error) {
        console.error(error);
        return res.status(500).json(new ApiResponse(500, {}, "Failed to reset password"));
    }
};



// Change the status of a report (e.g., mark as closed)
const updateUserReportStatus = async (req, res) => {
    try {
        const { reportId, reportStatus, reviewerRemarks } = req.body;

        // Ensure report status is valid
        if (!['in review', 'closed'].includes(reportStatus)) {
            return res.status(400).json(new ApiResponse(400, {}, "Invalid report status"));
        }

        // Find and update the report
        const updatedReport = await UserReport.findByIdAndUpdate(
            reportId,
            { reportStatus, reviewerRemarks, reportClosedBy: req.user._id, closedDate: new Date() },
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



// Change the status of a report (e.g., mark as closed)
const updateMessageReportStatus = async (req, res) => {
    try {
        const { reportId, reportStatus, reviewerRemarks } = req.body;

        // Ensure report status is valid
        if (!['in review', 'closed'].includes(reportStatus)) {
            return res.status(400).json(new ApiResponse(400, {}, "Invalid report status"));
        }

        // Find and update the report
        const updatedReport = await ReportedMessage.findByIdAndUpdate(
            reportId,
            { reportStatus, reviewerRemarks, reportClosedBy: req.user._id, closedDate: new Date() },
            { new: true } // Return the updated document
        );

        if (!updatedReport) {
            return res.status(404).json(new ApiResponse(404, {}, "Report not found"));
        }

        return res.status(200).json(new ApiResponse(200, { userReport: updatedReport }, "Report status updated successfully"));
    } catch (error) {
        console.error("Error in updateMessageReportStatus:", error);
        return res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
    }
};


// Change the status of a report (e.g., mark as closed)
const terminateUserCloseReport = async (req, res) => {
    try {
        const { reportId, terminationReason, userId } = req.body;

        if (!reportId || !terminationReason || !userId) {
            return res.status(400).json(new ApiResponse(400, {}, "Report ID, termination reason, and user ID are required"));
        }

        const reportedUser = await User.findByIdAndUpdate(
            userId,
            { account_termination_date: new Date(), account_termination_reason: terminationReason },
            { new: true } // Return the updated document
        );

        // Find and update the report
        const updatedReport = await UserReport.findByIdAndUpdate(
            reportId,
            { reportStatus: "closed", reviewerRemarks: "We have thoroughly reviewed your report regarding this user and have taken appropriate action in accordance with our Terms of Service.", reportClosedBy: req.user._id, closedDate: new Date() },
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

// Change the status of a report (e.g., mark as closed)
const terminateUserCloseMessageReport = async (req, res) => {
    try {
        const { reportId, terminationReason, userId } = req.body;

        if (!reportId || !terminationReason || !userId) {
            return res.status(400).json(new ApiResponse(400, {}, "Report ID, termination reason, and user ID are required"));
        }

        const reportedUser = await User.findByIdAndUpdate(
            userId,
            { account_termination_date: new Date(), account_termination_reason: terminationReason },
            { new: true } // Return the updated document
        );

        // Find and update the report
        const updatedReport = await ReportedMessage.findByIdAndUpdate(
            reportId,
            { reportStatus: "closed", reviewerRemarks: "We have thoroughly reviewed your report regarding this user and have taken appropriate action in accordance with our Terms of Service.", reportClosedBy: req.user._id, closedDate: new Date() },
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

const closeMessageReportWithMessage = async (req, res) => {
    try {
        const { reportId, reviewerRemarks } = req.body;

        if (!reportId || !reviewerRemarks) {
            return res.status(400).json(new ApiResponse(400, {}, "Report ID, and reviewerRemarks are required"));
        }

        // Find and update the report
        const updatedReport = await ReportedMessage.findByIdAndUpdate(
            reportId,
            { reportStatus: "closed", reviewerRemarks: reviewerRemarks, reportClosedBy: req.user._id, closedDate: new Date() },
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

const closeComplaintWithMessage = async (req, res) => {
    try {
        const { complaintId, complaintStatus, reviewerRemarks } = req.body;

        // Validate complaint status
        if (!['in review', 'closed'].includes(complaintStatus)) {
            return res.status(400).json(new ApiResponse(400, {}, "Invalid complaint status"));
        }

        // Find and update the complaint
        const updatedComplaint = await Complaint.findByIdAndUpdate(
            complaintId,
            {
                complaintStatus,
                reviewerRemarks,
                complaintClosedBy: req.user._id,
                closedDate: new Date()
            },
            { new: true }
        );

        if (!updatedComplaint) {
            return res.status(404).json(new ApiResponse(404, {}, "Complaint not found"));
        }

        return res.status(200).json(new ApiResponse(200, { complaint: updatedComplaint }, "Complaint status updated successfully"));
    } catch (error) {
        console.error("Error in closeComplaintWithMessage:", error);
        return res.status(error.status || error.statusCode || 500).json(
            new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred')
        );
    }
};



// Change the status of a report (e.g., mark as closed)
const deleteMessageCloseMessageReport = async (req, res) => {
    try {
        const { reportId, messageId } = req.body;

        if (!reportId || !messageId) {
            return res.status(400).json(new ApiResponse(400, {}, "Report ID, termination reason, and user ID are required"));
        }


        //deleting the message from DB
        await ChatMessage.deleteOne({
            _id: new mongoose.Types.ObjectId(messageId),
        });

        // Find and update the report
        const updatedReport = await ReportedMessage.findByIdAndUpdate(
            reportId,
            { reportStatus: "closed", reviewerRemarks: "We have thoroughly reviewed your report regarding this user and have taken appropriate action in accordance with our Terms of Service.", reportClosedBy: req.user._id, closedDate: new Date() },
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

export { loginAdmin, addAdmin, removeAdmin, changeRole, resetPassword, deleteMessageCloseMessageReport, closeMessageReportWithMessage, updateUserReportStatus, updateMessageReportStatus, terminateUserCloseReport, closeComplaintWithMessage, terminateUserCloseMessageReport };
