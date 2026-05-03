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

const PROMPT = (question: string) => `You are an expert university exam tutor. Generate a structured, exam-ready answer for the following question suitable for a 10-mark university paper.

Question: ${question}

Return ONLY a valid JSON object with this exact shape:
{
  "answer": {
    "definition": "A clear 1-2 sentence definition.",
    "explanation": ["Point 1", "Point 2", "Point 3", "Point 4"],
    "example": "A concrete example.",
    "conclusion": "A concise summary."
  }
}`;

router.post("/generate-answer", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question) {
    res.status(400).json({ error: "Question is required." });
    return;
  }

  try {
    const model = getModel();
    const result_ai = await model.generateContent(PROMPT(question.trim()));
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
    res.status(500).json({ error: "Generation failed. Check terminal for details." });
  }
});

export default router;
