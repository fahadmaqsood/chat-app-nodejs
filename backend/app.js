import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import session from "express-session";
import fs from "fs";
import { exec } from 'child_process';
import { createServer } from "http";
import passport from "passport";
import path from "path";
import requestIp from "request-ip";
import { Server } from "socket.io";
import swaggerUi from "swagger-ui-express";
import { fileURLToPath } from "url";
import YAML from "yaml";
import { DB_NAME } from "./constants.js";
import { dbInstance } from "./db/index.js";
import morganMiddleware from "./logger/morgan.logger.js";
import { initializeSocketIO } from "./socket/index.js";

import { initializeChatbotSocket } from "./socket/chatbot.socket.js";

import { initializeIndicatorsSocket } from "./socket/indicators.js";

import { initializeCallsSocket } from "./socket/calls.js";

import { ApiError } from "./utils/ApiError.js";
import { ApiResponse } from "./utils/ApiResponse.js";

const app = express();

const httpServer = createServer(app);

const io = new Server(httpServer, {
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});


app.set("io", io); // using set method to mount the `io` instance on the app to avoid usage of `global`

// global middlewares
app.use(
  cors({
    origin:
      process.env.CORS_ORIGIN === "*"
        ? "*" // This might give CORS error for some origins due to credentials set to true
        : process.env.CORS_ORIGIN?.split(","), // For multiple cors origin for production. Refer https://github.com/hiteshchoudhary/apihub/blob/a846abd7a0795054f48c7eb3e71f3af36478fa96/.env.sample#L12C1-L12C12
    // credentials: true,
  })
);

app.use(requestIp.mw());

// Rate limiter to avoid misuse of the service and avoid cost spikes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5000, // Limit each IP to 500 requests per `window` (here, per 15 minutes)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  keyGenerator: (req, res) => {
    return req.clientIp; // IP address from requestIp.mw(), as opposed to req.ip
  },
  handler: (_, __, ___, options) => {
    throw new ApiError(
      options.statusCode || 500,
      `There are too many requests. You are only allowed ${options.max
      } requests per ${options.windowMs / 60000} minutes`
    );
  },
});

// Apply the rate limiting middleware to all requests
app.use(limiter);

app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.static("public")); // configure static file to save images locally
app.use(cookieParser());

// required for passport
app.use(
  session({
    secret: process.env.EXPRESS_SESSION_SECRET,
    resave: true,
    saveUninitialized: true,
  })
); // session secret
app.use(passport.initialize());
app.use(passport.session()); // persistent login sessions

app.use(morganMiddleware);



// Manually define __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views')); // Views folder location


// api routes
import { errorHandler } from "./middlewares/error.middlewares.js";
// * App routes
import userRouter from "./routes/auth/user.routes.js";
import chatRouter from "./routes/chat-app/chat.routes.js";
import messageRouter from "./routes/chat-app/message.routes.js";

import loginInfoRoutes from "./routes/auth/loginInfoRoutes.js";
import otpRoutes from "./routes/otp/otpRoutes.js";
import notificationRoutes from "./routes/notification/notificationRoutes.js";
import userRoutes from "./routes/social/userRoutes.js";
import userPostRoutes from "./routes/social/userPostRoutes.js";

import chatbotRoutes from "./routes/chatbot/chatbot.routes.js";
import settingsRoutes from "./routes/settings/settings.routes.js";
import profileRoutes from "./routes/profile/profile.routes.js";
import utilsRoutes from "./routes/utils/utils.routes.js";

import homeRoutes from "./routes/home/home.routes.js";

import subscriptionCodesRoutes from "./routes/subscription_codes/subscriptionCodesRoutes.js";


import quizRoutes from "./routes/quiz/quiz.routes.js";

import userSessionRoutes from "./routes/user-sessions/userSessions.routes.js";
import paypalRoutes from "./routes/paypal/paypal.routes.js";

import playstoreRoutes from "./routes/playstore/playstore.routes.js";

import personalDiaryRoutes from "./routes/personal-diary/personalDiary.routes.js";


import shareRoutes from "./routes/share/share.routes.js";

import { resolveLink } from './controllers/share/shareController.js';



