
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const app = express();

const allowedOrigins = [
  'https://recruit-copilot.vercel.app',
  'http://localhost:5500',
  'http://127.0.0.1:5500'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Not allowed by CORS: ${origin}`));
  }
}));

app.use(express.json());

// In-memory resume cache
app.locals.resumeDatabase = [];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// API routes
const parseResumeRoute = require('./routes/parseResume');
app.use('/api', parseResumeRoute);

const matchScoreRoute = require('./routes/matchScore');
app.use('/api', matchScoreRoute);

const chatCopilotRoute = require('./routes/chatCopilot');
app.use('/api', chatCopilotRoute);

const interviewQuestionsRoute = require('./routes/interviewQuestions');
app.use('/api', interviewQuestionsRoute);

// Start server
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
