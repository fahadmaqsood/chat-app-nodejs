// routes/loginInfoRoutes.js

const express = require('express');
const router = express.Router();
const { getAllLoginInfo, getLoginInfoByUserId } = require('../controllers/loginInfoController');

// Route to get all login information
router.get('/', getAllLoginInfo);

// Route to get login information for a specific user
router.get('/:userId', getLoginInfoByUserId);

module.exports = router;
