const express = require('express');
const router = express.Router();
const notificationController = require('../controllers/notificationController.js');

router.post('/create', notificationController.createNotification);

router.get('/get/notifications', notificationController.getNotifications);

module.exports = router;
