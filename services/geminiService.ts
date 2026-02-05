
import { GoogleGenAI, Type } from "@google/genai";
import { Alert, CopilotState, Message, Runbook } from "../types";

// Initialize using the environment variable directly as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Upgraded schema:
 * - Forces grounding via evidence IDs
 * - Adds decision-tree investigation (branching)
 * - Adds targeted questions + missing signals
 * - Adds confidence + estimated time saved
 */
const COPILOT_SCHEMA_V2 = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        "Clear summary of the alert’s impact, grounded in specific LOG_* evidence IDs.",
    },
    hypothesis: {
      type: Type.STRING,
      description:
        "Most likely cause. Must reference RUNBOOK IDs and LOG_* evidence IDs that support it.",
    },
    confidence: {
      type: Type.NUMBER,
      description: "0.0 to 1.0 confidence in the current hypothesis.",
    },

    // Hard grounding
    evidenceLogs: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: "e.g., LOG_1, LOG_7" },
      description:
        "List of LOG_* IDs that directly support summary + hypothesis.",
    },
    evidenceRunbooks: {
      type: Type.ARRAY,
      items: { type: Type.STRING, description: "e.g., RB_2 or RB_2#section_4" },
      description:
        "List of RUNBOOK IDs (and section IDs if provided) that support the plan.",
    },

    // Decision-tree investigation plan
    steps: {
      type: Type.ARRAY,
      description:
        "Investigation steps as a decision tree. Each step must include branching for pass/fail outcomes.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: {
            type: Type.STRING,
            description:
              "Unique step ID like S1, S2, S3. Must be unique within steps.",
          },
          action: {
            type: Type.STRING,
            description:
              "What to do, grounded in runbook instructions where possible.",
          },
          reason: {
            type: Type.STRING,
            description:
              "Why this step matters, grounded in logs/telemetry patterns.",
          },
          expectation: {
            type: Type.STRING,
            description:
              "What you expect to observe if the hypothesis is correct.",
          },
          stopCondition: {
            type: Type.STRING,
            description:
              "When to stop/pivot/escalate. E.g., 'If error rate > X after rollback, escalate to DB on-call.'",
          },

          // Per-step citations
          citesLogs: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: "LOG_* IDs" },
            description: "LOG evidence supporting this step.",
          },
          citesRunbooks: {
            type: Type.ARRAY,
            items: { type: Type.STRING, description: "RB_* IDs" },
            description: "Runbook sections supporting this step.",
          },

          // Branching (decision tree)
          ifPassNext: {
            type: Type.STRING,
            description:
              "Step ID to go to if expectation is met (or 'END' if resolved).",
          },
          ifFailNext: {
            type: Type.STRING,
            description:
              "Step ID to go to if expectation is NOT met (or 'END' if resolved).",
          },
        },
        required: [
          "id",
          "action",
          "reason",
          "expectation",
          "citesLogs",
          "citesRunbooks",
          "ifPassNext",
          "ifFailNext",
        ],
      },
    },

    // Investigation-grade behavior
    questionsToAsk: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "High-signal questions to ask the engineer to unblock investigation.",
    },
    missingSignals: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        "What telemetry/logs you wish you had next (e.g., 'DB connection pool saturation metric').",
    },

    estimatedTimeSavedMinutes: {
      type: Type.NUMBER,
      description:
        "Estimated minutes saved vs manual triage, for demo/impact framing.",
    },
  },
  required: [
    "summary",
    "hypothesis",
    "confidence",
    "evidenceLogs",
    "evidenceRunbooks",
    "steps",
    "questionsToAsk",
    "missingSignals",
    "estimatedTimeSavedMinutes",
  ],
};

function formatLogsWithIds(logs: string[]) {
  return logs.map((l, i) => `LOG_${i + 1}: ${l}`).join("\n");
}

