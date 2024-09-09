const mongoose = require('mongoose');

const loginInfoSchema = new mongoose.Schema({
    ip: String,
    login_time: { type: Date, default: Date.now },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const LoginInfo = mongoose.model('LoginInfo', loginInfoSchema);

module.exports = LoginInfo;
