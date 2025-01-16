import mongoose from 'mongoose';

// Define the ReportedMessage schema
const reportedMessageSchema = new mongoose.Schema(
    {
        reportedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User', // Reference to the user who reported the message
            required: true,
        },
        reportedMessage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ChatMessage', // Reference to the message being reported
            required: true,
        },
        reportReason: {
            type: String,
            required: true, // The reason for reporting the message (e.g., harassment, spam)
        },
        reportReasonDescription: {
            type: String,
            required: true, // A description of why the message is being reported
        },
        additionalContext: {
            type: String,
            required: true, // Any additional context about the reported message
        },
        reportStatus: {
            type: String,
            enum: ['in review', 'closed'], // Status of the report
            default: 'in review', // Default status is 'in review'
        },
        reviewerRemarks: {
            type: String, // Remarks from the reviewer when the report is resolved
        },
    },
    { timestamps: true } // Automatically add createdAt and updatedAt fields
);

// Create and export the ReportedMessage model
const ReportedMessage = mongoose.model('ReportedMessage', reportedMessageSchema);

export default ReportedMessage;
