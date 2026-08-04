const express = require('express');
const router = express.Router();

router.post('/interview-questions', async (req, res) => {
  const { resumeData, jobDescription } = req.body;

  if (!resumeData) {
    return res.status(400).json({ error: "resumeData is required" });
  }

  const prompt = `You are a hiring manager preparing for a candidate interview.

Candidate resume data:
${JSON.stringify(resumeData)}

${jobDescription ? `Job description:\n${jobDescription}\n` : ''}

Generate interview questions tailored to this specific candidate. Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "technical_questions": [],
  "behavioral_questions": [],
  "gap_probing_questions": []
}

- "technical_questions": 3-4 questions probing depth in the candidate's listed skills/projects
- "behavioral_questions": 2-3 questions about teamwork, problem-solving, based on their actual experience
- "gap_probing_questions": 2-3 questions that tactfully explore areas the candidate seems weaker in or hasn't demonstrated (e.g. if job wants AWS and they don't list it, ask how they'd approach learning it)

Make every question specific to this candidate's actual background — reference their real projects, companies, or skills by name where relevant. Avoid generic questions that could apply to anyone.`;

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
    const questions = JSON.parse(cleaned);

    res.json(questions);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate questions" });
  }
});

module.exports = router;