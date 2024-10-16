import { Router } from "express";
import passport from "passport";
import { UserRolesEnum } from "../../constants.js";
import {
  assignRole,
  changeCurrentPassword,
  forgotPasswordRequest,
  verifyForgottenPasswordOtp,
  getCurrentUser,
  handleSocialLogin,
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
  refreshUser
} from "../../controllers/auth/user.controllers.js";
import {
  verifyJWT,
  verifyPermission,
} from "../../middlewares/auth.middlewares.js";
import "../../passport/index.js"; // import the passport config
import {
  userAssignRoleValidator,
  userChangeCurrentPasswordValidator,
  userForgotPasswordValidator,
  userLoginValidator,
  userRegisterValidator,
  userResetForgottenPasswordValidator,
} from "../../validators/apps/auth/user.validators.js";
import { validate } from "../../validators/validate.js";
import { upload } from "../../middlewares/multer.middlewares.js";
import { mongoIdPathVariableValidator } from "../../validators/common/mongodb.validators.js";
import { get } from "mongoose";

import { validateTokensMiddleware } from "../../middlewares/auth.middlewares.js";

const router = Router();

// Unsecured route
router.route("/register").post(userRegisterValidator(), validate, registerUser);
router.route("/login").post(userLoginValidator(), validate, loginUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/verify-email/:verificationToken").get(verifyEmail);

router
  .route("/forgot-password")
  .post(userForgotPasswordValidator(), validate, forgotPasswordRequest);

router
  .route("/verify-forgot-password-otp")
  .post(userForgotPasswordValidator(), validate, verifyForgottenPasswordOtp);

router
  .route("/reset-password/")
  .post(
    userResetForgottenPasswordValidator(),
    validate,
    resetForgottenPassword
  );


// Secured routes
router.route("/logout").post(verifyJWT, logoutUser);
router
  .route("/update-avatar")
  .patch(validate, updateUserAvatar);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
  .route("/change-password")
  .post(
    verifyJWT,
    userChangeCurrentPasswordValidator(),
    validate,
    changeCurrentPassword
  );
router
  .route("/resend-email-verification")
  .post(verifyJWT, resendEmailVerification);
router
  .route("/assign-role/:userId")
  .post(
    verifyJWT,
    verifyPermission([UserRolesEnum.ADMIN]),
    mongoIdPathVariableValidator("userId"),
    userAssignRoleValidator(),
    validate,
    assignRole
  );

// refresh user
router.route("/refresh-user").post(validateTokensMiddleware, refreshUser);

// Get user points
router.route("/get-user-points").get(validateTokensMiddleware, getUserPoints);
router.route("/decrease-user-points").post(validateTokensMiddleware, decreaseUserPoints);
router.route("/add-user-points").post(validateTokensMiddleware, addUserPoints);

// SSO routes
router.route("/google").get(
  passport.authenticate("google", {
    scope: ["profile", "email"],
  }),
  (req, res) => {
    res.send("redirecting to google...");
  }
);

router.route("/github").get(
  passport.authenticate("github", {
    scope: ["profile", "email"],
  }),
  (req, res) => {
    res.send("redirecting to github...");
  }
);

router
  .route("/google/callback")
  .get(passport.authenticate("google"), handleSocialLogin);

router
  .route("/github/callback")
  .get(passport.authenticate("github"), handleSocialLogin);

export default router;
