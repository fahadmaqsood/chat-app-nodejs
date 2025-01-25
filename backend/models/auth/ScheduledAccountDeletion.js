import mongoose, { Schema } from "mongoose";

// Define the ScheduledAccountDeletion schema
const scheduledAccountDeletionSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true, // The user whose account is scheduled for deletion
        },
        deletionDate: {
            type: Date,
            required: true, // The date when the account is to be deleted
        },
        scheduledOn: {
            type: Date,
            default: Date.now, // The date when the deletion was scheduled
        },
        status: {
            type: String,
            enum: ['scheduled', 'deleted'],
            default: "scheduled", // The status of the scheduled deletion
        },
    },
    { timestamps: true }
);

// Create and export the model
export const ScheduledAccountDeletion = mongoose.model(
    "ScheduledAccountDeletion",
    scheduledAccountDeletionSchema
);