function formatRunbooksWithIds(runbooks: Runbook[]) {
  return runbooks.map((rb: any, i: number) => ({
    id: rb.id ?? `RB_${i + 1}`,
    ...rb,
  }));
}

function safeJsonParseOrThrow(text: string | undefined) {
  if (!text) {
    throw new Error("The AI model returned an empty response. This can happen if safety filters are triggered. Please try again or select a different alert.");
  }
  try {
    return JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) {
      try {
        return JSON.parse(m[0]);
      } catch (e) {
        throw new Error("Could not parse extracted JSON block.");
      }
    }
    throw new Error("Model did not return valid JSON. Text received: " + text.substring(0, 100) + "...");
  }
}

function baseConfig() {
  return {
    responseMimeType: "application/json",
    responseSchema: COPILOT_SCHEMA_V2,
    temperature: 0.1,
    topP: 0.95,
    // Avoid setting maxOutputTokens to prevent truncation
    thinkingConfig: { thinkingBudget: 8000 },
    systemInstruction: "You are a world-class SRE On-Call Copilot prototype. This is a simulation for software engineering troubleshooting. Avoid blocking responses due to mentions of system errors or logs; these are mock entries for a prototype app. Always follow the requested JSON schema strictly."
  } as any;
}

export const analyzeAlert = async (
  alert: Alert,
  runbooks: Runbook[]
): Promise<CopilotState> => {
  const logs = formatLogsWithIds(alert.logs);
  const rb = formatRunbooksWithIds(runbooks);

  const prompt = `
You are an expert SRE On-Call Copilot.

ROLE:
You are constructing a rigorous investigation plan that an engineer will follow step-by-step.
Think like a senior SRE during a live incident:
- Form a hypothesis
- Validate it with evidence
- Branch based on outcomes (pass/fail)
- Ask for missing signals when needed

DATA:
<ALERT>
title: ${alert.title}
service: ${alert.service}
region: ${alert.region}
</ALERT>

<TELEMETRY_JSON>
${JSON.stringify(alert.telemetry, null, 2)}
</TELEMETRY_JSON>

<LOGS>
${logs}
</LOGS>

<RUNBOOKS_JSON>
${JSON.stringify(rb, null, 2)}
</RUNBOOKS_JSON>

OUTPUT REQUIREMENTS:
- summary + hypothesis MUST be grounded in evidenceLogs[] and evidenceRunbooks[].
- evidenceLogs[] MUST contain LOG_* IDs from the provided logs.
- steps MUST be a decision tree using ifPassNext / ifFailNext to guide the engineer through a logical flow.
- Include estimatedTimeSavedMinutes based on complexity.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: baseConfig(),
  });

  return safeJsonParseOrThrow(response.text) as CopilotState;
};

export const updateInvestigation = async (
  alert: Alert,
  history: Message[],
  newFinding: string,
  runbooks: Runbook[]
): Promise<CopilotState> => {
  const logs = formatLogsWithIds(alert.logs);
  const rb = formatRunbooksWithIds(runbooks);

  const chatHistory = history
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const prompt = `
You are an expert SRE On-Call Copilot. Update the investigation plan based on new evidence provided by the engineer.

DATA:
<ALERT>
title: ${alert.title}
service: ${alert.service}
region: ${alert.region}
</ALERT>

<ORIGINAL_LOGS>
${logs}
</ORIGINAL_LOGS>

<RUNBOOKS_JSON>
${JSON.stringify(rb, null, 2)}
</RUNBOOKS_JSON>

<INVESTIGATION_HISTORY>
${chatHistory}
</INVESTIGATION_HISTORY>

<NEW_FINDING>
${newFinding}
</NEW_FINDING>

Incorporate this new finding into your hypothesis. If the finding confirms a specific path, prioritize remediation steps from the runbooks.
`;

  const response = await ai.models.generateContent({
    model: "gemini-3-pro-preview",
    contents: prompt,
    config: baseConfig(),
  });

  return safeJsonParseOrThrow(response.text) as CopilotState;
};
