

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { addNotification, addNotificationForMany } from "./controllers/notification/notificationController.js";

import { getCurrentSessions } from './controllers/user-sessions/userSessions.controllers.js';

import mongoose from "mongoose"; // Import mongoose to close the connection

try {
    await connectDB();

    let currentSessions = await getCurrentSessions();

    console.log("currentSessions");
    console.log(currentSessions.length);

    if (currentSessions.length > 0) {

        // Use a for...of loop to handle async operations sequentially
        for (const session of currentSessions) {

            console.log(session);

            // Access the organizer's name
            const organizerName = session.organizer.name == "" ? session.organizer.username : session.organizer.name;
            console.log("Organizer:", organizerName);

            // Loop over participants to get their names
            session.participants.forEach(participant => {
                const participantName = participant.name == "" ? participant.username : participant.name;;
                console.log("Participant:", participantName);
            });

            let organizer_id = session.organizer._id;

            let num_participants = session.participants.length;

            await addNotification(organizer_id.toString(), "Session time!", `You have a session scheduled with ${session.participants[0].name} ${(num_participants - 1) > 0 ? `and ${num_participants - 1} others` : ""}. Come, join now!`, {
                'type': 'session',
                'session_id': session._id.toString()
            });


            const participantIds = session.participants.map(participant => participant._id);

            // send to participants
            await addNotificationForMany(participantIds, "Session time!", `You have a session scheduled with ${organizerName} right now.`, {
                'type': 'session',
                'session_id': session._id
            });
        }


    }

    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}