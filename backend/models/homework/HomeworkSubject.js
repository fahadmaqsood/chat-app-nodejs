const mongoose = require('mongoose');

const homeworkSubjectSchema = new mongoose.Schema({
    subject_name: {
        type: String,
        required: true
    }
});

module.exports = mongoose.model('HomeworkSubject', homeworkSubjectSchema);
