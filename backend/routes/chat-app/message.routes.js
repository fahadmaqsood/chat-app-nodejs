import { Router } from "express";
import {
  deleteMessage,
  getAllMessages,
  sendMessage,
  sendMessageToMany,
  getSpecificMessage
} from "../../controllers/chat-app/message.controllers.js";
import { validateTokensMiddleware } from "../../middlewares/auth.middlewares.js";
import { upload } from "../../middlewares/multer.middlewares.js";
import { sendMessageValidator } from "../../validators/apps/chat-app/message.validators.js";
import { mongoIdPathVariableValidator } from "../../validators/common/mongodb.validators.js";
import { validate } from "../../validators/validate.js";

const router = Router();

// router.use(verifyJWT);

router.use(validateTokensMiddleware);



router
  .route("/send-messages-to-many")
  .post(
    upload.fields([{ name: "attachments", maxCount: 5 }]),
    sendMessageValidator(),
    sendMessageToMany
  );


router
  .route("/get/message/:messageId")
  .get(
    getSpecificMessage
  );



router
  .route("/:chatId")
  .get(mongoIdPathVariableValidator("chatId"), validate, getAllMessages)
  .post(
    upload.fields([{ name: "attachments", maxCount: 5 }]),
    mongoIdPathVariableValidator("chatId"),
    sendMessageValidator(),
    validate,
    sendMessage
  );


//Delete message route based on Message id

router
  .route("/:chatId/:messageId")
  .delete(
    mongoIdPathVariableValidator("chatId"),
    mongoIdPathVariableValidator("messageId"),
    validate,
    deleteMessage
  );

export default router;
