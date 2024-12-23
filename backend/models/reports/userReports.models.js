import mongoose from 'mongoose';

const userReportSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportedId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reportReason: {
        type: String,
        required: true
    },
    reportReasonDescription: {
        type: String,
        required: true
    },
    additionalContext: {
        type: String,
        required: true
    },
    reportStatus: {
        type: String,
        enum: ['in review', 'closed']
    },
    reviewerRemarks: {
        type: String
    }
}, { timestamps: true });

const UserReport = mongoose.model('UserReport', userReportSchema);

export default UserReport;
