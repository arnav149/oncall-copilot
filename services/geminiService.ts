
import { GoogleGenAI, Type } from "@google/genai";
import { Alert, CopilotState, Message, Runbook } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || '' });

const COPILOT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING, description: "Clear summary of the alert's impact, citing specific logs." },
    hypothesis: { type: Type.STRING, description: "The most likely cause, citing a specific Runbook and Log evidence." },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          action: { type: Type.STRING, description: "What the engineer should do (e.g. 'Per Runbook X, check Y')." },
          reason: { type: Type.STRING, description: "Why this step is necessary, referencing log patterns if relevant." },
          expectation: { type: Type.STRING, description: "What result confirms/rules out the hypothesis." }
        },
        required: ["action", "reason", "expectation"]
      }
    }
  },
  required: ["summary", "hypothesis", "steps"]
};

export const analyzeAlert = async (alert: Alert, runbooks: Runbook[]): Promise<CopilotState> => {
  const prompt = `
    You are an expert SRE On-Call Copilot. 
    Analyze the following alert using Telemetry, Runbooks, and Logs.
    
    ALERT: ${alert.title}
    SERVICE: ${alert.service}
    REGION: ${alert.region}
    
    TELEMETRY:
    ${JSON.stringify(alert.telemetry, null, 2)}

    LOGS:
    ${alert.logs.join('\n')}

    RUNBOOK KNOWLEDGE BASE:
    ${JSON.stringify(runbooks, null, 2)}

    CRITICAL INSTRUCTIONS:
    1. Your SUMMARY must mention specific log entries (e.g., 'Log pattern X observed').
    2. Your HYPOTHESIS must cite which RUNBOOK it follows and which LOG evidence influenced it.
    3. Your STEPS must be grounded in the provided Runbooks.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: COPILOT_SCHEMA,
    }
  });

  return JSON.parse(response.text);
};

export const updateInvestigation = async (
  alert: Alert, 
  history: Message[], 
  newFinding: string,
  runbooks: Runbook[]
): Promise<CopilotState> => {
  const chatHistory = history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n');
  
  const prompt = `
    You are an expert SRE On-Call Copilot.
    
    INCIDENT CONTEXT:
    Alert: ${alert.title}
    Original Logs: ${alert.logs.join('\n')}
    Runbooks: ${JSON.stringify(runbooks)}
    
    INVESTIGATION HISTORY:
    ${chatHistory}
    
    NEW FINDING FROM ENGINEER:
    "${newFinding}"
    
    EVOLVE THE INVESTIGATION:
    1. Update your hypothesis based on the finding + original logs + runbooks.
    2. Cite specific runbook sections if the finding confirms/rules out a symptom.
    3. Provide new investigation steps. If the cause is found, pivot to remediation steps from the Runbook.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: COPILOT_SCHEMA,
    }
  });

  return JSON.parse(response.text);
};
