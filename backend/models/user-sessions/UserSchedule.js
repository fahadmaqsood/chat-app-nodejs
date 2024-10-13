import mongoose from 'mongoose';

const userScheduleSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    }, // Title of the session

    description: {
        type: String
    }, // Optional description of the session

    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }], // Array of participants (referencing users)

    date: {
        type: Date,
        required: true
    }, // Date of the session

    slots: {
        type: Number,
        required: true,
        min: 1
    }, // Number of available slots in the session

    organizer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    } // The user who created the session (referring to the 'User' model)

}, { timestamps: true });

const UserSchedule = mongoose.model('UserSchedule', userScheduleSchema);

export default UserSchedule;
