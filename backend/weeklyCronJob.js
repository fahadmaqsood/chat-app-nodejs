import dotenv from "dotenv";

import connectDB from "./db/index.js";

import logger from "./logger/winston.logger.js";


dotenv.config({
    path: "./.env",
});

try {
    await connectDB();
} catch (err) {
    logger.error("Mongo db connect error: ", err);
}