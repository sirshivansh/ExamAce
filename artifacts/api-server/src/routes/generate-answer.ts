import { Router } from "express";
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";

const router = Router();
let _model: any;

function getModel() {
  if (!_model) {
    const key = process.env.GEMINI_API_KEY || "";
    if (key) console.log("DEBUG: Initializing Gemini with key:", key.substring(0, 8) + "...");
    const genAI = new GoogleGenerativeAI(key);
    _model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      safetySettings: [
        { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
      ]
    });
  }
  return _model;
}

const PROMPT = (question: string) => `You are an expert university exam tutor. Generate a comprehensive, structured, and technically accurate answer suitable for a 10-mark university paper.

IMPORTANT INSTRUCTIONS:
1. If the question text contains multiple concatenated questions (e.g. due to OCR errors), choose ONLY the most prominent or first logical question to answer. Ignore the rest.
2. Return ONLY a valid JSON object. Do NOT wrap the JSON in markdown code blocks (\`\`\`json). Do NOT add headings like "*Answer*".
3. Do NOT use markdown (like **bold** or numbered lists) inside the text values. The UI handles formatting.

The JSON MUST have exactly this shape:
{
  "answer": {
    "definition": "A clear, complete 2-3 sentence definition. Plain text only.",
    "explanation": [
      "First detailed, technical point that thoroughly explains a concept. Plain text only.",
      "Second detailed, technical point. Plain text only.",
      "Third detailed, technical point. Plain text only.",
      "Fourth detailed, technical point. Plain text only."
    ],
    "example": "A concrete and well-explained real-world example. Plain text only.",
    "conclusion": "A comprehensive concluding summary. Plain text only."
  }
}

Question text: ${question}`;

router.post("/generate-answer", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  try {
    const model = getModel();
    const result_ai = await model.generateContent({
      contents: [{ role: "user", parts: [{ text: PROMPT(question.trim()) }] }],
      generationConfig: { responseMimeType: "application/json" }
    });
    const response = await result_ai.response;
    const text = response.text();

    // Robust JSON extraction
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("AI Response was not JSON:", text);
      throw new Error("No JSON found in response");
    }
    
    const result = JSON.parse(jsonMatch[0]);
    res.json({ answer: result.answer });
  } catch (err: any) {
    console.error("--- FULL ERROR DETAIL ---");
    console.error("Message:", err.message);
    if (err.status) console.error("Status:", err.status);
    console.error("-------------------------");
    if (err.status === 429) {
      res.status(429).json({ error: "Rate limit exceeded. Please wait a moment before trying again.", retryAfter: 60 });
      return;
    }
    res.status(500).json({ error: "Generation failed. Check terminal for details." });
  }
});

export default router;
