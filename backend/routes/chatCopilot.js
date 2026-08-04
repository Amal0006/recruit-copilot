const express = require('express');
const Resume = require('../models/Resume');
const router = express.Router();

router.post('/chat', async (req, res) => {
  const { question } = req.body;

  if (!question) {
    return res.status(400).json({ error: "question is required" });
  }

  let resumeDatabase = req.app.locals.resumeDatabase || [];

  // If the in-memory store is empty (e.g. server was just restarted),
  // fall back to loading candidates from MongoDB instead.
  if (resumeDatabase.length === 0) {
    try {
      resumeDatabase = await Resume.find().sort({ createdAt: -1 }).limit(50);
    } catch (dbErr) {
      console.error('Failed to load resumes from MongoDB:', dbErr);
    }
  }

  if (resumeDatabase.length === 0) {
    return res.status(400).json({ error: "No resumes uploaded yet" });
  }

  const prompt = `You are a recruiting assistant. You have access to the following candidate resumes (as structured JSON data):

${JSON.stringify(resumeDatabase, null, 2)}

A recruiter asks: "${question}"

Answer the question using ONLY the candidate data above. If the data doesn't contain enough information to answer, say so. Be specific — name which candidates match and why. Keep your answer concise (2-4 sentences).`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await response.json();

    // Log the full raw response whenever something looks off — this is what
    // actually tells us WHY candidates is missing, instead of just crashing blind.
    if (!data.candidates || !data.candidates[0]) {
      console.error('Unexpected Gemini response:', JSON.stringify(data, null, 2));
      return res.status(502).json({
        error: data.error?.message || "AI service returned an unexpected response. Check server logs for details."
      });
    }

    const candidate = data.candidates[0];

    // Gemini can also finish with no text (e.g. blocked for safety, or hit maxOutputTokens
    // while still "thinking") — guard against that too instead of crashing.
    if (!candidate.content || !candidate.content.parts || !candidate.content.parts[0]) {
      console.error('Gemini candidate had no content:', JSON.stringify(candidate, null, 2));
      return res.status(502).json({
        error: `AI did not return an answer (finishReason: ${candidate.finishReason || 'unknown'})`
      });
    }

    const answer = candidate.content.parts[0].text;
    res.json({ answer });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to get answer" });
  }
});

module.exports = router;