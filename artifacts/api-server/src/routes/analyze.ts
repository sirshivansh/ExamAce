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
    if (file.mimetype === "application/pdf") cb(null, true);
    else cb(new Error("Only PDF files are allowed"));
  },
});

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

const FALLBACK = { repeatedQuestions: [], importantTopics: [], expectedQuestions: [], questions: [], pageImages: {} };

// ── Shared types ──────────────────────────────────────────────────────────────
interface ExtractedQuestion {
  question: string;
  snippet: string;
  source: { fileName: string; page: number };
}

// ── Question extraction from plain text ───────────────────────────────────────
function extractQuestionsFromText(
  text: string,
  fileName: string,
  totalPages: number
): ExtractedQuestion[] {
  const lines = text.split("\n");
  const results: ExtractedQuestion[] = [];
  const charsPerPage = text.length / Math.max(totalPages, 1);
  let charOffset = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    charOffset += raw.length + 1;
    const line = raw.trim();

    // Match: "1.", "Q1.", "(1)", "Question 1:", etc.
    const m = line.match(/^(?:Q(?:uestion)?\.?\s*)?(\d{1,3})[.):\-–]\s+(.{12,})/i);
    if (!m) continue;

    // Gather continuation lines (up to 3 non-empty lines that don't start a new question)
    const parts = [m[2]];
    for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
      const next = lines[j].trim();
      if (!next) break;
      if (/^(?:Q(?:uestion)?\.?\s*)?\d{1,3}[.):\-–]\s/.test(next)) break;
      parts.push(next);
    }

    const fullQuestion = parts.join(" ").replace(/\s+/g, " ").trim();
    if (fullQuestion.length < 15) continue;

    const estimatedPage = Math.max(1, Math.min(Math.ceil(charOffset / charsPerPage), totalPages));
    const words = fullQuestion.split(/\s+/);
    const snippet = words.slice(0, 10).join(" ");

    results.push({
      question: fullQuestion.slice(0, 500),
      snippet,
      source: { fileName, page: estimatedPage },
    });
  }

  return results.slice(0, 60);
}

// ── AI prompts ────────────────────────────────────────────────────────────────
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
- Rank each topic as "High", "Medium", or "Low" priority.
- Be specific — avoid vague topics like "General Knowledge".
- Each item: { "topic": string, "priority": "High" | "Medium" | "Low" }

