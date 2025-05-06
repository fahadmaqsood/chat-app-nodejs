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

app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb", parameterLimit: 100000 }));
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
import appstoreRoutes from "./routes/playstore/appstore.routes.js";

import personalDiaryRoutes from "./routes/personal-diary/personalDiary.routes.js";


import shareRoutes from "./routes/share/share.routes.js";

import { resolveLink } from './controllers/share/shareController.js';

import reportRoutes from './routes/reports/report.routes.js';

import adminRoutes from './routes/admin/admin.routes.js';

import { Admin } from "./models/auth/admin.models.js";
import { User } from "./models/auth/user.models.js";
import ReportedMessage from "./models/reports/ReportedMessage.models.js";
import Complaint from "./models/reports/Complaint.models.js";
import UserReport from "./models/reports/userReports.models.js";
import { ChatMessage } from "./models/chat-app/message.models.js";


import subscriptionCodes from "./models/subscription_codes/subscriptionCodes.js";
import LoginInfo from './models/auth/LoginInfo.js';


import jwt from "jsonwebtoken";


// TODO: Remove this whole facebook code
import facebookWhatsappApiRoutes from './routes/facebook/facebook.routes.js';
app.use("/api/v1/facebook", facebookWhatsappApiRoutes);


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

app.use('/api/v1/subscription-codes', subscriptionCodesRoutes);

app.use('/api/v1/quiz/', quizRoutes);

app.use('/api/v1/sessions/', userSessionRoutes);

app.use('/api/v1/paypal/', paypalRoutes);

app.use('/api/v1/playstore/', playstoreRoutes);
app.use('/api/v1/appstore/', appstoreRoutes);


app.use('/api/v1/personal-diary/', personalDiaryRoutes);

app.use('/api/v1/share/', shareRoutes);

app.use('/api/v1/reports', reportRoutes);

app.use('/api/v1/admin', adminRoutes);



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



app.route('/admin').get(async (req, res) => {
  // Pass linkSuffix to the EJS template
  res.render('admin-login', {});
});


