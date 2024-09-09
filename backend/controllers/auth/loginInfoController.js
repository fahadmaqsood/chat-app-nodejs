const LoginInfo = require('../models/LoginInfo');

// Controller to get all login information
const getAllLoginInfo = async (req, res) => {
    try {
        const loginInfo = await LoginInfo.find().populate('user', 'email'); 
        res.json(loginInfo);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

// Controller to get login information for a specific user
const getLoginInfoByUserId = async (req, res) => {
    try {
        const { userId } = req.params;
        const loginInfo = await LoginInfo.find({ user: userId }).populate('user', 'email'); 
        if (!loginInfo) {
            return res.status(404).json({ error: 'No login info found for this user' });
        }
        res.json(loginInfo);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getAllLoginInfo,
    getLoginInfoByUserId
};