// * App apis
app.use("/api/v1/users", userRouter);
app.use("/api/v1/chat-app/chats", chatRouter);
app.use("/api/v1/chat-app/messages", messageRouter);

app.use('/api/v1/logininfo', loginInfoRoutes);
app.use('/api/v1/otp', otpRoutes);
app.use('/api/v1/notification', notificationRoutes);
app.use('/api/v1', userRoutes);
app.use('/api/v1/post', userPostRoutes);

app.use('/api/v1/chatbot', chatbotRoutes);
app.use('/api/v1/settings', settingsRoutes);
app.use('/api/v1/profile', profileRoutes);
app.use('/api/v1/utils', utilsRoutes);

app.use('/api/v1/home', homeRoutes);

app.use('/api/v1/subscription-codes/', subscriptionCodesRoutes);

app.use('/api/v1/quiz/', quizRoutes);

app.use('/api/v1/sessions/', userSessionRoutes);

app.use('/api/v1/paypal/', paypalRoutes);

app.use('/api/v1/playstore/', playstoreRoutes);


app.use('/api/v1/personal-diary/', personalDiaryRoutes);

app.use('/api/v1/share/', shareRoutes);


initializeSocketIO(io);
initializeChatbotSocket(io);

const indicatorsWebServerIO = new Server(httpServer, {
  path: "/sockets/indicator",
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

initializeIndicatorsSocket(indicatorsWebServerIO);


const callsWebServerIO = new Server(httpServer, {
  path: "/sockets/calls",
  pingTimeout: 60000,
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: true,
  },
});

initializeCallsSocket(callsWebServerIO);

// Root route for the API
app.get('/', (req, res) => {
  res.send('Welcome to the ChatApp! testing...');
});

app.route('/share/*').get(async (req, res) => {
  // const { linkSuffix } = req.params;  // Extract linkSuffix from URL params
  const linkSuffix = req.params[0]; // Everything after "/share/"


  let decodedLinkSuffix = await resolveLink(linkSuffix);

  if (decodedLinkSuffix == null) {
    return res.status(400).send("Couldn't resolve this link");
  }

  // Extract parameters from the decoded linkSuffix (assuming it’s in query string format like "a=b&c=d&y=5")
  let params = new URLSearchParams(decodedLinkSuffix);

  // Convert the URLSearchParams to an object
  const paramObject = {};
  for (const [key, value] of params.entries()) {
    paramObject[key] = value;
  }

  // First, decode HTML entities (like &amp; into &)
  decodedLinkSuffix = decodedLinkSuffix.replace(/&amp;/g, '&');

  // Pass linkSuffix to the EJS template
  res.render('share', { decodedLinkSuffix: decodeURIComponent(decodedLinkSuffix), params: paramObject });
});


app.get('/add/quiz', (req, res) => {
  // Route to serve the HTML file
  // Send the subscription.html file located in the "public" folder
  res.sendFile(path.join(__dirname, 'public', 'addQuizzes.html'));

});


app.get('/add/personalityQuiz', (req, res) => {
  // Route to serve the HTML file
  // Send the subscription.html file located in the "public" folder
  res.sendFile(path.join(__dirname, 'public', 'addPersonalityQuizzes.html'));

});

app.get('/test/subscribe', (req, res) => {
  // Route to serve the HTML file
  // Send the subscription.html file located in the "public" folder
  res.sendFile(path.join(__dirname, 'public', 'subscription.html'));

});


app.get('/robots.txt', (req, res) => {
  res.type('text/plain');
  res.send(`
User-agent: *
Disallow: /
`);
});



// route for auto server updates
app.all('/pullAndRestart', (req, res) => {
  console.log("inside pullAndRestart");
  // Execute the script
  exec('bash ~/pullAndRestart', (error, stdout, stderr) => {
    if (error) {
      console.error(`Error executing script: ${error.message}`);
      res.status(500).send(`Server update failed: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`Script stderr: ${stderr}`);
      res.status(500).send(`Server update stderr: ${stderr}`);
      return;
    }

    // Send success response
    console.log(`Script stdout: ${stdout}`);
    res.send(`Server updated successfully:\n${stdout}`);
  });
});

// common error handling middleware
app.use(errorHandler);

export { httpServer };