app.get('/admin/dashboard', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    // All good — redirect to main dashboard
    return res.redirect('/admin/dashboard/main');

  } catch (err) {
    console.error("Error in /admin/dashboard:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});


const getUserDistributionByCountry = async () => {
  try {
    const raw = await User.aggregate([
      {
        $project: {
          country: {
            $switch: {
              branches: [
                { case: { $eq: ["$country", "US"] }, then: "United States" },
                { case: { $eq: ["$country", "UK"] }, then: "United Kingdom" },
                { case: { $eq: ["$country", "Sindh"] }, then: "Pakistan" },
              ],
              default: "$country"
            }
          }
        }
      },
      {
        $group: {
          _id: { $ifNull: ["$country", ""] },
          count: { $sum: 1 },
        }
      },
      { $sort: { count: -1 } }
    ]);
    const formatted = [['Country', 'Users']];

    raw.forEach(item => {
      if (item._id && item._id.trim() !== '') {
        formatted.push([item._id.trim(), item.count]);
      }
    });

    // console.log("User distribution by country:", formatted);
    return formatted;
  } catch (err) {
    console.error("Error getting user distribution by country:", err);
    return [];
  }
};


app.route('/admin/dashboard/main').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    const totalUsers = await User.countDocuments({});

    // users who joined this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0); // Start of the day

    const endOfMonth = new Date(); // Now

    const usersJoinedThisMonth = await User.countDocuments({
      account_creation_date: { $gte: startOfMonth, $lte: endOfMonth }
    });


    // Users who joined today
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0); // Today at 00:00:00

    const endOfDay = new Date(); // Current time

    const usersJoinedToday = await User.countDocuments({
      account_creation_date: { $gte: startOfDay, $lte: endOfDay }
    });


    // for user distribution by country
    const userDistributionByCountry = await getUserDistributionByCountry();

    const activeSubscriptions = await User.countDocuments({ subscription_status: 'active' });


    const [userReports, messageReports, complaints] = await Promise.all([
      UserReport.countDocuments({ reportStatus: 'in review' }),
      ReportedMessage.countDocuments({ reportStatus: 'in review' }),
      Complaint.countDocuments({ complaintStatus: 'in review' })
    ]);

    const totalActiveReports = userReports + messageReports + complaints;


    // All good
    // Pass linkSuffix to the EJS template
    res.render('dashboard', { adminName: user.name, totalUsers, usersJoinedThisMonth, userDistributionByCountry: JSON.stringify(userDistributionByCountry), activeSubscriptions, totalActiveReports, usersJoinedToday });


  } catch (err) {
    console.error("Error in /admin/dashboard/main:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});

app.route('/admin/dashboard/users').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }


    // Pagination and search logic
    const searchQuery = req.query.search || '';
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;

    // Define search query filter
    const searchFilter = searchQuery ? {
      $or: [
        { username: { $regex: searchQuery, $options: 'i' } },
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    } : {};

    // Get users with pagination and search filter
    const totalUsers = await User.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalUsers / itemsPerPage);

    const users = await User.find(searchFilter)
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage);


    res.render('admin-users', {
      users,
      page: page,
      totalPages: Math.ceil(totalUsers / limit),
      searchQuery // Pass search query to retain in the search bar
    });


  } catch (err) {
    console.error("Error in /admin/dashboard/users:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});


app.route('/admin/dashboard/user/:username').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    // Extract the username from the URL parameter
    const { username } = req.params;

    // console.log("Username from URL:", username);

    // Find the user by their username
    const targetUser = await User.findOne({ username: username });
    if (!targetUser) throw new Error("User not found");



    // Find login history entries for this user (with pagination)
    const page = parseInt(req.query.page) || 1;  // Get page from query params
    const limit = 10; // Number of records per page

    const loginHistory = await LoginInfo.find({ user: targetUser._id })
      .sort({ login_time: -1 }) // Latest login first
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(); // make it plain JS objects for EJS
    const totalLogins = await LoginInfo.countDocuments({ user: targetUser._id });



    // Pass the target user data to the view
    res.render('admin-user', {
      user: targetUser,
      loginHistory,
      page,
      totalPages: Math.ceil(totalLogins / limit)
    });


  } catch (err) {
    console.error("Error in /admin/dashboard/users:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});


app.route('/admin/dashboard/admins').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }


    // Pagination and search logic
    const searchQuery = req.query.search || '';
    const currentPage = parseInt(req.query.page) || 1;
    const itemsPerPage = 10;

    // Define search query filter
    const searchFilter = searchQuery ? {
      $or: [
        { name: { $regex: searchQuery, $options: 'i' } },
        { email: { $regex: searchQuery, $options: 'i' } }
      ]
    } : {};

    // Get users with pagination and search filter
    const totalUsers = await Admin.countDocuments(searchFilter);
    const totalPages = Math.ceil(totalUsers / itemsPerPage);

    const admins = await Admin.find(searchFilter)
      .skip((currentPage - 1) * itemsPerPage)
      .limit(itemsPerPage);


    const adminIds = admins.map(admin => admin._id);

    const closedReportsByAdmin = await UserReport.aggregate([
      {
        $match: {
          reportStatus: 'closed',
          reportClosedBy: { $in: adminIds }
        }
      },
      {
        $group: {
          _id: '$reportClosedBy',
          count: { $sum: 1 }
        }
      }
    ]);

    const closedCountMap = {};
    closedReportsByAdmin.forEach(item => {
      closedCountMap[item._id.toString()] = item.count;
    });

    admins.forEach(admin => {
      const idStr = admin._id.toString();
      admin.closedReports = closedCountMap[idStr] || 0;
    });


    const closedMessageReportsByAdmin = await ReportedMessage.aggregate([
      {
        $match: {
          reportStatus: 'closed',
          reportClosedBy: { $in: adminIds }
        }
      },
      {
        $group: {
          _id: '$reportClosedBy',
          count: { $sum: 1 }
        }
      }
    ]);


    const closedMessageMap = {};
    closedMessageReportsByAdmin.forEach(item => {
      closedMessageMap[item._id.toString()] = item.count;
    });

    admins.forEach(admin => {
      const idStr = admin._id.toString();
      admin.closedMessageReports = closedMessageMap[idStr] || 0;
    });



    const closedComplaintsByAdmin = await Complaint.aggregate([
      {
        $match: {
          complaintStatus: 'closed',
          complaintClosedBy: { $in: adminIds }
        }
      },
      {
        $group: {
          _id: '$complaintClosedBy',
          count: { $sum: 1 }
        }
      }
    ]);


    const closedComplaintMap = {};
    closedComplaintsByAdmin.forEach(item => {
      closedComplaintMap[item._id.toString()] = item.count;
    });

    admins.forEach(admin => {
      const idStr = admin._id.toString();
      admin.closedComplaints = closedComplaintMap[idStr] || 0;
    });


    res.render('admin-admins', {
      admins,
      userRole: user.role,
      userId: user._id,
      currentPage: page,
      totalPages: Math.ceil(totalUsers / limit),
      searchQuery // Pass search query to retain in the search bar
    });


  } catch (err) {
    console.error("Error in /admin/dashboard/users:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});

app.route('/admin/logout').get(async (req, res) => {
  try {
    // Clear all cookies
    Object.keys(req.cookies).forEach(cookieName => {
      // For each cookie, clear it (both HttpOnly and non-HttpOnly)
      res.clearCookie(cookieName, { httpOnly: true, path: '/' });
    });

    // Optionally, you can clear cookies with specific paths or domains if needed.
    // res.clearCookie('auth_token', { httpOnly: true, path: '/' });
    // res.clearCookie('other_cookie_name', { path: '/' });

    // Redirect to the login page after successful logout
    res.redirect('/admin');
  } catch (error) {
    console.error("Error during logout:", error);
    res.status(500).send('Something went wrong while logging out.');
  }
});



app.route('/admin/dashboard/vouchers').get(async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  const page = parseInt(req.query.page) || 1;
  const limit = 10;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken();
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    const totalVouchers = await subscriptionCodes.countDocuments();
    const totalPages = Math.ceil(totalVouchers / limit);

    const vouchers = await subscriptionCodes.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('vouchers', {
      vouchers,
      currentPage: page,
      totalPages,
      userRole: user.role,
      userId: user._id
    });

  } catch (error) {
    console.error("Error in /admin/dashboard/vouchers:", error);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});

app.get('/admin/dashboard/user-reports', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken();
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const totalReports = await UserReport.countDocuments();
    const totalPages = Math.ceil(totalReports / limit);

    const reports = await UserReport.find()
      .populate('reporterId', 'username')
      .populate('reportedId', 'username')
      .populate('reportClosedBy', 'name')
      .sort({ reportStatus: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin-userReports', {
      reports,
      userRole: user.role,
      userId: user._id,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error("Error in /admin/dashboard/user-reports:", error);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});




app.get('/admin/dashboard/message-reports', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken();
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const totalReports = await ReportedMessage.countDocuments();
    const totalPages = Math.ceil(totalReports / limit);

    const messageReports = await ReportedMessage.find()
      .populate('reportedBy', 'username')
      .populate('reportedMessage')
      .populate('reportClosedBy', 'name')
      .sort({ reportStatus: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin-messageReports', {
      messageReports,
      userRole: user.role,
      userId: user._id,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error("Error in /admin/dashboard/message-reports:", error);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});



app.route('/admin/dashboard/message-reports/:messageId').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    // Extract the username from the URL parameter
    const { messageId } = req.params;


    // Find the user by their username
    const complaint = await ReportedMessage.findById(messageId)
      .populate('reportedMessage')
      .populate('reportedBy', 'username')
      .populate('reportClosedBy', 'name');

    if (!complaint) throw new Error("complaint not found");

    let reportedMessageSenderId = null;
    let reportedMessageId = null;

    if (complaint?.reportedMessage) {
      const targetMsg = await complaint.reportedMessage.populate('sender', 'username _id');

      reportedMessageSenderId = targetMsg.sender._id.toString();
      reportedMessageId = targetMsg._id.toString();

      const previousMessages = await ChatMessage.find({
        chat: targetMsg.chat,
        createdAt: { $lt: targetMsg.createdAt }
      })
        .populate('sender', 'username')
        .sort({ createdAt: -1 })
        .limit(3)
        .lean(); // optional: speeds up queries

      // Include reportedMessage in the msgs array, but ensure it's at the end
      complaint.messages = [...previousMessages.reverse(), targetMsg];
    }


    if (!complaint.reportedMessage) {
      // If the reported message is deleted, handle gracefully
      return res.render('admin-message-report-info', {
        report: complaint,
        reportedMessageSenderId: null,
        reportedMessageId: null,
        deletedMessage: true // pass an extra flag to the view
      });
    }

    // Pass the target user data to the view
    res.render('admin-message-report-info', { report: complaint, reportedMessageSenderId, reportedMessageId });


  } catch (err) {
    console.error("Error in /admin/dashboard/complaints/:complaintId:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});



app.route('/admin/dashboard/user-reports/:reportId').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    // Extract the username from the URL parameter
    const { reportId } = req.params;


    // Find the user by their username
    const complaint = await UserReport.findById(reportId)
      .populate('reporterId', 'username')
      .populate('reportedId', 'username')
      .populate('reportClosedBy', 'name');

    if (!complaint) throw new Error("complaint not found");

    // Pass the target user data to the view
    res.render('admin-user-report-info', { report: complaint });


  } catch (err) {
    console.error("Error in /admin/dashboard/complaints/:complaintId:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});




app.get('/admin/dashboard/complaints', async (req, res) => {
  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;

  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken();
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10;

    const totalReports = await Complaint.countDocuments();
    const totalPages = Math.ceil(totalReports / limit);

    const complaints = await Complaint.find()
      .populate('reporterId', 'username')
      .populate('complaintClosedBy', 'name')
      .sort({ complaintStatus: -1, createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.render('admin-complaints', {
      complaints,
      userRole: user.role,
      userId: user._id,
      currentPage: page,
      totalPages
    });

  } catch (error) {
    console.error("Error in /admin/dashboard/complaints:", error);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
});



app.route('/admin/dashboard/complaints/:complaintId').get(async (req, res) => {

  const accessToken = req.cookies.accessToken;
  const refreshToken = req.cookies.refreshToken;


  try {
    if (!accessToken || !refreshToken) throw new Error("Tokens missing");

    const decodedAccessToken = jwt.decode(accessToken);
    const decodedRefreshToken = jwt.decode(refreshToken);
    if (!decodedAccessToken || !decodedRefreshToken) throw new Error("Invalid token(s)");

    const user = await Admin.findById(decodedAccessToken._id);
    if (!user || user.refreshToken !== refreshToken) throw new Error("Invalid or mismatched tokens");

    try {
      // Try to verify access token
      jwt.verify(accessToken, process.env.ACCESS_TOKEN_SECRET);
    } catch (err) {
      if (err.name === "TokenExpiredError") {
        // Access token expired, verify and refresh
        const validRefresh = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        if (validRefresh._id !== decodedAccessToken._id) throw new Error("Invalid refresh token");

        const newAccessToken = user.generateAccessToken(); // Your model method
        res.cookie("accessToken", newAccessToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "strict",
          maxAge: 1000 * 60 * 60 // 1 hour
        });
      } else {
        throw new Error("Invalid access token");
      }
    }

    // Extract the username from the URL parameter
    const { complaintId } = req.params;


    // Find the user by their username
    const complaint = await Complaint.findById(complaintId)
      .populate('reporterId')
      .populate('complaintClosedBy', 'name');

    if (!complaint) throw new Error("complaint not found");


    // Rename reporterId to user
    const complaintData = {
      ...complaint.toObject(),
      complainedBy: complaint.reporterId
    };
    delete complaintData.reporterId;

    // Pass the target user data to the view
    res.render('admin-complaint-info', { complaint: complaintData });


  } catch (err) {
    console.error("Error in /admin/dashboard/complaints/:complaintId:", err);
    res.clearCookie("accessToken");
    res.clearCookie("refreshToken");
    return res.redirect('/admin/');
  }
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


app.get('/resend-subscription-code', (req, res) => {
  // Route to serve the HTML file
  // Send the subscription.html file located in the "public" folder
  res.render('resend-subscription-code', {
  });

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
