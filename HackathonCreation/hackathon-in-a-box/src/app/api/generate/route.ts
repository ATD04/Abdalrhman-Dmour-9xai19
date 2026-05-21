import { NextRequest, NextResponse } from "next/server";
import { HackathonInputs, HackathonPlan, SkillLevel } from "@/lib/types";

export const runtime = "nodejs";

const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-2.5-flash-lite", "gemini-2.0-flash"];

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
}

function extractText(payload: unknown) {
  if (
    !payload ||
    typeof payload !== "object" ||
    !("candidates" in payload) ||
    !Array.isArray(payload.candidates)
  ) {
    return "";
  }

  return payload.candidates
    .flatMap((candidate) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        !("content" in candidate) ||
        !candidate.content ||
        typeof candidate.content !== "object" ||
        !("parts" in candidate.content) ||
        !Array.isArray(candidate.content.parts)
      ) {
        return [];
      }

      return candidate.content.parts.map((part: unknown) => {
        if (
          part &&
          typeof part === "object" &&
          "text" in part &&
          typeof part.text === "string"
        ) {
          return part.text;
        }

        return "";
      });
    })
    .filter(Boolean)
    .join("\n");
}

function parseJsonPlan(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

  return JSON.parse(cleaned) as Partial<HackathonPlan>;
}

function normalizeSkillLevel(value: unknown, fallback: SkillLevel): SkillLevel {
  const allowed: SkillLevel[] = ["Beginner", "Intermediate", "Advanced", "Mixed"];
  return allowed.includes(value as SkillLevel) ? (value as SkillLevel) : fallback;
}

function ensureArray<T>(value: unknown, fallback: T[]) {
  return Array.isArray(value) && value.length > 0 ? (value as T[]) : fallback;
}

function normalizePlan(plan: Partial<HackathonPlan>, inputs: HackathonInputs): HackathonPlan {
  const generationId = typeof plan.generationId === "string" ? plan.generationId : makeId("ai-plan");
  const tracks = ensureArray(plan.tracks, [
    {
      id: makeId("track"),
      name: "Core MVP Track",
      description: `Build the strongest practical prototype for ${inputs.domain}.`,
      difficulty: normalizeSkillLevel(inputs.skillLevels, "Mixed"),
    },
  ]).map((track, index) => ({
    id: track.id || makeId("track"),
    name: track.name || `Track ${index + 1}`,
    description: track.description || `A focused build track for ${inputs.domain}.`,
    difficulty: normalizeSkillLevel(track.difficulty, inputs.skillLevels),
  }));

  const firstTrackId = tracks[0]?.id || makeId("track");
  const ideaPrompts = ensureArray(plan.ideaPrompts, [
    {
      id: makeId("idea"),
      title: `${inputs.domain} MVP Starter`,
      description: "Create a demoable product that proves one important workflow from start to finish.",
      trackId: firstTrackId,
    },
  ]).map((idea, index) => ({
    id: idea.id || makeId("idea"),
    title: idea.title || `Starter Idea ${index + 1}`,
    description: idea.description || "Build a working prototype with a clear user flow.",
    trackId: tracks.some((track) => track.id === idea.trackId) ? idea.trackId : firstTrackId,
  }));

  return {
    generationId,
    name: plan.name || `${inputs.domain} Hackathon`,
    theme: plan.theme || `Build practical solutions for ${inputs.domain}`,
    purpose:
      plan.purpose ||
      `Create a ready-to-run hackathon where teams solve a real ${inputs.domain} problem through working software.`,
    nameMeaning:
      plan.nameMeaning ||
      "The name frames the event as a practical build sprint focused on useful, demoable outcomes.",
    coreChallenge:
      plan.coreChallenge ||
      `Build a functional MVP for ${inputs.domain} that helps a specific user complete one important task better.`,
    tracks,
    ideaPrompts,
    rulesGuidelines: ensureArray(plan.rulesGuidelines, [
      "Every team must submit a working demo or recorded walkthrough.",
      "Mock data is allowed when it is clearly labeled.",
      "Slide-only submissions do not qualify for main awards.",
    ]),
    techPrinciples: ensureArray(plan.techPrinciples, [
      { category: "Prototype Stack", recommendations: "Use a fast web or mobile stack that fits the event duration." },
      { category: "Data Strategy", recommendations: "Use mock data, CSV files, or lightweight hosted storage." },
    ]),
    teamFormat: {
      totalTeams: plan.teamFormat?.totalTeams || Math.ceil(inputs.participants / inputs.teamSize),
      distribution:
        plan.teamFormat?.distribution ||
        `${Math.ceil(inputs.participants / inputs.teamSize)} balanced teams`,
      logic:
        plan.teamFormat?.logic ||
        "Participants are distributed as evenly as possible so no team has a major size advantage.",
      tags: ensureArray(plan.teamFormat?.tags, ["Balanced Teams", "Cross-Functional Expected"]),
    },
    skillLeapfrog:
      plan.skillLeapfrog ||
      `The event advances the learning goals by forcing teams to turn ${inputs.learningGoals} into an actual working prototype.`,
    durationExplanation:
      plan.durationExplanation ||
      `The ${inputs.duration}-hour duration is structured around problem framing, rapid building, demo preparation, and judging.`,
    pulseChecks: ensureArray(plan.pulseChecks, [
      { time: "Midpoint", event: "Mentor review and scope correction" },
      { time: "Final stretch", event: "Demo readiness check" },
    ]),
    timeline: ensureArray(plan.timeline, [
      { time: "Start", event: "Kickoff and team formation" },
      { time: "Middle", event: "Build sprint and mentor rounds" },
      { time: "End", event: "Submission, demos, and judging" },
    ]),
    finalSubmission: ensureArray(plan.finalSubmission, [
      "Working MVP demo",
      "Repository or code bundle",
      "Short pitch explaining the problem, solution, and technical approach",
    ]),
    judgingCriteria: ensureArray(plan.judgingCriteria, [
      { name: "Prototype Functionality", weight: 30, description: "The core workflow works under demo conditions." },
      { name: "Problem Fit", weight: 25, description: "The solution clearly addresses the chosen problem." },
      { name: "User Experience", weight: 20, description: "The product is understandable and usable." },
      { name: "Technical Execution", weight: 15, description: "The architecture is appropriate for the event constraints." },
      { name: "Learning Stretch", weight: 10, description: "The team demonstrates growth tied to the learning goals." },
    ]),
    awards: ensureArray(plan.awards, [
      "Grand Prize: Best Overall MVP",
      "Best Technical Execution",
      "Best User Experience",
      "Most Creative Solution",
    ]),
    finalStandard:
      plan.finalStandard ||
      "A strong submission must show a coherent, working MVP and clearly explain what is real, mocked, and next.",
  };
}

