import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import mongoose, { Schema } from "mongoose";
import {
  AvailableSocialLogins,
  AvailableUserRoles,
  USER_TEMPORARY_TOKEN_EXPIRY,
  UserLoginType,
  UserRolesEnum,
} from "../../constants.js";

const userSchema = new Schema(
  {
    avatar: {
      premade: {
        type: String,
        enum: ['boy-listening-music-eyes-open', 'girl-eyes-closed', 'boy-with-face-mask', 'bald-boy-in-glasses', 'nerd-girl-in-glasses', 'schoolgirl-with-pony-hair', 'boy-listening-music-eyes-closed', 'angry-guy', 'middle-aged-guy', 'medieval-lord'],
        default: 'boy-listening-music-eyes-open'
      },

      customAvatar: {
        using: { type: Boolean, default: false },
        top: { type: String, default: "NoHair" },
        accessories: { type: String, default: "Blank" },
        hatColor: { type: String, default: "Black" },
        hairColor: { type: String, default: "Black" },
        facialHairType: { type: String, default: "Blank" },
        facialHairColor: { type: String, default: "Black" },
        clotheType: { type: String, default: "BlazerShirt" },
        clotheColor: { type: String, default: "Black" },
        graphicType: { type: String, default: "Skull" },
        eyeType: { type: String, default: "Default" },
        eyebrowType: { type: String, default: "Default" },
        mouthType: { type: String, default: "Default" },
        skinColor: { type: String, default: "Tanned" },
      },
    },
    name: {
      type: String,
      trim: true,
      default: "",
      set: value => {
        if (value) {
          // Convert the first letter to uppercase and the rest to lowercase
          return value
            .split(' ')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
            .join(' ');
        }
        return value;
      }
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    about: {
      type: String,
      trim: true,
      default: "Just a teen trying to figure out life one meme at a time! 😎✨ Lover of late-night convos, spontaneous adventures, and anything that makes me laugh until my stomach hurts. 😂"
    },
    mood: {
      type: String,
      default: "happy"
    },
    location: {
      type: String
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other']
    },
    religion: {
      type: String,
      required: true,
    },
    date_of_birth: { // date of birth
      type: Date,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    language: {
      type: String,
      required: true,
    },
    user_points: {
      type: Number,
      default: 10, // Starting with 10 points for new users
    },
    firebaseToken: {
      type: String
    },
    followers: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    following: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    closeFriends: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] },
    closeFriendRequests: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] }, // Store incoming requests
    sentCloseFriendRequests: { type: [{ type: Schema.Types.ObjectId, ref: 'User' }], default: [] }, // Outgoing requests
    subscription_type: {
      type: String,
      enum: ['monthly', 'yearly']
    },
    subscription_status: {
      type: String,
      enum: ['active', 'inactive', 'trial', 'hold'],
      default: 'inactive'
    },
    last_renew_date: {
      type: Date,
    },
    next_billing_date: {
      type: Date,
    },
    account_creation_date: {
      type: Date,
      default: Date.now
    },
    account_termination_date: {
      type: Date,
      default: function () {
        if (this.date_of_birth) {
          // Add 20 years to the date_of_birth
          const dob = new Date(this.date_of_birth);
          return new Date(dob.setFullYear(dob.getFullYear() + 20));
        }
        return null; // If no date_of_birth, set to null or handle as needed
      }
    },
    account_termination_reason: {
      type: String,
      default: "User turned 20"
    },
    role: {
      type: String,
      enum: AvailableUserRoles,
      default: UserRolesEnum.USER,
      required: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    loginType: {
      type: String,
      enum: AvailableSocialLogins,
      default: UserLoginType.EMAIL_PASSWORD,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    refreshToken: {
      type: String,
    },
    forgotPasswordToken: {
      type: String,
    },
    forgotPasswordExpiry: {
      type: Date,
    },
    emailVerificationToken: {
      type: String,
    },
    emailVerificationExpiry: {
      type: Date,
    },
    privacySettings: {
      viewFollowers: {
        type: String,
        enum: ['everyone', 'no one', 'followers', 'friends'],
        default: 'everyone'
      },
      viewFollowing: {
        type: String,
        enum: ['everyone', 'no one', 'followers', 'friends'],
        default: 'everyone'
      },
      viewCloseFriends: {
        type: String,
        enum: ['everyone', 'no one', 'followers', 'friends'],
        default: 'everyone'
      },
    },

    notificationSettings: {
      marketing: {
        appUpdates: { type: Boolean, default: true },
        promotionEmails: { type: Boolean, default: true },
        tips: { type: Boolean, default: true },
        offers: { type: Boolean, default: true }
      },
      updates: {
        messages: { type: Boolean, default: true },
        friendRequests: { type: Boolean, default: true },
        commentsOnPosts: { type: Boolean, default: true },
        likes: { type: Boolean, default: true },
        billReminder: { type: Boolean, default: true },
      }
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.isPasswordCorrect = async function (password) {
  return await bcrypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
  return jwt.sign(
    {
      _id: this._id,
      email: this.email,
      username: this.username,
      role: this.role,
    },
    process.env.ACCESS_TOKEN_SECRET,
    { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
  );
};

userSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      _id: this._id,
    },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
  );
};

/**
 * @description Method responsible for generating tokens for email verification, password reset etc.
 */
userSchema.methods.generateTemporaryToken = function () {
  // This token should be client facing
  // for example: for email verification unHashedToken should go into the user's mail
  const unHashedToken = crypto.randomBytes(20).toString("hex");

  // This should stay in the DB to compare at the time of verification
  const hashedToken = crypto
    .createHash("sha256")
    .update(unHashedToken)
    .digest("hex");
  // This is the expiry time for the token (20 minutes)
  const tokenExpiry = Date.now() + USER_TEMPORARY_TOKEN_EXPIRY;

  return { unHashedToken, hashedToken, tokenExpiry };
};





// generate otp

userSchema.methods.generateOTP = function () {
  // // Generate a random number between 100000 and 999999
  // const otp = Math.floor(100000 + Math.random() * 900000);

  const otp = "123456";

  // This should stay in the DB to compare at the time of verification
  const hashedToken = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  // This is the expiry time for the token (20 minutes)
  const tokenExpiry = Date.now() + USER_TEMPORARY_TOKEN_EXPIRY;

  return { unHashedToken: otp, hashedToken, tokenExpiry }
}


export const User = mongoose.model("User", userSchema);
