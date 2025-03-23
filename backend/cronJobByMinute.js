

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { addNotification, addNotificationForMany } from "./controllers/notification/notificationController.js";

import { getCurrentSessions } from './controllers/user-sessions/userSessions.controllers.js';

import mongoose from "mongoose"; // Import mongoose to close the connection

try {
    await connectDB();

    let currentSessions = await getCurrentSessions();

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

            console.log("adding notification for organizer");
            let notification = await addNotification(organizer_id.toString(), "Session time!", `You have a session scheduled with ${session.participants[0].name} ${(num_participants - 1) > 0 ? `and ${num_participants - 1} others` : ""}. Come, join now!`, {
                'type': 'session',
                'session_id': session._id.toString()
            });
            console.log("adding notification done");
            console.log(notification);


            const participantIds = session.participants.map(participant => participant._id.toString()).filter(id => id !== organizer_id.toString());

            console.log("adding notification for participants");

            // send to participants
            let sent = await addNotificationForMany(participantIds, "Session time!", `You have a session scheduled with ${organizerName} right now.`, {
                'type': 'session',
                'session_id': session._id.toString()
            });
            console.log("done: " + sent);
        }


    }

    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}