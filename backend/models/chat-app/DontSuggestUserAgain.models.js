import mongoose, { Schema } from "mongoose";

const dontSuggestUserAgainSchema = new Schema(
    {
        dontSuggestTo: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        dontSuggestWho: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true
        },
    },
    { timestamps: true }
);

export const DontSuggestUserAgain = mongoose.model("DontSuggestUserAgain", dontSuggestUserAgainSchema);
