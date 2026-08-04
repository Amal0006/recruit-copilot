const express = require('express');
const multer = require('multer');
const { PDFParse } = require('pdf-parse');
const Resume = require('../models/Resume');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

router.post('/parse-resume', upload.single('resume'), async (req, res) => {
  let resumeText;

  try {
    if (req.file) {
      // PDF was uploaded — extract text from it
      const parser = new PDFParse({ data: req.file.buffer });
      const result = await parser.getText();
      resumeText = result.text;
    } else if (req.body.resumeText) {
      // Fallback: plain text was sent directly
      resumeText = req.body.resumeText;
    } else {
      return res.status(400).json({ error: "Provide a PDF file or resumeText" });
    }
  } catch (err) {
    console.error(err);
    return res.status(400).json({ error: "Failed to read PDF" });
  }

  const prompt = `Extract structured data from this resume. Return ONLY valid JSON, no markdown, no explanation, in this exact shape:
{
  "name": "",
  "email": "",
  "skills": [],
  "experience": [{"company": "", "role": "", "duration": ""}],
  "education": [{"institution": "", "degree": "", "year": ""}],
  "projects": [{"title": "", "technologies": "", "description": ""}]
}

- "projects" should capture any personal, academic, or portfolio projects listed on the resume (separate from work "experience"). Include the project title, the technologies/tools used, and a short one-line description of what it does. If no projects are listed, return an empty array.

Resume text:
${resumeText}`;

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
    const structuredResume = JSON.parse(cleaned);

    // save into the shared in-memory resume database for the current session (fast access)
    req.app.locals.resumeDatabase = req.app.locals.resumeDatabase || [];
    req.app.locals.resumeDatabase.push(structuredResume);

    // also save permanently into MongoDB, so it survives server restarts
    try {
      const savedResume = new Resume(structuredResume);
      await savedResume.save();
    } catch (dbErr) {
      // don't fail the whole request if only the DB save fails — the user still gets their result
      console.error('Failed to save resume to MongoDB:', dbErr);
    }

    res.json(structuredResume);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to parse resume" });
  }
});

module.exports = router;