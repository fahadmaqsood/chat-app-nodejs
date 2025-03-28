import crypto from "crypto";
import jwt from "jsonwebtoken";
import { UserLoginType, UserRolesEnum } from "../../constants.js";
import { User } from "../../models/auth/user.models.js";
import { ScheduledAccountDeletion } from "../../models/auth/ScheduledAccountDeletion.js";
import { ApiError } from "../../utils/ApiError.js";
import { ApiResponse } from "../../utils/ApiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import {
  getLocalPath,
  getStaticFilePath,
  removeLocalFile,
} from "../../utils/helpers.js";
import {
  emailVerificationMailgenContent,
  forgotPasswordMailgenContent,
  forgotPasswordOTPMailgenContent,
  sendEmail,
} from "../../utils/mail.js";
import LoginInfo from "../../models/auth/LoginInfo.js";



// Function to validate and refresh tokens
const validateAndRefreshTokens = async (accessToken, refreshToken) => {
  try {
    // Step 1: Validate both tokens with the user's model
    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);

    if (!decodedAccessToken || !decodedRefreshToken) {
      throw new ApiError(401, "Invalid token(s)");
    }

    const user = await User.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) {
      throw new ApiError(401, "Invalid or mismatched tokens");
    }

    // Step 2: Verify access token
    try {
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (error) {
      // If the access token is not valid, proceed to refresh it
      if (error.name === 'TokenExpiredError') {
        // Step 3: Verify refresh token and generate a new access token
        try {
          const newDecodedRefreshToken = jwt.verify(
            refreshToken,
            process.env.REFRESH_TOKEN_SECRET
          );

          if (newDecodedRefreshToken._id !== decodedAccessToken._id) {
            throw new ApiError(401, "Invalid refresh token");
          }

          const newAccessToken = user.generateAccessToken();

          // Step 4: Save new access token in the database (if needed)
          // No need to save the access token in the database here, but if you need to track it, implement it accordingly

          return { accessToken: newAccessToken };

        } catch (refreshTokenError) {
          throw new ApiError(401, "Invalid refresh token");
        }
      } else {
        throw new ApiError(401, "Invalid access token");
      }
    }
  } catch (error) {
    throw new ApiError(error.statusCode || error.status || 500, error.message || "An error occurred");
  }
};


const getUserFriends = async (userId, limit, skip) => {
  try {
    // Fetch the user's followers and following lists
    const user = await User.findById(userId)
      .populate('followers', 'name username avatar') // Populate followers
      .populate('following', 'name username avatar') // Populate following
      .lean()
      .exec();

    if (!user) {
      throw new ApiError(404, "User not found");
    }


    // Apply skip and limit manually on followers or following
    const startIndex = Number(skip || 0);
    const endIndex = startIndex + Number(limit || 15);



    const followingIds = new Set(user.following.map(follow => follow._id.toString()));

    // Find mutual friends (people who follow you and you follow them back)
    const mutualFriends = user.followers.filter(follower => {
      return followingIds.has(follower._id.toString());
    });

    mutualFriends.reverse();


    // Slice the arrays for pagination
    const paginatedFriends = mutualFriends.slice(startIndex, endIndex);


    return paginatedFriends; // Return the list of mutual friends

  } catch (error) {
    console.log(error);
    throw new ApiError(
      500,
      "Something went wrong while fetching user friend list"
    );
  }
}

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

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


const deactivateSubscription = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    user.subscription_status = 'inactive';

    await user.save();

    return res.status(200).json(new ApiResponse(200, {}, "Subscription deactivated successfully."));
  } catch (error) {
    res.status(500).json(new ApiResponse(500, {}, "Couldn't deactivate user's subscription."));
  }
};


