const express = require('express');
const userController = require('../controllers/userController');
const router = express.Router();

router.post('/update/user-mood', userController.updateUserMood);

module.exports = router;
