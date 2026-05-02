import { Router } from "express";
import Anthropic from "@anthropic-ai/sdk";

const router = Router();

const anthropic = new Anthropic({
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
});

const PROMPT = (question: string) => `You are an expert university exam tutor. Generate a structured, exam-ready answer for the following question suitable for a 10-mark university paper.

Question: ${question}

Return ONLY a valid JSON object with this exact shape — no markdown, no extra text:
{
  "answer": {
    "definition": "A clear 1-2 sentence definition or direct answer to the question.",
    "explanation": [
      "First key point as a complete sentence.",
      "Second key point as a complete sentence.",
      "Third key point as a complete sentence.",
      "Fourth key point as a complete sentence."
    ],
    "example": "A concrete real-world or conceptual example that illustrates the concept. Omit this field only if no meaningful example exists.",
    "conclusion": "A concise 1-2 sentence conclusion summarising the answer."
  }
}

Rules:
- definition: one or two precise sentences, no filler.
- explanation: 3–5 bullet points, each a full sentence. Cover the who/what/why/how of the topic. Use simple, exam-friendly language.
- example: a single focused example. If it is an abstract concept, use an analogy. Do not skip this unless truly impossible.
- conclusion: wrap up with why the topic matters or what it achieves.
- Keep total length appropriate for a 10-mark answer — thorough but not padded.`;

router.post("/generate-answer", async (req, res) => {
  const { question } = req.body as { question?: string };

  if (!question || typeof question !== "string" || question.trim().length === 0) {
    res.status(400).json({ error: "A non-empty question is required." });
    return;
  }

  if (question.length > 1000) {
    res.status(400).json({ error: "Question must be under 1000 characters." });
    return;
  }

  try {
    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8192,
      messages: [{ role: "user", content: PROMPT(question.trim()) }],
    });

    const content = message.content[0];
    if (content.type !== "text") {
      res.status(500).json({ error: "Unexpected AI response format." });
      return;
    }

    let result: { answer: { definition: string; explanation: string[]; example?: string; conclusion: string } };
    try {
      const rawText = content.text.trim();
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (!jsonMatch) throw new Error("No JSON found");
      result = JSON.parse(jsonMatch[0]);
    } catch {
      res.status(500).json({ error: "Failed to parse AI response. Please try again." });
      return;
    }

    const { answer } = result;
    if (
      !answer ||
      typeof answer.definition !== "string" ||
      !Array.isArray(answer.explanation) ||
      typeof answer.conclusion !== "string"
    ) {
      res.status(500).json({ error: "AI returned an unexpected structure. Please try again." });
      return;
    }

    res.json({ answer });
  } catch (err) {
    req.log?.error({ err }, "generate-answer: Anthropic API error");
    res.status(500).json({ error: "Answer generation failed. Please try again." });
  }
});

export default router;