const activateSubscriptionTrial = async (req, res) => {
  try {
    const user_id = req.user._id;
    const months = req.body.months;
    const start_date = req.body.start_date;
    const next_billing_date = req.body.next_billing_date;


    const user = await User.findById(user_id);
    user.subscription_status = 'trial';
    user.subscription_type = months == 1 ? 'monthly' : 'yearly';
    user.last_renew_date = new Date(Date.parse(start_date));

    if (next_billing_date !== undefined && next_billing_date.trim() != "") {
      user.next_billing_date = new Date(Date.parse(next_billing_date));
    } else {
      // Calculate the next_billing_date based on the subscription type
      if (months === 1) {
        // Monthly subscription: add 1 month
        user.next_billing_date = new Date(user.last_renew_date);
        user.next_billing_date.setMonth(user.next_billing_date.getMonth() + 1);
      } else {
        // Yearly subscription: add 1 year
        user.next_billing_date = new Date(user.last_renew_date);
        user.next_billing_date.setFullYear(user.next_billing_date.getFullYear() + 1);
      }
    }
    await user.save();
    return res.status(200).json(new ApiResponse(200, {}, "Trial activated successfully."));
  } catch (error) {
    console.log(error);
    res.status(500).json(new ApiResponse(500, {}, "Couldn't activate trial for user."));
  }
}

const activateSubscription = async (req, res) => {

  try {
    const user_id = req.user._id;
    const months = req.body.months;
    const next_billing_date = req.body.next_billing_date;

    const user = await User.findById(user_id);
    user.subscription_status = 'active';
    user.subscription_type = months == 1 ? 'monthly' : 'yearly';
    user.last_renew_date = new Date();

    if (next_billing_date !== undefined && next_billing_date.trim() != "") {
      user.next_billing_date = new Date(Date.parse(next_billing_date));
    } else {
      // Calculate the next_billing_date based on the subscription type
      if (months === 1) {
        // Monthly subscription: add 1 month
        user.next_billing_date = new Date(user.last_renew_date);
        user.next_billing_date.setMonth(user.next_billing_date.getMonth() + 1);
      } else {
        // Yearly subscription: add 1 year
        user.next_billing_date = new Date(user.last_renew_date);
        user.next_billing_date.setFullYear(user.next_billing_date.getFullYear() + 1);
      }
    }

    await user.save();


    return res.status(200).json(new ApiResponse(200, {}, "Subscription activated successfully."));
  } catch (error) {
    console.log(error);
    res.status(500).json(new ApiResponse(500, {}, "Couldn't activate subscription for user."));
  }
}

