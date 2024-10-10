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

router.route("/").get(getAllChats);

router.route("/users").get(searchAvailableUsers);

router.route("/find-random-friends").get(validateTokensMiddleware, findMatchingFriends);

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
  .get(mongoIdPathVariableValidator("chatId"), validate, getGroupChatDetails)
  .patch(
    mongoIdPathVariableValidator("chatId"),
    updateGroupChatNameValidator(),
    validate,
    renameGroupChat
  )
  .delete(mongoIdPathVariableValidator("chatId"), validate, deleteGroupChat);

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
