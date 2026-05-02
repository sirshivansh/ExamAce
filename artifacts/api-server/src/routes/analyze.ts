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

const FALLBACK = { repeatedQuestions: [], importantTopics: [], expectedQuestions: [] };

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

async function callAI(prompt: string): Promise<string> {
  const msg = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 8192,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  if (block.type !== "text") throw new Error("Unexpected AI response block type: " + block.type);
  return block.text;
}

function extractJSON(raw: string): unknown {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON object found in AI response");
  return JSON.parse(match[0]);
}

async function callAIWithRetry(prompt: string, label: string, log: (msg: string, data?: unknown) => void): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const text = await callAI(prompt);
      log(`[${label}] AI response (attempt ${attempt}), length=${text.length}`);
      log(`[${label}] Raw AI response: ${text.slice(0, 500)}${text.length > 500 ? "…" : ""}`);
      return text;
    } catch (err) {
      log(`[${label}] AI call failed on attempt ${attempt}`, err);
      if (attempt === 2) return null;
    }
  }
  return null;
}

router.post("/api/analyze", upload.single("file"), async (req, res) => {
  const log = (msg: string, data?: unknown) => {
    if (data !== undefined) {
      req.log.info({ data }, msg);
    } else {
      req.log.info(msg);
    }
  };
  const logErr = (msg: string, err?: unknown) => req.log.error({ err }, msg);

  if (!req.file) {
    res.status(400).json({ error: "No PDF file uploaded" });
    return;
  }

  // ── Step 1: Parse PDF ────────────────────────────────────────────────────
  let pdfText: string;
  try {
    const parsed = await pdfParse(req.file.buffer);
    pdfText = parsed.text ?? "";
    log(`PDF parsed successfully. Extracted text length: ${pdfText.length} characters`);

    if (pdfText.trim().length < 50) {
      log("PDF text too short — treating as unreadable");
      res.status(400).json({ error: "Could not read PDF properly. The file appears to be empty or image-based." });
      return;
    }
  } catch (err) {
    logErr("PDF parsing threw an exception", err);
    res.status(400).json({ error: "Could not read PDF properly. Please upload a valid text-based PDF." });
    return;
  }

  const truncatedText = pdfText.slice(0, 14000);

  // ── Step 2: Main analysis (repeated questions + important topics) ─────────
  let repeatedQuestions: Array<{ question: string; count: number }> = [];
  let importantTopics: Array<{ topic: string; priority: string }> = [];

  const analysisRaw = await callAIWithRetry(
    ANALYSIS_PROMPT + truncatedText,
    "analysis",
    log
  );

  if (analysisRaw === null) {
    logErr("Analysis AI call failed after 2 attempts — returning fallback");
    res.json(FALLBACK);
    return;
  }

  try {
    const parsed = extractJSON(analysisRaw) as {
      repeatedQuestions?: unknown[];
      importantTopics?: unknown[];
    };

    if (!Array.isArray(parsed.repeatedQuestions) || !Array.isArray(parsed.importantTopics)) {
      throw new Error("Response JSON missing required arrays");
    }

    repeatedQuestions = (parsed.repeatedQuestions as Array<{ question: string; count: number }>)
      .filter((q) => q.question && typeof q.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    importantTopics = (parsed.importantTopics as Array<{ topic: string; priority: string }>)
      .filter((t) => t.topic && ["High", "Medium", "Low"].includes(t.priority));

    log(`Analysis parsed: ${repeatedQuestions.length} repeated questions, ${importantTopics.length} topics`);
  } catch (err) {
    logErr("Failed to parse analysis JSON — returning fallback", err);
    res.json(FALLBACK);
    return;
  }

  // ── Step 3: Predicted questions (non-fatal — empty array on failure) ─────
  let expectedQuestions: string[] = [];

  if (repeatedQuestions.length > 0 || importantTopics.length > 0) {
    const expectedRaw = await callAIWithRetry(
      buildExpectedQuestionsPrompt(repeatedQuestions, importantTopics),
      "expected-questions",
      log
    );

    if (expectedRaw !== null) {
      try {
        const parsed = extractJSON(expectedRaw) as { expectedQuestions?: unknown[] };
        if (Array.isArray(parsed.expectedQuestions)) {
          expectedQuestions = (parsed.expectedQuestions as unknown[])
            .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
            .slice(0, 10);
          log(`Expected questions parsed: ${expectedQuestions.length} questions`);
        } else {
          throw new Error("expectedQuestions field is not an array");
        }
      } catch (err) {
        logErr("Failed to parse expected questions JSON — using empty array", err);
      }
    } else {
      logErr("Expected questions AI call failed after 2 attempts — using empty array");
    }
  } else {
    log("Skipping expected questions generation — no analysis data to base them on");
  }

  // ── Always returns valid JSON ─────────────────────────────────────────────
  res.json({ repeatedQuestions, importantTopics, expectedQuestions });
});

export default router;
