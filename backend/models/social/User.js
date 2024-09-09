const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        unique: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    birthdate: {
        type: Date
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'other']
    },
    location: {
        type: String
    },
    religion: {
        type: String
    },
    mood: {
        type: String
    },
    subscription_type: {
        type: String,
        enum: ['monthly', 'yearly']
    },
    subscription_status: {
        type: String,
        enum: ['active', 'inactive']
    },
    account_creation_date: {
        type: Date,
        default: Date.now
    },
    account_termination_date: {
        type: Date
    }  
});

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (err) {
        next(err);
    }
});

// Method to compare hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
    try {
        return await bcrypt.compare(candidatePassword, this.password);
    } catch (err) {
        throw new Error(err);
    }
};

module.exports = mongoose.model('User', userSchema);
