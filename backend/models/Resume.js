const mongoose = require('mongoose');

const resumeSchema = new mongoose.Schema({
  name: String,
  email: String,
  phone: String,
  linkedin: String,
  github: String,
  portfolio: String,
  skills: [String],
  experience: [
    {
      company: String,
      role: String,
      duration: String
    }
  ],
  education: [
    {
      institution: String,
      degree: String,
      year: String
    }
  ],
  projects: [
    {
      title: String,
      technologies: String,
      description: String
    }
  ],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Resume', resumeSchema);