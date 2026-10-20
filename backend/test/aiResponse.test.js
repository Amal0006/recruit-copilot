const test = require("node:test");
const assert = require("node:assert/strict");

const {
  extractGeminiText,
  parseGeminiJsonText,
  parseGeminiJson
} = require("../utils/aiResponse");

test("extracts text from a valid Gemini response", () => {
  const data = {
    candidates: [
      {
        content: {
          parts: [{ text: '{"score":85}' }]
        }
      }
    ]
  };

  assert.equal(extractGeminiText(data), '{"score":85}');
});

test("parses valid JSON returned by the AI", () => {
  const result = parseGeminiJsonText(
    '{"score":85,"strengths":["React"]}'
  );

  assert.equal(result.score, 85);
  assert.deepEqual(result.strengths, ["React"]);
});

test("parses JSON wrapped in Markdown code fences", () => {
  const result = parseGeminiJsonText(
    '```json\n{"score":90}\n```'
  );

  assert.equal(result.score, 90);
});

test("rejects malformed JSON with a clear error", () => {
  assert.throws(
    () => parseGeminiJsonText('{"score":'),
    /invalid JSON/i
  );
});

test("rejects an empty AI response", () => {
  assert.throws(
    () => extractGeminiText({ candidates: [] }),
    /no candidate/i
  );
});

test("handles Gemini API error responses", () => {
  assert.throws(
    () => extractGeminiText({
      error: { message: "API quota exceeded" }
    }),
    /API quota exceeded/
  );
});

test("handles candidates without text", () => {
  assert.throws(
    () => extractGeminiText({
      candidates: [
        {
          finishReason: "MAX_TOKENS",
          content: { parts: [] }
        }
      ]
    }),
    /no text/i
  );
});

test("parses JSON directly from a Gemini response", () => {
  const result = parseGeminiJson({
    candidates: [
      {
        content: {
          parts: [
            { text: '```json\n{"name":"Candidate"}\n```' }
          ]
        }
      }
    ]
  });

  assert.equal(result.name, "Candidate");
});