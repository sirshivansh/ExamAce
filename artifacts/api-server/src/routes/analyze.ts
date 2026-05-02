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

const ANALYSIS_PROMPT = `You are an expert exam analyst. Carefully read the exam paper content below and return a JSON object with exactly two fields.

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

const buildExpectedQuestionsPrompt = (
  repeatedQuestions: Array<{ question: string; count: number }>,
  importantTopics: Array<{ topic: string; priority: string }>
) => `You are a senior university exam paper setter with 20 years of experience.

Based on the analysis below, predict 5 to 10 questions that are LIKELY to appear in the NEXT sitting of this exam.

Repeated Questions (most frequent first):
${repeatedQuestions.map((q, i) => `${i + 1}. [${q.count}×] ${q.question}`).join("\n")}

Important Topics (by priority):
${importantTopics.map((t) => `- [${t.priority}] ${t.topic}`).join("\n")}

Rules for generating expected questions:
1. Do NOT copy the repeated questions verbatim — rephrase them into fresh but equivalent exam-style questions.
2. Favour High-priority topics. Include at least one question for each High-priority topic.
3. Cover Medium-priority topics where the count is strong.
4. Write university-level questions: use verbs like "Explain", "Discuss", "Compare", "Analyse", "Describe", "With the help of a diagram" etc.
5. Each question should be suitable for a 10-mark answer.
6. Return 5–10 questions total — no more, no less.

Return ONLY a valid JSON object in this exact shape — no markdown, no extra text:
{
  "expectedQuestions": [
    "Explain the significance of X in the context of Y.",
    "Compare and contrast A and B with suitable examples.",
    "..."
  ]
}`;

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
      res.status(400).json({
        error: "PDF appears to be empty or unreadable. Please upload a text-based PDF.",
      });
      return;
    }
  } catch {
    res.status(400).json({
      error: "Failed to parse PDF. Please ensure it is a valid, text-based PDF.",
    });
    return;
  }

  const truncatedText = pdfText.slice(0, 14000);

  try {
    // Step 1: Analyse the exam paper
    const analysisMsg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: ANALYSIS_PROMPT + truncatedText }],
    });

    const analysisContent = analysisMsg.content[0];
    if (analysisContent.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format" });
      return;
    }

    let analysisResult: { repeatedQuestions: unknown[]; importantTopics: unknown[] };
    try {
      const raw = analysisContent.text.trim();
      const match = raw.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("No JSON found");
      analysisResult = JSON.parse(match[0]);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }

    if (!Array.isArray(analysisResult.repeatedQuestions) || !Array.isArray(analysisResult.importantTopics)) {
      res.status(500).json({ error: "AI returned unexpected structure. Please try again." });
      return;
    }

    const repeatedQuestions = (
      analysisResult.repeatedQuestions as Array<{ question: string; count: number }>
    )
      .filter((q) => q.question && typeof q.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const importantTopics = (
      analysisResult.importantTopics as Array<{ topic: string; priority: string }>
    ).filter((t) => t.topic && ["High", "Medium", "Low"].includes(t.priority));

    // Step 2: Generate expected questions in parallel with the response build-up
    let expectedQuestions: string[] = [];
    try {
      const expectedMsg = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 8192,
        messages: [
          {
            role: "user",
            content: buildExpectedQuestionsPrompt(repeatedQuestions, importantTopics),
          },
        ],
      });

      const expectedContent = expectedMsg.content[0];
      if (expectedContent.type === "text") {
        const raw = expectedContent.text.trim();
        const match = raw.match(/\{[\s\S]*\}/);
        if (match) {
          const parsed = JSON.parse(match[0]);
          if (Array.isArray(parsed.expectedQuestions)) {
            expectedQuestions = (parsed.expectedQuestions as unknown[])
              .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
              .slice(0, 10);
          }
        }
      }
    } catch (err) {
      // Non-fatal: return empty array if prediction fails
      req.log?.error({ err }, "Expected questions generation failed — returning empty array");
    }

    res.json({ repeatedQuestions, importantTopics, expectedQuestions });
  } catch (err) {
    req.log?.error({ err }, "Anthropic API error");
    res.status(500).json({ error: "AI analysis failed. Please try again." });
  }
});

export default router;
