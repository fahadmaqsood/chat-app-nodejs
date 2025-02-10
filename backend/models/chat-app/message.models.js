import mongoose, { Schema } from "mongoose";

// TODO: Add image and pdf file sharing in the next version
const chatMessageSchema = new Schema(
  {
    sender: {
      type: Schema.Types.ObjectId,
      ref: "User",
    },
    content: {
      type: String,
    },
    attachments: {
      type: [
        {
          url: String,
          localPath: String,
        },
      ],
      default: [],
    },
    chat: {
      type: Schema.Types.ObjectId,
      ref: "Chat",
    },
    isRead: {
      type: Boolean,
      default: false, // New messages are unread by default
    },
  },
  { timestamps: true }
);

export const ChatMessage = mongoose.model("ChatMessage", chatMessageSchema);
