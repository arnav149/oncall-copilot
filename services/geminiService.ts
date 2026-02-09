
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { Alert, CopilotState, Message, Runbook, ToolCall } from "../types";
import { MOCK_TOOL_DATA } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
    confidence: { type: Type.NUMBER },
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
        text: `Automated Investigation Triggered for Alert: ${alert.id} (${alert.title}). 
        Analyze this incident autonomously. Use the available tools to gather evidence. 
        Current telemetry: ${JSON.stringify(alert.telemetry)}.
        
        Instructions:
        1. Start by gathering baseline evidence (metrics, logs, deploys).
        2. Narrow down the hypothesis based on tool outputs.
        3. Aim for >80% confidence.
        4. Max 8 tool calls.
        5. Once you have a firm conclusion, provide the final investigation state in JSON.`
      }]
    }
  ];

  for (let i = 0; i < 8; i++) {
    // Add a throttle delay to help with quota issues
    if (i > 0) await delay(1500);

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview', // Switch to flash for high-frequency tool calling to avoid Pro quota limits
      contents: currentMessages,
      config: {
        tools: [{ functionDeclarations: TOOLS }],
        temperature: 0.1,
        thinkingConfig: { thinkingBudget: 2000 }
      }
    });

    const call = response.candidates[0].content.parts.find(p => p.functionCall);
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
      
      // Notify UI of progress
      onUpdate({
        summary: 'Investigation in progress...',
        hypothesis: 'Gathering more data...',
        confidence: Math.min(0.9, 0.1 + (i * 0.15)),
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
      // No more tool calls, model wants to provide final answer
      await delay(1000); // Final throttle before final extraction
      const finalResponse = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [
          ...currentMessages,
          { role: 'user', parts: [{ text: "Provide the final state now using the requested JSON schema. Be concise but thorough in the summary." }] }
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: FINAL_STATE_SCHEMA,
          thinkingConfig: { thinkingBudget: 2000 }
        }
      });
      
      const finalState = JSON.parse(finalResponse.text);
      onUpdate({
        ...finalState,
        toolCalls,
        isInvestigationComplete: true
      });
      return;
    }
  }
}
