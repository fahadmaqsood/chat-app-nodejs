import { Admin } from "../../models/auth/admin.models.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { ApiError } from "../../utils/ApiError.js";
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
export { loginAdmin, addAdmin, removeAdmin, changeRole, resetPassword };
