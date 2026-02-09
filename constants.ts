
import { Alert, AlertSeverity, Runbook } from './types';

export const MOCK_RUNBOOKS: Runbook[] = [
  {
    id: 'RB-A',
    name: 'API 5xx Spikes',
    symptoms: ['Elevated HTTP 500/502/503 rates', 'Increased latency in edge nodes'],
    checks: ['Check upstream service health', 'Verify recent deployment stability', 'Inspect for timeout patterns in logs'],
    likelyCauses: ['Downstream dependency failure', 'Bad code deploy', 'Resource exhaustion'],
    remediation: ['Rollback last deploy', 'Scale API instances', 'Circuit break failing downstream']
  },
  {
    id: 'RB-B',
    name: 'DB Connection Pool Exhaustion',
    symptoms: ['DB connection timeouts', 'App service thread pool saturation', 'High DB CPU'],
    checks: ['Count active connections vs max', 'Check slow query logs', 'Identify connection leaks'],
    likelyCauses: ['Missing connection closing', 'Burst in traffic', 'Degraded DB performance'],
    remediation: ['Kill long-running queries', 'Increase pool size', 'Scale DB read replicas']
  },
  {
    id: 'RB-C',
    name: 'Redis Latency / Cache Saturation',
    symptoms: ['Increased Redis response time', 'High cache miss rate', 'Application latency spikes'],
    checks: ['Check Redis CPU and Memory', 'Verify network throughput', 'Inspect keyspace eviction rate'],
    likelyCauses: ['Hot key access', 'Memory fragmentation', 'Network congestion'],
    remediation: ['Flush non-critical keys', 'Scale Redis cluster', 'Implement client-side caching']
  }
];

export const MOCK_ALERTS: Alert[] = [
  {
    id: 'ALRT-001',
    title: 'API 5xx rate > 5% in us-east-1',
    service: 'API',
    severity: AlertSeverity.CRITICAL,
    region: 'us-east-1',
    timestamp: new Date(Date.now() - 4 * 60000).toISOString(),
    telemetry: {
      cpuUsage: 45,
      dbConnections: 42,
      redisLatency: 12,
      threadPoolUsage: 25,
      recentDeploy: 'API v2.4.1 (12 mins ago)',
      errorRate: 6.2,
      memoryUsage: 58
    },
    logs: [
      "ERROR [API] Upstream 'PaymentSvc' timed out after 2000ms",
      "WARN [API] Retrying PaymentSvc call (attempt 1/3)",
      "ERROR [API] 502 Bad Gateway: PaymentSvc unreachable"
    ]
  },
  {
    id: 'ALRT-002',
    title: 'PaymentSvc latency > 2s',
    service: 'PaymentSvc',
    severity: AlertSeverity.CRITICAL,
    region: 'us-west-2',
    timestamp: new Date(Date.now() - 2 * 60000).toISOString(),
    telemetry: {
      cpuUsage: 32,
      dbConnections: 88,
      redisLatency: 450,
      threadPoolUsage: 92,
      recentDeploy: 'PaymentSvc v1.2.4 (15 mins ago)',
      errorRate: 1.1,
      memoryUsage: 74
    },
    logs: [
      "WARN [PaymentSvc] Redis command GET 'session_992' took 420ms",
      "ERROR [PaymentSvc] Cache access degraded; falling back to DB"
    ]
  }
];

// Map of Alert IDs to specific tool results to simulate a real environment
export const MOCK_TOOL_DATA: Record<string, Record<string, any>> = {
  'ALRT-001': {
    'get_alert_details': { status: 'success', data: { id: 'ALRT-001', status: 'firing', created_at: '4m ago', labels: { severity: 'critical', region: 'us-east-1' } } },
    'query_metrics': { status: 'success', data: { 'api_5xx_rate': [0.1, 0.4, 6.2, 5.8], 'paymentsvc_latency': [120, 150, 2100, 2050] } },
    'get_recent_deploys': { status: 'success', data: [{ service: 'API', version: 'v2.4.1', deployed_at: '12m ago', result: 'Success' }] },
    'get_dependency_health': { status: 'success', data: { 'PaymentSvc': 'Degraded', 'AuthSvc': 'Healthy', 'DB': 'Healthy' } },
    'query_logs': { status: 'success', data: ["LOG_1: java.net.ConnectException: Connection refused to PaymentSvc:8080", "LOG_2: Request ID: req-442 Failed after 3 retries"] },
    'run_runbook': { status: 'success', data: { name: 'API 5xx Spikes', suggested_action: 'Check PaymentSvc health immediately' } },
    'get_feature_flags': { status: 'success', data: [] }
  },
  'ALRT-002': {
    'get_alert_details': { status: 'success', data: { id: 'ALRT-002', status: 'firing', created_at: '2m ago', labels: { severity: 'critical', region: 'us-west-2' } } },
    'query_metrics': { status: 'success', data: { 'redis_latency': [5, 8, 450, 480], 'redis_cpu': [12, 15, 88, 92] } },
    'get_recent_deploys': { status: 'success', data: [{ service: 'PaymentSvc', version: 'v1.2.4', deployed_at: '15m ago', result: 'Success' }] },
    'get_feature_flags': { status: 'success', data: [{ flag: 'enable_v3_caching', value: 'enabled', changed_at: '20m ago' }] },
    'query_traces': { status: 'success', data: [{ span: 'Redis::GET', duration: '420ms', status: 'Slow' }] },
    'get_dependency_health': { status: 'success', data: { 'Redis': 'Critical', 'DB': 'Healthy' } },
    'query_logs': { status: 'success', data: ["LOG_1: Redis server 10.0.0.4:6379 high memory usage", "LOG_2: Timeout waiting for Redis response"] },
    'run_runbook': { status: 'success', data: { name: 'Redis Latency / Cache Saturation', suggested_action: 'Scale Redis cluster or flush non-critical keys' } }
  }
};
