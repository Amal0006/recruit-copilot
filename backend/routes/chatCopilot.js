
const express = require('express');
const router = express.Router();

router.post('/chat', async (req, res) => {
  try {
    const { question, resumes } = req.body || {};

    if (typeof question !== 'string' || !question.trim()) {
      return res.status(400).json({
        error: 'Please enter a question.'
      });
    }

    if (!Array.isArray(resumes) || resumes.length === 0) {
      return res.status(400).json({
        error:
          'No resumes are available in this browser session. Please upload a resume first.'
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(503).json({
        error:
          'AI service is not configured. Please set GEMINI_API_KEY on the server.'
      });
    }

    const candidateContext = resumes
      .map((resume, index) => {
        return `
Candidate ${index + 1}:
${JSON.stringify(resume, null, 2)}
`;
      })
      .join('\n');

    const prompt = `
You are RecruitCopilot, an AI recruitment assistant.

Answer the recruiter's question using only the candidate information
provided below. Do not invent qualifications, experience, skills, or
other facts. If the information is unavailable, clearly say so.

There are ${resumes.length} resume record(s) in the current browser session.
Some records may belong to different versions of the same candidate.
Do not assume every resume represents a different person.

CANDIDATE RESUMES:
${candidateContext}

RECRUITER QUESTION:
${question.trim()}
`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    let response;

    try {
      response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' +
          encodeURIComponent(apiKey),
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }]
              }
            ],
            generationConfig: {
              temperature: 0.3
            }
          }),
          signal: controller.signal
        }
      );
    } finally {
      clearTimeout(timeout);
    }

    const result = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', result);

      return res.status(502).json({
        error:
          'The AI service could not answer your question. Please try again.'
      });
    }

    const answer = result?.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();

    if (!answer) {
      return res.status(502).json({
        error:
          'The AI service returned an empty response. Please try again.'
      });
    }

    return res.json({ answer });
  } catch (error) {
    console.error('RecruitCopilot chat error:', error);

    if (error.name === 'AbortError') {
      return res.status(504).json({
        error: 'The AI request timed out. Please try again.'
      });
    }

    return res.status(500).json({
      error: 'Something went wrong while answering your question.'
    });
  }
});

module.exports = router;