const registerUser = asyncHandler(async (req, res) => {
  let { email, username, password, religion, date_of_birth, country, language, firebaseToken } = req.body;


  let existedUser = await User.findOne({
    $or: [{ username }, { email }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with email or username already exists", []);
  }

  let d_of_birth = new Date(Date.parse(date_of_birth));


  // Calculate age based on date_of_birth
  let today = new Date();
  let birthDate = d_of_birth;
  let age = today.getFullYear() - birthDate.getFullYear();
  let monthDiff = today.getMonth() - birthDate.getMonth();

  // Adjust age if the birth date hasn't been reached this year
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }

  // Check if the user is between 13 and 19 years old
  if (age < 13 || age > 19) {
    throw new ApiError(400, "User must be between 13 and 19 years old", []);
  }

  if (firebaseToken) {

    // Step 1: Find other users with the same firebaseToken
    let usersWithSameToken = await User.find({
      firebaseToken: firebaseToken // Check if any user has this firebaseToken
    });

    // Step 2: Remove the token from those users (set firebaseToken to null or empty)
    await User.updateMany(
      { _id: { $in: usersWithSameToken.map(user => user._id) } },
      { $set: { firebaseToken: null } } // Clear the firebaseToken field
    );
  }


  let user = await User.create({
    email,
    password,
    username,
    date_of_birth,
    religion,
    country,
    language,
    firebaseToken,
    isEmailVerified: false,
    role: UserRolesEnum.USER,
  });

  /**
   * unHashedToken: unHashed token is something we will send to the user's mail
   * hashedToken: we will keep record of hashedToken to validate the unHashedToken in verify email controller
   * tokenExpiry: Expiry to be checked before validating the incoming token
   */
  let { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken();

  // generate access and refresh tokens
  let { accessToken, refreshToken } = await generateAccessAndRefreshTokens(user._id);

  /**
   * assign hashedToken and tokenExpiry in DB till user clicks on email verification link
   * The email verification is handled by {@link verifyEmail}
   */
  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/verify-email/${unHashedToken}`
    ),
  });

  let createdUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry"
  );

  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registering the user");
  }

  return res
    .status(201)
    .json(
      new ApiResponse(
        200,
        { user: createdUser, accessToken: accessToken, refreshToken: refreshToken },
        "Users registered successfully and verification email has been sent on your email."
      )
    );
});

const checkPasswordIsCorrect = asyncHandler(async (req, res) => {
  const { password } = req.body;

  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  // Compare the incoming password with hashed password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid user credentials");
  }

  return res.status(200).json(new ApiResponse(200, {}, "Password is correct"));
});


const scheduleAccountDeletion = asyncHandler(async (req, res) => {
  // Get the deletion wait period from the environment file or use a default value of 7 days
  const deletionWaitPeriod = parseInt(process.env.DELETION_WAIT_PERIOD, 10) || 7;

  // Ensure the DELETION_WAIT_PERIOD is a valid number
  if (isNaN(deletionWaitPeriod) || deletionWaitPeriod <= 0) {
    throw new ApiError(500, "Invalid DELETION_WAIT_PERIOD environment variable", []);
  }

  // Calculate the deletion date by adding the wait period (in days) to today's date
  const deletionDate = new Date();
  deletionDate.setDate(deletionDate.getDate() + deletionWaitPeriod);

  // Fetch the user from the database
  const user = await User.findById(req.user._id);

  if (!user) {
    throw new ApiError(404, "User does not exist", []);
  }

  // Check if the user already has a scheduled deletion
  const existingScheduledDeletion = await ScheduledAccountDeletion.findOne({
    user: user._id,
  });

  if (existingScheduledDeletion) {
    throw new ApiError(400, "Account deletion already scheduled", []);
  }

  // Create a new scheduled account deletion entry
  const scheduledDeletion = new ScheduledAccountDeletion({
    user: user._id,
    deletionDate: deletionDate, // Set the dynamically calculated deletion date
  });

  await scheduledDeletion.save();

  // Return a response to the client
  return res.status(200).json(
    new ApiResponse(200, { deletionDate: scheduledDeletion.deletionDate }, "Account deletion scheduled successfully")
  );
});



const loginUser = asyncHandler(async (req, res) => {
  const { email, username, password, firebaseToken } = req.body;

  if (!username && !email) {
    throw new ApiError(400, "Username or email is required");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }, { username: email }, { email: username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  // Convert the termination date to a Date object and compare with the current date
  const terminationDate = new Date(user.account_termination_date);
  const currentDate = new Date();

  if (currentDate >= terminationDate) {
    throw new ApiError(401, `Account has been terminated due to ${user.account_termination_reason}`);
  }

  if (user.loginType !== UserLoginType.EMAIL_PASSWORD) {
    // If user is registered with some other method, we will ask him/her to use the same method as registered.
    // This shows that if user is registered with methods other than email password, he/she will not be able to login with password. Which makes password field redundant for the SSO
    throw new ApiError(
      400,
      "You have previously registered using " +
      user.loginType?.toLowerCase() +
      ". Please use the " +
      user.loginType?.toLowerCase() +
      " login option to access your account."
    );
  }

  // Compare the incoming password with hashed password
  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  // Remove any scheduled deletion for this user
  await ScheduledAccountDeletion.deleteOne({ user: user._id });

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  // get the user document ignoring the password and refreshToken field
  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
  );

  if (firebaseToken) {

    // Step 1: Find other users with the same firebaseToken
    const usersWithSameToken = await User.find({
      _id: { $ne: loggedInUser._id }, // Exclude the current logged-in user
      firebaseToken: firebaseToken // Check if any user has this firebaseToken
    });

    // Step 2: Remove the token from those users (set firebaseToken to null or empty)
    await User.updateMany(
      { _id: { $in: usersWithSameToken.map(user => user._id) } },
      { $set: { firebaseToken: null } } // Clear the firebaseToken field
    );

    // Step 3: Set the token for the logged-in user
    loggedInUser.firebaseToken = firebaseToken;

    // Step 4: Save the loggedInUser
    await loggedInUser.save();
  }

  // TODO: Add more options to make cookie more secure and reliable
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  // Determine IP address
  const ip = req.headers['x-forwarded-for'] || req.ip;

  // Store login information
  const loginInfo = new LoginInfo({
    user: user._id,
    ip: ip
  });
  await loginInfo.save();

  return res
    .status(200)
    .cookie("accessToken", accessToken, options) // set the access token in the cookie
    .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken }, // send access and refresh token in response if client decides to save them by themselves
        "User logged in successfully"
      )
    );
});


const refreshUser = asyncHandler(async (req, res) => {

  // get the user document ignoring the password and refreshToken field
  const loggedInUser = await User.findById(req.user._id).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
  );

  const accessToken = req.headers['access-token'];
  const refreshToken = req.headers['refresh-token'];


  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        { user: loggedInUser, accessToken, refreshToken }, // send access and refresh token in response if client decides to save them by themselves
        "User logged in successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: '',
      },
    },
    { new: true }
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged out"));
});

const verifyEmail = asyncHandler(async (req, res) => {
  const { verificationToken } = req.params;

  if (!verificationToken) {
    throw new ApiError(400, "Email verification token is missing");
  }

  // generate a hash from the token that we are receiving
  let hashedToken = crypto
    .createHash("sha256")
    .update(verificationToken)
    .digest("hex");

  // While registering the user, same time when we are sending the verification mail
  // we have saved a hashed value of the original email verification token in the db
  // We will try to find user with the hashed token generated by received token
  // If we find the user another check is if token expiry of that token is greater than current time if not that means it is expired
  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpiry: { $gt: Date.now() },
  });

  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  // If we found the user that means the token is valid
  // Now we can remove the associated email token and expiry date as we no  longer need them
  user.emailVerificationToken = undefined;
  user.emailVerificationExpiry = undefined;
  // Turn the email verified flag to `true`
  user.isEmailVerified = true;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, { isEmailVerified: true }, "Email is verified"));
});

// This controller is called when user is logged in and he has snackbar that your email is not verified
// In case he did not get the email or the email verification token is expired
// he will be able to resend the token while he is logged in
const resendEmailVerification = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  // if email is already verified throw an error
  if (user.isEmailVerified) {
    throw new ApiError(409, "Email is already verified!");
  }

  const { unHashedToken, hashedToken, tokenExpiry } =
    user.generateTemporaryToken(); // generate email verification creds

  user.emailVerificationToken = hashedToken;
  user.emailVerificationExpiry = tokenExpiry;
  await user.save({ validateBeforeSave: false });

  await sendEmail({
    email: user?.email,
    subject: "Please verify your email",
    mailgenContent: emailVerificationMailgenContent(
      user.username,
      `${req.protocol}://${req.get(
        "host"
      )}/api/v1/users/verify-email/${unHashedToken}`
    ),
  });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Mail has been sent to your mail ID"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    req.cookies.refreshToken || req.body.refreshToken;

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // check if incoming refresh token is same as the refresh token attached in the user document
    // This shows that the refresh token is used or not
    // Once it is used, we are replacing it with new refresh token below
    if (incomingRefreshToken !== user?.refreshToken) {
      // If token is valid but is used already
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    };

    const { accessToken, refreshToken: newRefreshToken } =
      await generateAccessAndRefreshTokens(user._id);

    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", newRefreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: newRefreshToken },
          "Access token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid refresh token");
  }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
  const { email } = req.body;

  // Get email from the client and check if user exists
  const user = await User.findOne({ email });

  if (!user) {
    throw new ApiError(404, "User does not exists", []);
  }

  // // Generate a temporary token
  // const { unHashedToken, hashedToken, tokenExpiry } =
  //   user.generateTemporaryToken(); // generate password reset creds


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
      // ! NOTE: Following link should be the link of the frontend page responsible to request password reset
      // ! Frontend will send the below token with the new password in the request body to the backend reset password endpoint
      // `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`

      unHashedToken
    ),
  });
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        {},
        "Password reset mail has been sent to your email"
      )
    );
});

const verifyForgottenPasswordOtp = asyncHandler(async (req, res) => {
  const { email, otp } = req.body;

  // Create a hash of the incoming reset token

  let hashedToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  // See if user with hash similar to resetToken exists
  // If yes then check if token expiry is greater than current date

  const user = await User.findOne({
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
    email: email,
  });

  // If either of the one is false that means the token is invalid or expired
  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "otp is valid"));
});

const resetForgottenPassword = asyncHandler(async (req, res) => {
  const { email, newPassword, otp: resetToken } = req.body;

  // Create a hash of the incoming reset token

  let hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  // See if user with hash similar to resetToken exists
  // If yes then check if token expiry is greater than current date

  const user = await User.findOne({
    email: email,
    forgotPasswordToken: hashedToken,
    forgotPasswordExpiry: { $gt: Date.now() },
  });

  // If either of the one is false that means the token is invalid or expired
  if (!user) {
    throw new ApiError(489, "Token is invalid or expired");
  }

  // if everything is ok and token id valid
  // reset the forgot password token and expiry
  user.forgotPasswordToken = undefined;
  user.forgotPasswordExpiry = undefined;

  // Set the provided password as the new password
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  const user = await User.findById(req.user?._id);

  // check the old password
  const isPasswordValid = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordValid) {
    throw new ApiError(400, "Invalid old password");
  }

  // assign new password in plain text
  // We have a pre save method attached to user schema which automatically hashes the password whenever added/modified
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password changed successfully"));
});

const assignRole = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { role } = req.body;
  const user = await User.findById(userId);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }
  user.role = role;
  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Role changed for the user"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched successfully"));
});

const handleSocialLogin = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user?._id);

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };

  return res
    .status(301)
    .cookie("accessToken", accessToken, options) // set the access token in the cookie
    .cookie("refreshToken", refreshToken, options) // set the refresh token in the cookie
    .redirect(
      // redirect user to the frontend with access and refresh token in case user is not using cookies
      `${process.env.CLIENT_SSO_REDIRECT_URL}?accessToken=${accessToken}&refreshToken=${refreshToken}`
    );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  // Check if user has uploaded an avatar
  if (!req.body.premade && !req.body.customAvatar) {
    throw new ApiError(400, "Neither pre-made nor custom Avatar was provided");
  }

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


    let updateData;

    if (req.body.premade) {
      // Get the enum values for the premade avatar from the Mongoose schema
      const validPremadeAvatars = User.schema.path('avatar.premade').enumValues;

      // If premadeAvatar is provided, use the premade avatar
      if (!validPremadeAvatars.includes(req.body.premade)) {
        return res.status(400).json(new ApiResponse(400, {}, 'Invalid premade avatar selection.'));
      }

      updateData = {
        'avatar.premade': req.body.premade,       // Set premade avatar
        'avatar.customAvatar.using': false     // Disable custom avatar
      };
    } else if (req.body.customAvatar) {
      let customAvatar = req.body.customAvatar;

      updateData = {
        'avatar.customAvatar.using': true,     // Enable custom avatar
        'avatar.customAvatar.top': customAvatar.top || "NoHair",
        'avatar.customAvatar.accessories': customAvatar.accessories || "Blank",
        'avatar.customAvatar.hatColor': customAvatar.hatColor || "Black",
        'avatar.customAvatar.hairColor': customAvatar.hairColor || "Black",
        'avatar.customAvatar.facialHairType': customAvatar.facialHairType || "Blank",
        'avatar.customAvatar.facialHairColor': customAvatar.facialHairColor || "Black",
        'avatar.customAvatar.clotheType': customAvatar.clotheType || "BlazerShirt",
        'avatar.customAvatar.clotheColor': customAvatar.clotheColor || "Black",
        'avatar.customAvatar.graphicType': customAvatar.graphicType || "Skull",
        'avatar.customAvatar.eyeType': customAvatar.eyeType || "Default",
        'avatar.customAvatar.eyebrowType': customAvatar.eyebrowType || "Default",
        'avatar.customAvatar.mouthType': customAvatar.mouthType || "Default",
        'avatar.customAvatar.skinColor': customAvatar.skinColor || "Tanned"
      };
    } else {
      throw new ApiError(400, "Neither pre-made nor custom Avatar was provided");
    }


    let updatedUser = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true }
    ).select(
      "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
    );


    return res
      .status(200)
      .json(new ApiResponse(200, { user: updatedUser, refreshToken, ...(hasNewAccessToken ? { accessToken: newAccessToken } : { accessToken }) }, "Avatar updated successfully"));
  } catch (error) {
    console.log(error);
    res.status(error.status || error.statusCode || 500).json(new ApiResponse(error.status || error.statusCode || 500, {}, error.message || 'An error occurred'));
  }
});

// Get user points
const getUserPoints = asyncHandler(async (req, res) => {

  const currentUser = await User.findById(req.user._id);

  if (!currentUser) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User not found."));
  }

  // Respond with the user's user_points
  return res
    .status(200)
    .json(new ApiResponse(200, { user_points: currentUser.user_points }, "User points fetched successfully."));
});

const _decreaseUserPoints = async (user_id, current_points, by_points) => {
  let after_decrease = current_points - by_points;

  let updatedUser = await User.findByIdAndUpdate(
    user_id,
    { user_points: (after_decrease < 0) ? 0 : after_decrease },
    { new: true }
  ).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
  );

  return updatedUser;
}

const _increaseUserPoints = async (user_id, current_points, by_points) => {
  let after_increase = current_points + by_points;

  let updatedUser = await User.findByIdAndUpdate(
    user_id,
    { user_points: after_increase },
    { new: true }
  ).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
  );

  return updatedUser;
}

// decrease user points
const decreaseUserPoints = asyncHandler(async (req, res) => {

  const { by_points } = req.body;

  const currentUser = await User.findById(req.user._id);

  if (!currentUser) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User not found."));
  }

  let updatedUser = await _decreaseUserPoints(currentUser._id, currentUser.user_points, by_points);

  // Respond with the user's user_points
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, "User points fetched successfully."));
});


// add user points
const addUserPoints = asyncHandler(async (req, res) => {

  const { by_points } = req.body;

  const currentUser = await User.findById(req.user._id);

  if (!currentUser) {
    return res
      .status(404)
      .json(new ApiResponse(404, null, "User not found."));
  }

  let updatedUser = await User.findByIdAndUpdate(
    currentUser._id,
    { user_points: currentUser.user_points + by_points },
    { new: true }
  ).select(
    "-password -refreshToken -emailVerificationToken -emailVerificationExpiry -forgotPasswordToken -forgotPasswordExpiry"
  );

  // Respond with the user's user_points
  return res
    .status(200)
    .json(new ApiResponse(200, { user: updatedUser }, "User points fetched successfully."));
});

export {
  assignRole,
  changeCurrentPassword,
  forgotPasswordRequest,
  verifyForgottenPasswordOtp,
  getCurrentUser,
  handleSocialLogin,
  scheduleAccountDeletion,
  checkPasswordIsCorrect,
  loginUser,
  logoutUser,
  refreshAccessToken,
  registerUser,
  resendEmailVerification,
  resetForgottenPassword,
  updateUserAvatar,
  verifyEmail,
  getUserPoints,
  addUserPoints,
  decreaseUserPoints,
  validateAndRefreshTokens,
  getUserFriends,


  _decreaseUserPoints,
  _increaseUserPoints,

  refreshUser,




  // subscriptions
  deactivateSubscription,
  activateSubscription,
  activateSubscriptionTrial
};