Return ONLY a valid JSON object — no markdown, no extra text:
{
  "repeatedQuestions": [{ "question": "...", "count": 4 }],
  "importantTopics": [{ "topic": "...", "priority": "High" }]
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

Rules:
1. Do NOT copy the repeated questions verbatim — rephrase them.
2. Favour High-priority topics.
3. Write university-level questions using verbs like "Explain", "Discuss", "Compare", "Analyse".
4. Each question should be suitable for a 10-mark answer.
5. Return 5–10 questions total.

Return ONLY:
{ "expectedQuestions": ["...", "..."] }`;

// ── AI helpers ────────────────────────────────────────────────────────────────
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

function safeExtractJSON(raw: string, label: string, log: (m: string) => void): unknown {
  log(`[${label}] Raw AI (first 500): ${raw.slice(0, 500)}${raw.length > 500 ? "…" : ""}`);
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) throw new Error(`[${label}] No JSON braces found`);
  return JSON.parse(raw.slice(first, last + 1));
}

async function callAIWithRetry(
  prompt: string,
  label: string,
  log: (m: string) => void,
  logErr: (m: string, e?: unknown) => void
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      log(`[${label}] AI call attempt ${attempt}…`);
      const text = await callAI(prompt);
      log(`[${label}] AI responded length=${text.length}`);
      return text;
    } catch (err) {
      logErr(`[${label}] AI call failed (attempt ${attempt})`, err);
      if (attempt === 2) return null;
    }
  }
  return null;
}

// ── OCR fallback ──────────────────────────────────────────────────────────────
async function ocrPdf(
  pdfBuffer: Buffer,
  fileName: string,
  log: (m: string) => void,
  logErr: (m: string, e?: unknown) => void
): Promise<string | null> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "examace-ocr-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    log(`[OCR] Running pdftoppm on "${fileName}"…`);
    await execFileAsync("pdftoppm", ["-r", "200", "-png", "-l", "10", pdfPath, imgPrefix]);
    const files = (await fs.readdir(tmpDir)).filter(f => f.endsWith(".png")).sort().map(f => path.join(tmpDir, f));
    if (files.length === 0) { log(`[OCR] No PNGs for "${fileName}"`); return null; }
    log(`[OCR] ${files.length} pages for "${fileName}"`);
    const { createWorker } = await import("tesseract.js");
    const worker = await createWorker("eng", 1, { logger: () => {} });
    const texts: string[] = [];
    for (let i = 0; i < files.length; i++) {
      log(`[OCR] Recognising page ${i + 1}/${files.length}…`);
      const { data } = await worker.recognize(await fs.readFile(files[i]));
      texts.push(data.text);
    }
    await worker.terminate();
    const combined = texts.join("\n\n");
    log(`[OCR] OCR text length: ${combined.length} for "${fileName}"`);
    return combined;
  } catch (err) {
    logErr(`[OCR] Failed for "${fileName}"`, err);
    return null;
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Page image generation ─────────────────────────────────────────────────────
async function generatePageImages(
  pdfBuffer: Buffer,
  fileName: string,
  log: (m: string) => void,
  logErr: (m: string, e?: unknown) => void
): Promise<string[]> {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "examace-pages-"));
  const pdfPath = path.join(tmpDir, "input.pdf");
  const imgPrefix = path.join(tmpDir, "page");
  try {
    await fs.writeFile(pdfPath, pdfBuffer);
    log(`[pages] pdftoppm on "${fileName}" (first 5 pages)…`);
    await execFileAsync("pdftoppm", ["-r", "130", "-png", "-l", "5", pdfPath, imgPrefix]);
    const pngPaths = (await fs.readdir(tmpDir))
      .filter(f => f.endsWith(".png"))
      .sort()
      .slice(0, 5)
      .map(f => path.join(tmpDir, f));
    const dataUrls: string[] = [];
    for (const p of pngPaths) {
      const buf = await fs.readFile(p);
      dataUrls.push(`data:image/png;base64,${buf.toString("base64")}`);
    }
    log(`[pages] Generated ${dataUrls.length} page image(s) for "${fileName}"`);
    return dataUrls;
  } catch (err) {
    logErr(`[pages] Failed for "${fileName}"`, err);
    return [];
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
  }
}

// ── Route ─────────────────────────────────────────────────────────────────────
router.post("/analyze", upload.array("file", 10), async (req, res) => {
  const log = (msg: string) => req.log.info(msg);
  const logErr = (msg: string, err?: unknown) => {
    req.log.error({ err, stack: err instanceof Error ? err.stack : String(err) }, msg);
  };

  log("POST /api/analyze — request received");

  const files = req.files as Express.Multer.File[] | undefined;
  if (!files || files.length === 0) {
    res.status(400).json({ error: "No PDF files uploaded" });
    return;
  }

  log(`Files received: ${files.length} — [${files.map(f => f.originalname).join(", ")}]`);

  // ── Step 1: Parse each PDF (with OCR fallback), extract questions, gather images ──
  const textParts: string[] = [];
  const allQuestions: ExtractedQuestion[] = [];
  const pageImages: Record<string, string[]> = {};

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    log(`Processing PDF ${i + 1}/${files.length}: "${f.originalname}" (${f.size} bytes)…`);

    let text = "";
    let totalPages = 1;

    // Text extraction
    try {
      const parsed = await pdfParse(f.buffer);
      text = parsed.text ?? "";
      totalPages = parsed.numpages ?? 1;
      log(`PDF ${i + 1} parsed: ${text.length} chars, ${totalPages} pages`);
    } catch (err) {
      logErr(`PDF ${i + 1} pdf-parse failed — trying OCR`, err);
    }

    // OCR fallback for scanned PDFs
    if (text.trim().length < 100) {
      log(`PDF ${i + 1}: text short (<100 chars) — Using OCR fallback for "${f.originalname}"`);
      const ocrText = await ocrPdf(f.buffer, f.originalname, log, logErr);
      if (ocrText && ocrText.trim().length >= 100) {
        log(`OCR text length: ${ocrText.length} chars for "${f.originalname}"`);
        text = ocrText;
      } else {
        log(`OCR also failed for "${f.originalname}" — skipping`);
        continue;
      }
    }

    textParts.push(text);

    // Extract questions from this PDF's text
    const pdfQuestions = extractQuestionsFromText(text, f.originalname, totalPages);
    log(`Extracted ${pdfQuestions.length} questions from "${f.originalname}"`);
    allQuestions.push(...pdfQuestions);

    // Generate page images for this PDF (non-fatal)
    const imgs = await generatePageImages(f.buffer, f.originalname, log, logErr);
    pageImages[f.originalname] = imgs;
  }

  if (textParts.length === 0) {
    log("All PDFs were unreadable — returning 400");
    res.status(400).json({ error: "Could not read this PDF. Try a clearer file." });
    return;
  }

  const combinedText = textParts.join("\n\n---\n\n").slice(0, 14000);
  log(`Combined text: ${combinedText.length} chars from ${textParts.length} readable PDF(s)`);

  // ── Step 2: AI analysis ────────────────────────────────────────────────────
  let repeatedQuestions: Array<{ question: string; count: number }> = [];
  let importantTopics: Array<{ topic: string; priority: string }> = [];

  log("Calling AI for main analysis…");
  const analysisRaw = await callAIWithRetry(ANALYSIS_PROMPT + combinedText, "analysis", log, logErr);

  if (analysisRaw === null) {
    logErr("Analysis AI failed — returning fallback");
    res.json({ ...FALLBACK, questions: allQuestions, pageImages });
    return;
  }

  try {
    const parsed = safeExtractJSON(analysisRaw, "analysis", log) as {
      repeatedQuestions?: unknown[];
      importantTopics?: unknown[];
    };
    if (!Array.isArray(parsed.repeatedQuestions) || !Array.isArray(parsed.importantTopics)) {
      throw new Error("Missing required arrays");
    }
    repeatedQuestions = (parsed.repeatedQuestions as Array<{ question: string; count: number }>)
      .filter(q => q && typeof q.question === "string" && typeof q.count === "number")
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    importantTopics = (parsed.importantTopics as Array<{ topic: string; priority: string }>)
      .filter(t => t && typeof t.topic === "string" && ["High", "Medium", "Low"].includes(t.priority));
    log(`Analysis: ${repeatedQuestions.length} repeated, ${importantTopics.length} topics`);
  } catch (err) {
    logErr("Failed to parse analysis JSON — returning with extracted questions", err);
    res.json({ ...FALLBACK, repeatedQuestions: [], importantTopics: [], questions: allQuestions, pageImages });
    return;
  }

  // ── Step 3: Predicted questions ────────────────────────────────────────────
  let expectedQuestions: string[] = [];

  if (repeatedQuestions.length > 0 || importantTopics.length > 0) {
    log("Calling AI for expected questions…");
    const expectedRaw = await callAIWithRetry(
      buildExpectedQuestionsPrompt(repeatedQuestions, importantTopics),
      "expected-questions",
      log,
      logErr
    );
    if (expectedRaw !== null) {
      try {
        const parsed = safeExtractJSON(expectedRaw, "expected-questions", log) as { expectedQuestions?: unknown[] };
        if (!Array.isArray(parsed.expectedQuestions)) throw new Error("Not an array");
        expectedQuestions = (parsed.expectedQuestions as unknown[])
          .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
          .slice(0, 10);
        log(`Expected questions: ${expectedQuestions.length}`);
      } catch (err) {
        logErr("Failed to parse expected questions", err);
      }
    }
  }

  // ── Return ─────────────────────────────────────────────────────────────────
  log(`Result: ${repeatedQuestions.length} repeated, ${importantTopics.length} topics, ${expectedQuestions.length} expected, ${allQuestions.length} extracted, ${Object.keys(pageImages).length} PDFs with images`);
  res.json({ repeatedQuestions, importantTopics, expectedQuestions, questions: allQuestions, pageImages });
});

export default router;