function buildPrompt(inputs: HackathonInputs) {
  const randomSeed = makeId("variant");

  return `Create a complete, original Hackathon-in-a-Box plan.

The user inputs are:
${JSON.stringify(inputs, null, 2)}

Generation seed: ${randomSeed}

Rules:
- Generate a fresh variant every time, even if the topic is the same.
- Stay on the exact topic/domain the user gave.
- Make it realistic for the participant count, skill level, team size, duration, and learning goals.
- Return only valid JSON. Do not use markdown.
- Use this exact top-level shape:
{
  "generationId": "string",
  "name": "string",
  "theme": "string",
  "purpose": "string",
  "nameMeaning": "string",
  "coreChallenge": "string",
  "tracks": [{"id":"string","name":"string","description":"string","difficulty":"Beginner|Intermediate|Advanced|Mixed"}],
  "ideaPrompts": [{"id":"string","title":"string","description":"string","trackId":"string"}],
  "rulesGuidelines": ["string"],
  "techPrinciples": [{"category":"string","recommendations":"string"}],
  "teamFormat": {"totalTeams": 0, "distribution": "string", "logic": "string", "tags": ["string"]},
  "skillLeapfrog": "string",
  "durationExplanation": "string",
  "pulseChecks": [{"time":"string","event":"string"}],
  "timeline": [{"time":"string","event":"string"}],
  "finalSubmission": ["string"],
  "judgingCriteria": [{"name":"string","weight": 0,"description":"string"}],
  "awards": ["string"],
  "finalStandard": "string"
}

Quality requirements:
- Include exactly 3 challenge tracks.
- Include 4 starter idea prompts mapped to real track IDs.
- Include 5 rules/guidelines.
- Judging criteria weights must sum to 100.
- Team distribution must balance all participants, not leave anyone unassigned.
- Timeline must match the provided duration.`;
}

async function callGemini(model: string, inputs: HackathonInputs) {
  return fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": process.env.GEMINI_API_KEY || "",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [
          {
            text: "You are an expert hackathon organizer and product strategist. Generate practical, varied, ready-to-run hackathon plans as strict JSON.",
          },
        ],
      },
      contents: [
        {
          role: "user",
          parts: [{ text: buildPrompt(inputs) }],
        },
      ],
      generationConfig: {
        temperature: 0.95,
        responseMimeType: "application/json",
      },
    }),
  });
}

function extractGeminiError(detail: string) {
  try {
    const parsed = JSON.parse(detail);
    return parsed?.error?.message || detail;
  } catch {
    return detail;
  }
}

export async function POST(request: NextRequest) {
  if (!process.env.GEMINI_API_KEY) {
    return NextResponse.json(
      { error: "Missing GEMINI_API_KEY. Add it to .env.local and restart the dev server." },
      { status: 500 }
    );
  }

  const inputs = (await request.json()) as HackathonInputs;
  const models = [MODEL, ...FALLBACK_MODELS.filter((model) => model !== MODEL)];
  const attempts: string[] = [];

  for (const model of models) {
    const response = await callGemini(model, inputs);

    if (response.ok) {
      const payload = await response.json();
      const text = extractText(payload);
      const plan = normalizePlan(parseJsonPlan(text), inputs);

      return NextResponse.json({ plan, model });
    }

    const detail = await response.text();
    const message = extractGeminiError(detail);
    attempts.push(`${model}: ${message}`);

    if (![429, 500, 502, 503, 504].includes(response.status)) {
      return NextResponse.json(
        { error: message || "Gemini generation failed.", attempts },
        { status: response.status }
      );
    }
  }

  return NextResponse.json(
    {
      error: "Gemini is overloaded right now. Try again in a moment, or switch GEMINI_MODEL to gemini-2.5-flash-lite.",
      attempts,
    },
    { status: 503 }
  );
}
