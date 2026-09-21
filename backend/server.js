require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const app = express();

const allowedOrigins = [
  'https://recruit-copilot.vercel.app',
  'http://localhost:5500', // in case you ever run the frontend locally via a dev server
  null // allows requests with no origin, like opening index.html directly as a file (file://)
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));
app.use(express.json());

// keep the in-memory array too, as a fast fallback / cache for the current session
app.locals.resumeDatabase = [];

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

const parseResumeRoute = require('./routes/parseResume');
app.use('/api', parseResumeRoute);

const matchScoreRoute = require('./routes/matchScore');
app.use('/api', matchScoreRoute);

const chatCopilotRoute = require('./routes/chatCopilot');
app.use('/api', chatCopilotRoute);

const interviewQuestionsRoute = require('./routes/interviewQuestions');
app.use('/api', interviewQuestionsRoute);

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});