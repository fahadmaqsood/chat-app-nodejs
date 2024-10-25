

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";

import { addNotificationForAll } from "./controllers/notification/notificationController.js";
import mongoose from "mongoose"; // Import mongoose to close the connection

try {
    await connectDB();

    await addNotificationForAll("Week is over 🎉!", "Weekly quiz competition is over, come see the results.", {

    });

    // Close the connection after task completion
    await mongoose.connection.close();
    process.exit(0); // Gracefully exit the process
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}