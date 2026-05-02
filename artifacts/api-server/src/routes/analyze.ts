import { Router } from "express";
import multer from "multer";
import { createRequire } from "module";
import os from "os";
import path from "path";
import fs from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");
import Anthropic from "@anthropic-ai/sdk";

const execFileAsync = promisify(execFile);

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

IMPORTANT: Return ONLY valid JSON. Do not include any explanation, text, or markdown. Your output MUST start with { and end with }.

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

IMPORTANT: Return ONLY valid JSON. Do not include any explanation, text, or markdown. Your output MUST start with { and end with }.

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
    "Compare and contrast A and B with suitable examples."
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

function safeExtractJSON(raw: string, label: string, log: (msg: string) => void): unknown {
  log(`[${label}] Raw AI response (first 500 chars): ${raw.slice(0, 500)}${raw.length > 500 ? "…" : ""}`);

  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    throw new Error(`[${label}] No valid JSON braces found in response`);
  }

  const slice = raw.slice(first, last + 1);
  log(`[${label}] Extracted JSON slice (length=${slice.length})`);

  return JSON.parse(slice);
}

async function callAIWithRetry(
  prompt: string,
  label: string,
  log: (msg: string) => void,
  logErr: (msg: string, err?: unknown) => void
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log(`[${label}] AI call attempt ${attempt}…`);
      const text = await callAI(prompt);
      log(`[${label}] AI responded, length=${text.length} (attempt ${attempt})`);
      return text;
    } catch (err) {
      logErr(`[${label}] AI call failed on attempt ${attempt}`, err);
      if (attempt === 2) return null;
    }
  }
  return null;
}

