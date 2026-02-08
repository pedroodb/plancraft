/**
 * LLM Judge for the Plancraft test suite.
 * Uses GPT-4.1 with vision to qualitatively evaluate generated floor plans.
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";

// ── Types ────────────────────────────────────────────────────────────────

export interface JudgeCriteria {
  specificationAdherence: number; // 1-5
  spatialLayout: number; // 1-5
  proportions: number; // 1-5
  completeness: number; // 1-5
  visualSimilarity?: number; // 1-5 (only for image tests)
  conversationCoherence?: number; // 1-5 (only for multi-step tests)
}

export interface JudgeResult {
  criteria: JudgeCriteria;
  justifications: {
    specificationAdherence: string;
    spatialLayout: string;
    proportions: string;
    completeness: string;
    visualSimilarity?: string;
    conversationCoherence?: string;
  };
  overallScore: number; // 0-100
  summary: string;
}

// ── Config ───────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  ".."
);

function loadApiKey(): string {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  try {
    const envFile = fs.readFileSync(
      path.join(REPO_ROOT, "packages/web/.env.local"),
      "utf-8"
    );
    return envFile.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const MODEL = "gpt-5.2";

// ── Judge ────────────────────────────────────────────────────────────────

export async function judgeResult(options: {
  testName: string;
  judgePrompt: string;
  svgSource: string | null;
  planSource: string;
  compilationSummary: string;
  referenceImagePath?: string;
  conversationLog?: string; // serialized conversation for multi-turn evaluation
  isMultiStep?: boolean;
}): Promise<JudgeResult> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not found");

  const openai = new OpenAI({ apiKey });

  const hasReferenceImage =
    options.referenceImagePath &&
    fs.existsSync(
      path.isAbsolute(options.referenceImagePath)
        ? options.referenceImagePath
        : path.join(REPO_ROOT, options.referenceImagePath)
    );

  const isMultiStep = options.isMultiStep ?? false;

  const criteriaList = [
    '1. **Specification Adherence** (1-5): Does the FINAL plan match what was asked for? Are ALL requested rooms, dimensions, and features present? For multi-step tests, evaluate against the CUMULATIVE specification from all user messages.',
    '2. **Spatial Layout** (1-5): Are rooms logically arranged? Do connections make sense architecturally? Is the flow between rooms reasonable?',
    '3. **Proportions** (1-5): Do room sizes look reasonable for their purpose? Are dimensions realistic? Bathrooms should be >= 3m², bedrooms >= 8m², kitchens >= 6m², living rooms >= 12m². Hallways should NOT dominate the floor area.',
    '4. **Completeness** (1-5): Are all requested elements present? Are doors, windows, and furniture included where expected? For multi-step tests, are ALL elements from ALL messages present?',
  ];

  if (hasReferenceImage) {
    criteriaList.push('5. **Visual Similarity** (1-5): How closely does the generated plan match the reference image in terms of layout, room arrangement, and overall shape?');
  }

  if (isMultiStep) {
    criteriaList.push(`${hasReferenceImage ? '6' : '5'}. **Conversation Coherence** (1-5): Did the agent correctly handle the multi-step conversation? Evaluate: (a) Were ALL user requests across ALL messages incorporated? (b) When the user changed their mind, was the previous version correctly modified (not rebuilt from scratch)? (c) Were earlier decisions preserved when new requests were added? (d) Does the final plan reflect the cumulative intent of all messages?`);
  }

  const jsonCriteriaKeys = [
    '"specificationAdherence": <1-5>',
    '"spatialLayout": <1-5>',
    '"proportions": <1-5>',
    '"completeness": <1-5>',
  ];
  const jsonJustificationKeys = [
    '"specificationAdherence": "<1-2 sentences>"',
    '"spatialLayout": "<1-2 sentences>"',
    '"proportions": "<1-2 sentences>"',
    '"completeness": "<1-2 sentences>"',
  ];

  if (hasReferenceImage) {
    jsonCriteriaKeys.push('"visualSimilarity": <1-5>');
    jsonJustificationKeys.push('"visualSimilarity": "<1-2 sentences>"');
  }

  if (isMultiStep) {
    jsonCriteriaKeys.push('"conversationCoherence": <1-5>');
    jsonJustificationKeys.push('"conversationCoherence": "<1-2 sentences>"');
  }

  const systemPrompt = `You are an expert architectural floor plan evaluator. You will be given a floor plan specification, the generated plan source code, compilation results, and optionally an SVG rendering, reference image, and/or conversation log.

Your job is to evaluate the quality of the generated floor plan on these criteria (rate each 1-5):

${criteriaList.join('\n')}

IMPORTANT SCORING GUIDELINES:
- A score of 5 means excellent, near-perfect execution
- A score of 4 means good with minor issues
- A score of 3 means acceptable with notable issues
- A score of 2 means poor with significant problems
- A score of 1 means failing or missing
- Focus on whether the plan MATCHES WHAT WAS REQUESTED — adherence to the specification is the most important criterion
- For multi-step tests, conversation coherence (maintaining all elements across messages) is critical
- Be generous with proportions unless the specification gave exact dimensions that were not met

Respond with ONLY a valid JSON object in this exact format (no markdown fences):
{
  "criteria": {
    ${jsonCriteriaKeys.join(',\n    ')}
  },
  "justifications": {
    ${jsonJustificationKeys.join(',\n    ')}
  },
  "summary": "<2-3 sentence overall assessment>"
}`;

  // Build content array
  const userContent: OpenAI.ChatCompletionContentPart[] = [];

  // Add reference image if available
  if (hasReferenceImage) {
    const imgPath = path.isAbsolute(options.referenceImagePath!)
      ? options.referenceImagePath!
      : path.join(REPO_ROOT, options.referenceImagePath!);
    const imageData = fs.readFileSync(imgPath);
    const base64 = imageData.toString("base64");
    const ext = path.extname(imgPath).slice(1).toLowerCase();
    const mime = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
    userContent.push({
      type: "image_url",
      image_url: { url: `data:${mime};base64,${base64}`, detail: "high" },
    });
  }

  // Add text content
  const textParts = [
    `## Test: ${options.testName}`,
    `## Specification\n${options.judgePrompt}`,
    `## Compilation Results\n${options.compilationSummary}`,
  ];

  if (options.svgSource) {
    textParts.push(
      `## Generated SVG (first 5000 chars)\n\`\`\`svg\n${options.svgSource.substring(0, 5000)}\n\`\`\``
    );
  }

  // Include the plan source (truncated if very long)
  const planPreview =
    options.planSource.length > 3000
      ? options.planSource.substring(0, 3000) + "\n// ... (truncated)"
      : options.planSource;
  textParts.push(
    `## Generated Plan Source\n\`\`\`jsonc\n${planPreview}\n\`\`\``
  );

  if (hasReferenceImage) {
    textParts.push(
      "## Reference Image\nThe reference image is provided above. Compare the generated plan against it."
    );
  }

  // Include conversation log for multi-step tests
  if (isMultiStep && options.conversationLog) {
    const convPreview =
      options.conversationLog.length > 4000
        ? options.conversationLog.substring(0, 4000) + "\n// ... (truncated)"
        : options.conversationLog;
    textParts.push(
      `## Conversation Log (user messages and key agent actions)\n${convPreview}`
    );
  }

  userContent.push({ type: "text", text: textParts.join("\n\n") });

  const response = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userContent },
    ],
  });

  const responseText = response.choices[0]?.message?.content ?? "";

  // Parse JSON response
  try {
    // Try to extract JSON from the response (handle potential markdown fences)
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in judge response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const criteria: JudgeCriteria = {
      specificationAdherence: clamp(parsed.criteria?.specificationAdherence ?? 1, 1, 5),
      spatialLayout: clamp(parsed.criteria?.spatialLayout ?? 1, 1, 5),
      proportions: clamp(parsed.criteria?.proportions ?? 1, 1, 5),
      completeness: clamp(parsed.criteria?.completeness ?? 1, 1, 5),
      ...(parsed.criteria?.visualSimilarity !== undefined
        ? { visualSimilarity: clamp(parsed.criteria.visualSimilarity, 1, 5) }
        : {}),
      ...(parsed.criteria?.conversationCoherence !== undefined
        ? { conversationCoherence: clamp(parsed.criteria.conversationCoherence, 1, 5) }
        : {}),
    };

    // Calculate overall score: average of criteria * 20 = 0-100
    const values = Object.values(criteria).filter(
      (v): v is number => v !== undefined
    );
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    const overallScore = Math.round(avg * 20);

    return {
      criteria,
      justifications: {
        specificationAdherence:
          parsed.justifications?.specificationAdherence ?? "",
        spatialLayout: parsed.justifications?.spatialLayout ?? "",
        proportions: parsed.justifications?.proportions ?? "",
        completeness: parsed.justifications?.completeness ?? "",
        ...(parsed.justifications?.visualSimilarity !== undefined
          ? { visualSimilarity: parsed.justifications.visualSimilarity }
          : {}),
        ...(parsed.justifications?.conversationCoherence !== undefined
          ? { conversationCoherence: parsed.justifications.conversationCoherence }
          : {}),
      },
      overallScore,
      summary: parsed.summary ?? "",
    };
  } catch (e) {
    console.error(
      `Failed to parse judge response: ${e instanceof Error ? e.message : e}`
    );
    console.error(`Raw response: ${responseText.substring(0, 500)}`);
    return {
      criteria: {
        specificationAdherence: 1,
        spatialLayout: 1,
        proportions: 1,
        completeness: 1,
      },
      justifications: {
        specificationAdherence: "Failed to parse judge response",
        spatialLayout: "",
        proportions: "",
        completeness: "",
      },
      overallScore: 20,
      summary: `Judge evaluation failed: ${e instanceof Error ? e.message : e}`,
    };
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
