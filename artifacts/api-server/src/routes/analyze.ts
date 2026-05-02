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

const PROMPT = `You are an expert exam analyst. Carefully read the exam paper content below and return a JSON object with exactly two fields.

TASK 1 — repeatedQuestions:
- Identify questions (or question themes) that appear more than once, or are clearly repeated across sections/years.
- Group semantically similar questions together under a single representative phrasing.
- Count how many times each group appears (count must be >= 2 for a question to qualify as "repeated"; if a question only appears once but is a classic high-frequency exam staple, include it with count: 1).
- Return only the TOP 10 by count descending.
- Each item: { "question": string, "count": number }

TASK 2 — importantTopics:
- Extract the key subject topics that appear across the exam.
- Rank each topic as "High", "Medium", or "Low" priority based on:
  - High: topic appears in many questions or carries heavy marks
  - Medium: topic appears a few times or in moderate-mark questions
  - Low: topic appears once or in minor sections
- Be specific — avoid vague topics like "General Knowledge". Name the actual concept.
- Each item: { "topic": string, "priority": "High" | "Medium" | "Low" }

Return ONLY a valid JSON object. No markdown, no explanation, no extra text. Example shape:
{
  "repeatedQuestions": [
    { "question": "Explain the OSI model and its layers.", "count": 4 },
    { "question": "What is the difference between TCP and UDP?", "count": 3 }
  ],
  "importantTopics": [
    { "topic": "Network Protocols", "priority": "High" },
    { "topic": "Database Normalization", "priority": "Medium" },
    { "topic": "Binary Trees", "priority": "Low" }
  ]
}

Exam content:
`;

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
      res
        .status(400)
        .json({ error: "PDF appears to be empty or unreadable. Please upload a text-based PDF." });
      return;
    }
  } catch {
    res
      .status(400)
      .json({ error: "Failed to parse PDF. Please ensure it is a valid, text-based PDF." });
    return;
  }

  const truncatedText = pdfText.slice(0, 14000);

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: PROMPT + truncatedText }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let result: { repeatedQuestions: unknown[]; importantTopics: unknown[] };
    try {
      const rawText = content.text.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      result = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }

    if (!Array.isArray(result.repeatedQuestions) || !Array.isArray(result.importantTopics)) {
      res.status(500).json({ error: "AI returned unexpected structure. Please try again." });
      return;
    }

    const repeatedQuestions = (result.repeatedQuestions as Array<{ question: string; count: number }>)
      .filter((q) => q.question && typeof q.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const importantTopics = (result.importantTopics as Array<{ topic: string; priority: string }>)
      .filter((t) => t.topic && ["High", "Medium", "Low"].includes(t.priority));

    res.json({ repeatedQuestions, importantTopics });
  } catch (err) {
    req.log?.error({ err }, "Anthropic API error");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