async function ocrPdf(
  pdfBuffer: Buffer,
  fileName: string,
  log: (msg: string) => void,
  logErr: (msg: string, err?: unknown) => void
): Promise<string | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "examace-ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");

  try {
    log(`[OCR] Writing PDF to temp: ${pdfPath}`);
    await fs.writeFile(pdfPath, pdfBuffer);

    log(`[OCR] Running pdftoppm on "${fileName}"…`);
    await execFileAsync("pdftoppm", [
      "-r", "200",
      "-png",
      "-l", "10",
      pdfPath,
      imgPrefix,
    ]);

    const tmpFiles = await fs.readdir(tmpDir);
    const pngFiles = tmpFiles
      .filter(f => f.endsWith(".png"))
      .sort()
      .map(f => path.join(tmpDir, f));

    if (pngFiles.length === 0) {
      log(`[OCR] pdftoppm produced no PNG files for "${fileName}"`);
      return null;
    }

    log(`[OCR] ${pngFiles.length} page image(s) generated for "${fileName}"`);

    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, {
      logger: () => {},
    });

    const pageTexts: string[] = [];
    for (let i = 0; i < pngFiles.length; i++) {
      log(`[OCR] Recognising page ${i + 1}/${pngFiles.length}…`);
      const imgBuf = await fs.readFile(pngFiles[i]);
      const { data } = await worker.recognize(imgBuf);
      pageTexts.push(data.text);
    }

    await worker.terminate();

    const combined = pageTexts.join("\n\n");
    log(`[OCR] Finished "${fileName}" — OCR text length: ${combined.length}`);
    return combined;
  } catch (err) {
    logErr(`[OCR] Failed for "${fileName}"`, err);
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

async function generatePageImages(
  pdfBuffer: Buffer,
  fileName: string,
  log: (msg: string) => void,
  logErr: (msg: string, err?: unknown) => void
): Promise<string[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "examace-pages-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");

  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    log(`[pages] Running pdftoppm on "${fileName}" (first 3 pages)…`);

    await execFileAsync("pdftoppm", [
      "-r", "130",
      "-png",
      "-l", "3",
      pdfPath,
      imgPrefix,
    ]);

    const entries = await fs.readdir(tmpDir);
    const pngPaths = entries
      .filter(f => f.endsWith(".png"))
      .sort()
      .slice(0, 3)
      .map(f => path.join(tmpDir, f));

    const dataUrls: string[] = [];
    for (const p of pngPaths) {
      const buf = await fs.readFile(p);
      dataUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
    }

    log(`[pages] Generated ${dataUrls.length} page image(s) for "${fileName}"`);
    return dataUrls;
  } catch (err) {
    logErr(`[pages] Failed to generate page images for "${fileName}"`, err);
    return [];
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

router.post("/analyze", upload.array("file", 10), async (req, res) => {
  const log = (msg: string) => req.log.info(msg);
  const logErr = (msg: string, err?: unknown) => {
    const stack = err instanceof Error ? err.stack : String(err);
    req.log.error({ err, stack }, msg);
  };

  log("POST /api/analyze — request received");

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    log("No files in request — returning 400");
    res.status(400).json({ error: "No PDF files uploaded" });
    return;
  }

  log(`Files received: ${files.length} file(s), sizes=[${files.map(f => f.size).join(", ")}] bytes`);

  // ── Step 1: Parse all PDFs (with OCR fallback for scanned pages) ──────────
  const textParts: string[] = [];

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(`Parsing PDF ${i + 1}/${files.length}: "${f.originalname}" (${f.size} bytes)…`);

    let text = "";

    try {
      const parsed = await pdfParse(f.buffer);
      text = parsed.text ?? "";
      log(`PDF ${i + 1} parsed. Extracted ${text.length} chars (trimmed: ${text.trim().length})`);
    } catch (err) {
      logErr(`PDF ${i + 1} pdf-parse threw — will attempt OCR fallback`, err);
    }

    if (text.trim().length < 100) {
      log(`PDF ${i + 1} text too short (<100 chars) — assuming scanned PDF, using OCR fallback`);
      log(`Using OCR fallback for "${f.originalname}"`);

      const ocrText = await ocrPdf(f.buffer, f.originalname, log, logErr);

      if (ocrText && ocrText.trim().length >= 100) {
        log(`OCR text length: ${ocrText.length} chars for "${f.originalname}"`);
        text = ocrText;
      } else {
        log(`OCR also failed or too short for "${f.originalname}" — skipping`);
        continue;
      }
    }

    textParts.push(text);
  }

  if (textParts.length === 0) {
    log("All PDFs were unreadable (including OCR) — returning 400");
    res.status(400).json({
      error: "Could not read this PDF. Try a clearer file.",
    });
    return;
  }

  const combinedText = textParts.join("\n\n---\n\n").slice(0, 14000);
  log(`Combined text: ${combinedText.length} characters from ${textParts.length} readable PDF(s)`);

  // ── Step 2: Main analysis (repeated questions + important topics) ──────────
  let repeatedQuestions: Array<{ question: string; count: number }> = [];
  let importantTopics: Array<{ topic: string; priority: string }> = [];

  log("Calling AI for main analysis (step 2)…");
  const analysisRaw = await callAIWithRetry(ANALYSIS_PROMPT + combinedText, "analysis", log, logErr);

  if (analysisRaw === null) {
    logErr("Analysis AI call failed after 2 attempts — returning fallback");
    res.json(FALLBACK);
    return;
  }

  try {
    const parsed = safeExtractJSON(analysisRaw, "analysis", log) as {
      repeatedQuestions?: unknown[];
      importantTopics?: unknown[];
    };

    if (!Array.isArray(parsed.repeatedQuestions) || !Array.isArray(parsed.importantTopics)) {
      throw new Error("Response JSON missing required arrays (repeatedQuestions or importantTopics)");
    }

    repeatedQuestions = (parsed.repeatedQuestions as Array<{ question: string; count: number }>)
      .filter((q) => q && typeof q.question === "string" && typeof q.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    importantTopics = (parsed.importantTopics as Array<{ topic: string; priority: string }>)
      .filter((t) => t && typeof t.topic === "string" && ["High", "Medium", "Low"].includes(t.priority));

    log(`Analysis parsed: ${repeatedQuestions.length} repeated questions, ${importantTopics.length} topics`);
  } catch (err) {
    logErr("Failed to parse analysis JSON — returning fallback", err);
    res.json(FALLBACK);
    return;
  }

  // ── Step 3: Predicted questions (non-fatal — empty array on failure) ───────
  let expectedQuestions: string[] = [];

  if (repeatedQuestions.length > 0 || importantTopics.length > 0) {
    log("Calling AI for expected questions (step 3)…");
    const expectedRaw = await callAIWithRetry(
      buildExpectedQuestionsPrompt(repeatedQuestions, importantTopics),
      "expected-questions",
      log,
      logErr
    );

    if (expectedRaw !== null) {
      try {
        const parsed = safeExtractJSON(expectedRaw, "expected-questions", log) as {
          expectedQuestions?: unknown[];
        };
        if (!Array.isArray(parsed.expectedQuestions)) {
          throw new Error("expectedQuestions field is not an array");
        }
        expectedQuestions = (parsed.expectedQuestions as unknown[])
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .slice(0, 10);
        log(`Expected questions parsed: ${expectedQuestions.length} questions`);
      } catch (err) {
        logErr("Failed to parse expected questions JSON — using empty array", err);
      }
    } else {
      logErr("Expected questions AI call failed after 2 attempts — using empty array");
    }
  } else {
    log("Skipping expected questions — no analysis data to base them on");
  }

  // ── Step 4: Generate page images from first PDF (non-fatal) ──────────────
  const pageImages = await generatePageImages(files[0].buffer, files[0].originalname, log, logErr);

  // ── Always returns valid JSON ──────────────────────────────────────────────
  log(`Returning result: ${repeatedQuestions.length} repeated, ${importantTopics.length} topics, ${expectedQuestions.length} expected, ${pageImages.length} page images`);
  res.json({ repeatedQuestions, importantTopics, expectedQuestions, pageImages });
});

export default router;
