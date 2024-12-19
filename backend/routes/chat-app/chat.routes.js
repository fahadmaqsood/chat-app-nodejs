import { Router } from "express";
import {
  addNewParticipantInGroupChat,
  createAGroupChat,
  getListOfUserChats,
  createOrGetAOneOnOneChat,
  deleteGroupChat,
  deleteOneOnOneChat,
  getAllChats,
  getGroupChatDetails,
  leaveGroupChat,
  removeParticipantFromGroupChat,
  renameGroupChat,
  searchAvailableUsers,
  findMatchingFriends,
  dontSuggestUserAsFriendAgain,
} from "../../controllers/chat-app/chat.controllers.js";
import { verifyJWT } from "../../middlewares/auth.middlewares.js";
import {
  createAGroupChatValidator,
  updateGroupChatNameValidator,
} from "../../validators/apps/chat-app/chat.validators.js";
import { mongoIdPathVariableValidator } from "../../validators/common/mongodb.validators.js";
import { validate } from "../../validators/validate.js";

import { validateTokensMiddleware } from '../../middlewares/auth.middlewares.js';


const router = Router();

//router.use(verifyJWT);

router.route("/").get(validateTokensMiddleware, getAllChats);

router.route("/users").get(searchAvailableUsers);

router.route("/find-random-friends").get(validateTokensMiddleware, findMatchingFriends);
router.route("/dont-suggest-find-friends-user-again").post(validateTokensMiddleware, dontSuggestUserAsFriendAgain);

router.route("/get-user-chats").post(validateTokensMiddleware, getListOfUserChats);

router
  .route("/c/:receiverId")
  .post(
    mongoIdPathVariableValidator("receiverId"),
    validate,
    validateTokensMiddleware,
    createOrGetAOneOnOneChat
  );

router
  .route("/create-group")
  .post(validateTokensMiddleware, createAGroupChatValidator(), validate, createAGroupChat);

router
  .route("/group/:chatId")
  .get(validateTokensMiddleware, mongoIdPathVariableValidator("chatId"), validate, getGroupChatDetails)
  .patch(
    validateTokensMiddleware,
    mongoIdPathVariableValidator("chatId"),
    updateGroupChatNameValidator(),
    validate,
    renameGroupChat
  )
  .delete(validateTokensMiddleware, mongoIdPathVariableValidator("chatId"), validate, deleteGroupChat);

router
  .route("/group/:chatId/:participantId")
  .post(
    validateTokensMiddleware,
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("participantId"),
    validate,
    addNewParticipantInGroupChat
  )
  .delete(
    validateTokensMiddleware,
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("participantId"),
    validate,
    removeParticipantFromGroupChat
  );

router
  .route("/leave/group/:chatId")
  .delete(mongoIdPathVariableValidator("chatId"), validate, validateTokensMiddleware, leaveGroupChat);

router
  .route("/remove/:chatId")
  .delete(mongoIdPathVariableValidator("chatId"), validate, validateTokensMiddleware, deleteOneOnOneChat);

export default router;
