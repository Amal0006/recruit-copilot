
const express = require('express');
const router = express.Router();

const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.5-flash-lite'
];

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
      .map((resume, index) => `
Candidate ${index + 1}:
${JSON.stringify(resume, null, 2)}
`)
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

    const retryableStatuses = new Set([
      404, 429, 500, 502, 503, 504
    ]);

    let lastError = null;

    for (const model of GEMINI_MODELS) {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        30000
      );

      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`,
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

        const result = await response.json();

        if (!response.ok) {
          lastError = {
            model,
            status: response.status,
            details: result
          };

          console.error(`Gemini ${model} error:`, {
            status: response.status,
            details: result
          });

          if (retryableStatuses.has(response.status)) {
            console.warn(
              `Trying the next Gemini model after ${model} failed.`
            );
            continue;
          }

          return res.status(502).json({
            error:
              'The AI service could not answer your question. Please try again.'
          });
        }

        const answer = result?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

        if (answer) {
          console.log(`RecruitCopilot answered using ${model}.`);
          return res.json({ answer });
        }

        lastError = {
          model,
          status: response.status,
          details: 'Gemini returned no answer.'
        };

        console.warn(`Gemini ${model} returned an empty answer.`);
      } catch (error) {
        lastError = {
          model,
          details: error.message
        };

        console.error(`Gemini ${model} request failed:`, error.message);
      } finally {
        clearTimeout(timeout);
      }
    }

    console.error('All Gemini models failed:', lastError);

    return res.status(502).json({
      error:
        'Both AI models are currently unavailable. Please try again shortly.'
    });
  } catch (error) {
    console.error('RecruitCopilot chat error:', error);

    return res.status(500).json({
      error: 'Something went wrong while answering your question.'
    });
  }
});

module.exports = router;
