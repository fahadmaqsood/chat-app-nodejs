import Otp from '../../models/otp/Otp.js';

import { User } from "../../models/auth/user.models.js";

import { forgotPasswordOTPMailgenContent } from "../../utils/mail.js"

// Controller for generating OTP
export const generateOtp = async (req, res) => {
    const { email, phone } = req.body;


    try {

        // Get email from the client and check if user exists
        let user;
        if (email != null) {
            user = await User.findOne({ email });
        }

        if (phone != null) {
            user = await User.findOne({ phone });
        }

        if (!user) {
            throw new ApiError(404, "User does not exists", []);
        }

        // Generate a temporary token
        const { unHashedToken, hashedToken, tokenExpiry } =
            user.generateOTP(); // generate password reset creds


        // save the hashed version a of the token and expiry in the DB
        user.forgotPasswordToken = hashedToken;
        user.forgotPasswordExpiry = tokenExpiry;
        await user.save({ validateBeforeSave: false });

        // Send mail with the password reset link. It should be the link of the frontend url with token
        await sendEmail({
            email: user?.email,
            subject: "Password reset request",
            mailgenContent: forgotPasswordOTPMailgenContent(
                user.username,
                unHashedToken
            ),
        });

        res.status(201).json({ success: true });
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};

// Controller for verifying OTP
export const verifyOtp = async (req, res) => {
    const { email, phone, otp } = req.body;

    try {

        // Get email from the client and check if user exists
        let user;
        if (email != null) {
            user = await User.findOne({ email });
        }

        if (phone != null) {
            user = await User.findOne({ phone });
        }

        if (!user) {
            throw new ApiError(404, "User does not exists", []);
        }

        let hashedToken = crypto
            .createHash("sha256")
            .update(otp)
            .digest("hex");

        // See if user with hash similar to resetToken exists
        // If yes then check if token expiry is greater than current date

        let otp_user = await User.findOne({
            forgotPasswordToken: hashedToken,
            forgotPasswordExpiry: { $gt: Date.now() },
        });

        // If either of the one is false that means the token is invalid or expired
        if (!otp_user) {
            return res
                .status(489)
                .json(new ApiResponse(489, {}, "Token is invalid or expired"));
        } else {
            return res
                .status(200)
                .json(new ApiResponse(200, {}, "Password reset successfully"));
        }
    } catch (err) {
        res.status(500).json({ message: 'Server error', error: err.message });
    }
};


export const changeCurrentPassword = async (req, res) => {
    const { email, phone, newPassword } = req.body;


    // Get email from the client and check if user exists
    let user;
    if (email != null) {
        user = await User.findOne({ email });
    }

    if (phone != null) {
        user = await User.findOne({ phone });
    }

    if (!user) {
        throw new ApiError(404, "User does not exists", []);
    }

    // assign new password in plain text
    // We have a pre save method attached to user schema which automatically hashes the password whenever added/modified
    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password changed successfully"));
};