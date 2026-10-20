function extractGeminiText(data) {
  if (data?.error) {
    throw new Error(
      data.error.message || "The AI service returned an error."
    );
  }

  const candidate = data?.candidates?.[0];

  if (!candidate) {
    throw new Error("The AI service returned no candidate.");
  }

  const text = candidate.content?.parts
    ?.find((part) => typeof part.text === "string")
    ?.text;

  if (!text || !text.trim()) {
    const reason = candidate.finishReason || "unknown";
    throw new Error(`The AI service returned no text (reason: ${reason}).`);
  }

  return text.trim();
}

function parseGeminiJsonText(rawText) {
  if (typeof rawText !== "string" || !rawText.trim()) {
    throw new Error("The AI response is empty.");
  }

  const cleaned = rawText
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    throw new Error("The AI service returned invalid JSON.");
  }
}

function parseGeminiJson(data) {
  return parseGeminiJsonText(extractGeminiText(data));
}

module.exports = {
  extractGeminiText,
  parseGeminiJsonText,
  parseGeminiJson
};