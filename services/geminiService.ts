
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Alert, CopilotState, Message, Runbook, ToolCall } from "../types";
import { MOCK_TOOL_DATA } from "../constants";

const TOOLS: FunctionDeclaration[] = [
  {
    name: 'get_alert_details',
    parameters: { type: Type.OBJECT, properties: { alert_id: { type: Type.STRING } }, required: ['alert_id'] }
  },
  {
    name: 'query_metrics',
    parameters: {
      type: Type.OBJECT,
      properties: {
        service: { type: Type.STRING },
        metric_names: { type: Type.ARRAY, items: { type: Type.STRING } },
      },
      required: ['service', 'metric_names']
    }
  },
  {
    name: 'query_logs',
    parameters: {
      type: Type.OBJECT,
      properties: {
        service: { type: Type.STRING },
        query: { type: Type.STRING },
      },
      required: ['service', 'query']
    }
  },
  {
    name: 'get_recent_deploys',
    parameters: { type: Type.OBJECT, properties: { service: { type: Type.STRING } }, required: ['service'] }
  },
  {
    name: 'get_feature_flags',
    parameters: { type: Type.OBJECT, properties: { service: { type: Type.STRING } }, required: ['service'] }
  },
  {
    name: 'get_dependency_health',
    parameters: { type: Type.OBJECT, properties: { service: { type: Type.STRING } }, required: ['service'] }
  },
  {
    name: 'run_runbook',
    parameters: { type: Type.OBJECT, properties: { service: { type: Type.STRING }, alert_type: { type: Type.STRING } }, required: ['service'] }
  }
];

const FINAL_STATE_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: { type: Type.STRING },
    hypothesis: { type: Type.STRING },
    alternativeHypothesis: { type: Type.STRING },
    confidence: { 
      type: Type.NUMBER, 
      description: 'The confidence level of the hypothesis as a float between 0.0 and 1.0 (e.g. 0.85 for 85%).' 
    },
    evidenceLogs: { type: Type.ARRAY, items: { type: Type.STRING } },
    evidenceRunbooks: { type: Type.ARRAY, items: { type: Type.STRING } },
    steps: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          action: { type: Type.STRING },
          reason: { type: Type.STRING },
          expectation: { type: Type.STRING },
          isCompleted: { type: Type.BOOLEAN }
        }
      }
    },
    commsDraft: { type: Type.STRING },
    estimatedTimeSavedMinutes: { type: Type.NUMBER }
  },
  required: ['summary', 'hypothesis', 'confidence', 'steps', 'commsDraft']
};

const delay = (ms: number) => new Promise(res => setTimeout(res, ms));

/**
 * Utility to wrap API calls with exponential backoff for rate limiting (429 errors).
 */
async function callWithRetry(fn: () => Promise<any>, retries = 5, initialDelayMs = 5000) {
  let currentDelay = initialDelayMs;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const errorMsg = error?.message || "";
      const isRateLimit = errorMsg.includes('429') || errorMsg.includes('RESOURCE_EXHAUSTED') || error?.status === 429;
      
      if (isRateLimit && i < retries - 1) {
        console.warn(`Quota limit reached. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
        await delay(currentDelay);
        currentDelay *= 1.5;
        continue;
      }
      throw error;
    }
  }
}

export async function runAutonomousInvestigation(
  alert: Alert,
  runbooks: Runbook[],
  onUpdate: (state: CopilotState) => void
) {
  let toolCalls: ToolCall[] = [];
  let currentMessages: any[] = [
    {
      role: 'user',
      parts: [{
        text: `Incident Investigation for Alert: ${alert.id}.
        Use tools to gather evidence. Current telemetry: ${JSON.stringify(alert.telemetry)}.
        
        GOAL: Reach >0.8 confidence or use max 8 tool calls.
        
        CRITICAL: Only output tool calls. Do not explain yourself until you are finished.`
      }]
    }
  ];

  const systemInstruction = "You are an expert SRE On-Call Copilot. Use tools to investigate incidents. Confidence scores must be a float between 0 and 1.";

  for (let i = 0; i < 8; i++) {
    if (i > 0) await delay(4000);

    const response = await callWithRetry(() => {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      return ai.models.generateContent({
        model: 'gemini-flash-lite-latest',
        contents: currentMessages,
        config: {
          tools: [{ functionDeclarations: TOOLS }],
          temperature: 0.1,
          systemInstruction,
          thinkingConfig: { thinkingBudget: 0 }
        }
      });
    });

    const call = response.candidates?.[0]?.content?.parts?.find(p => p.functionCall);
    if (call) {
      const { name, args } = call.functionCall!;
      const result = MOCK_TOOL_DATA[alert.id]?.[name] || { status: 'error', message: 'No data found for this tool in mock environment.' };
      
      const newCall: ToolCall = {
        id: `TOOL_${toolCalls.length + 1}`,
        tool: name,
        args,
        result,
        timestamp: new Date().toLocaleTimeString()
      };
      toolCalls = [...toolCalls, newCall];
      
      onUpdate({
        summary: 'Investigation in progress...',
        hypothesis: `Running ${name}...`,
        confidence: Math.min(0.8, 0.1 + (i * 0.1)),
        evidenceLogs: [],
        evidenceRunbooks: [],
        steps: [],
        toolCalls,
        commsDraft: '',
        estimatedTimeSavedMinutes: 0,
        isInvestigationComplete: false
      });

      currentMessages.push(response.candidates[0].content);
      currentMessages.push({
        role: 'user',
        parts: [{
          functionResponse: {
            name,
            response: { result }
          }
        }]
      });
    } else {
      break;
    }
  }

  // Final synthesis using gemini-3-pro-preview for deep reasoning
  await delay(3000); 
  const finalResponse = await callWithRetry(() => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    return ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        ...currentMessages,
        { role: 'user', parts: [{ text: "Gathered all evidence. Provide the final state in the requested JSON format. Ensure confidence is a number between 0 and 1." }] }
      ],
      config: {
        responseMimeType: 'application/json',
        responseSchema: FINAL_STATE_SCHEMA,
        systemInstruction: "You are an expert SRE. Provide the final investigation result in JSON. Use decimal values (0-1) for confidence.",
        thinkingConfig: { thinkingBudget: 32768 } // Max budget for gemini-3-pro-preview
      }
    });
  });
  
  const finalState = JSON.parse(finalResponse.text);
  onUpdate({
    ...finalState,
    toolCalls,
    isInvestigationComplete: true
  });
}
