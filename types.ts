
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
  stopCondition?: string;
  citesLogs: string[];
  citesRunbooks: string[];
  ifPassNext: string;
  ifFailNext: string;
}

export interface CopilotState {
  summary: string;
  hypothesis: string;
  confidence: number;
  evidenceLogs: string[];
  evidenceRunbooks: string[];
  steps: Step[];
  questionsToAsk: string[];
  missingSignals: string[];
  estimatedTimeSavedMinutes: number;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state?: CopilotState;
}
