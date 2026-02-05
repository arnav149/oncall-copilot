
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
  action: string;
  reason: string;
  expectation: string;
}

export interface CopilotState {
  summary: string;
  hypothesis: string;
  steps: Step[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  state?: CopilotState;
}
