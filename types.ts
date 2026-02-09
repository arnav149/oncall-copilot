
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
}

export interface Runbook {
  id: string;
  name: string;
  symptoms: string[];
  checks: string[];
  likelyCauses: string[];
  remediation: string[];
}

export interface Telemetry {
  cpuUsage: number;
  dbConnections: number;
  redisLatency: number;
  threadPoolUsage: number;
  recentDeploy: string;
  errorRate: number;
  memoryUsage: number;
}

export interface ToolCall {
  id: string;
  tool: string;
  args: any;
  result: any;
  timestamp: string;
}

export interface Alert {
  id: string;
  title: string;
  service: string;
  severity: AlertSeverity;
  timestamp: string;
  region: string;
  telemetry: Telemetry;
  logs: string[];
}

export interface Step {
  id: string;
  action: string;
  reason: string;
  expectation: string;
  citesLogs: string[];
  citesRunbooks: string[];
  isCompleted?: boolean;
}

export interface CopilotState {
  summary: string;
  hypothesis: string;
  alternativeHypothesis?: string;
  confidence: number;
  evidenceLogs: string[];
  evidenceRunbooks: string[];
  steps: Step[];
  toolCalls: ToolCall[];
  commsDraft: string;
  estimatedTimeSavedMinutes: number;
  isInvestigationComplete: boolean;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state?: CopilotState;
}
