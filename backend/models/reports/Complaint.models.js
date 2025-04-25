import mongoose from 'mongoose';

const complaintSchema = new mongoose.Schema({
    reporterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true, // Rating field for the complaint
    },
    ratingDescription: {
        type: String,
        required: true, // Description of the rating provided
    },
    complaintCategories: {
        type: [String],
        required: true, // Array of complaint categories (e.g., "service", "product", etc.)
    },
    actualComplaint: {
        type: String,
        required: true, // The actual complaint or issue text
    },
    complaintStatus: {
        type: String,
        enum: ['in review', 'closed'],
        default: 'in review', // Default status for a new complaint
    },
    reviewerRemarks: {
        type: String, // Remarks from the reviewer once the complaint is reviewed
    },
    complaintClosedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
    },
    closedDate: {
        type: Date,
        default: null // Date when the complaint was closed
    },
}, { timestamps: true });

const Complaint = mongoose.model('Complaint', complaintSchema);

export default Complaint;
