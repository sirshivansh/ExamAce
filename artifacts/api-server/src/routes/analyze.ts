import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === "application/pdf") {
      cb(null, true);
    } else {
      cb(new Error("Only PDF files are allowed"));
    }
  },
});

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

router.post("/api/analyze", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }

  let pdfText: string;
  try {
    const parsed = await pdfParse(req.file.buffer);
    pdfText = parsed.text;
    if (!pdfText || pdfText.trim().length < 50) {
      res.status(400).json({ error: "PDF appears to be empty or unreadable. Please upload a text-based PDF." });
      return;
    }
  } catch {
    res.status(400).json({ error: "Failed to parse PDF. Please ensure it is a valid, text-based PDF." });
    return;
  }

  const truncatedText = pdfText.slice(0, 12000);

  const prompt = `You are an expert exam analyst. Analyze the following exam paper content and return a JSON object with these exact fields:

1. "repeatedQuestions": Array of questions/topics that appear repeatedly or are likely to recur. Each item must have:
   - "question": string (the question or topic)
   - "frequency": number (estimated frequency/importance score 1-5)
   - "years": array of strings (if year references found, else ["Recurring"])

2. "importantTopics": Array of key topics from the exam. Each item must have:
   - "topic": string (topic name)
   - "description": string (why it's important, 1-2 sentences)
   - "weightage": string (one of: "High", "Medium", "Low")

3. "answers": Array of key questions with model answers. Each item must have:
   - "question": string (the question)
   - "answer": string (concise model answer, 2-4 sentences)

4. "summary": string (2-3 sentence overall summary of what this exam covers)

Return ONLY valid JSON, no markdown, no extra text.

Exam content:
${truncatedText}`;

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: prompt }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let result;
    try {
      const rawText = content.text.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      result = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }

    res.json(result);
  } catch (err) {
    req.log?.error({ err }, "Anthropic API error");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
