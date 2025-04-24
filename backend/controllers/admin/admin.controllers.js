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


export { loginAdmin };
