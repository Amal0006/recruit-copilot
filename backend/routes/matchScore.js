const express = require('express');
const router = express.Router();

router.post('/match-score', async (req, res) => {
  const { resumeData, jobDescription } = req.body;

  if (!resumeData || !jobDescription) {
    return res.status(400).json({ error: "resumeData and jobDescription are required" });
  }

  const prompt = `You are evaluating a candidate's fit for a job. Compare the candidate's resume data against the job description below.

Candidate resume data:
${JSON.stringify(resumeData)}

Job description:
${jobDescription}

Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "score": 0,
  "strengths": [],
  "gaps": [],
  "summary": ""
}

- "score" is 0-100, how well the candidate fits this role
- "strengths" is a list of 2-4 short phrases on what matches well
- "gaps" is a list of 2-4 short phrases on what's missing or weak
- "summary" is one sentence overall verdict`;

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
    const rawText = data.candidates[0].content.parts[0].text;
    const cleaned = rawText.replace(/```json|```/g, "").trim();
    const matchResult = JSON.parse(cleaned);

    res.json(matchResult);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to score match" });
  }
});

module.exports = router;