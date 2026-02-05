
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
      "14:02:01 INFO [API] Request processed in 45ms",
      "14:02:05 ERROR [API] Upstream 'PaymentSvc' timed out after 2000ms",
      "14:02:05 WARN [API] Retrying PaymentSvc call (attempt 1/3)",
      "14:02:07 ERROR [API] 502 Bad Gateway: PaymentSvc unreachable",
      "14:02:08 ERROR [API] Stacktrace: java.net.ConnectException: Connection refused"
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
      "13:58:10 INFO [PaymentSvc] Executing transaction TX-992",
      "13:58:12 WARN [PaymentSvc] Redis command GET 'session_992' took 420ms",
      "13:58:15 ERROR [PaymentSvc] Cache access degraded; falling back to DB",
      "13:58:20 INFO [PaymentSvc] Thread pool 'Worker-1' saturated; queue length > 1000",
      "13:58:22 WARN [PaymentSvc] High latency detected on Redis cluster node 04"
    ]
  },
  {
    id: 'ALRT-003',
    title: 'DB CPU > 85%',
    service: 'DB',
    severity: AlertSeverity.WARNING,
    region: 'us-east-1',
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    telemetry: {
      cpuUsage: 89,
      dbConnections: 120,
      redisLatency: 8,
      threadPoolUsage: 10,
      recentDeploy: 'N/A',
      errorRate: 0.2,
      memoryUsage: 92
    },
    logs: [
      "13:45:00 INFO [DB] Vacuuming system catalogs",
      "13:46:12 WARN [DB] Slow query detected (12.4s): SELECT * FROM large_audit_trail...",
      "13:47:05 ERROR [DB] Out of memory condition imminent in shared_buffers",
      "13:48:00 INFO [DB] Checkpoint starting: forced by time"
    ]
  },
  {
    id: 'ALRT-004',
    title: 'Cache miss rate spiking',
    service: 'Cache',
    severity: AlertSeverity.WARNING,
    region: 'eu-central-1',
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    telemetry: {
      cpuUsage: 12,
      dbConnections: 5,
      redisLatency: 22,
      threadPoolUsage: 5,
      recentDeploy: 'N/A',
      errorRate: 0.1,
      memoryUsage: 98
    },
    logs: [
      "13:52:00 INFO [Cache] Maxmemory limit hit (2GB)",
      "13:52:05 WARN [Cache] Evicting keys using allkeys-lru policy",
      "13:53:10 INFO [Cache] Miss rate increased to 42% (Normal: 4%)",
      "13:54:01 WARN [Cache] Hot key 'global_config_v2' detected"
    ]
  },
  {
    id: 'ALRT-005',
    title: 'Auth timeouts increasing',
    service: 'Auth',
    severity: AlertSeverity.CRITICAL,
    region: 'us-east-1',
    timestamp: new Date(Date.now() - 3 * 60000).toISOString(),
    telemetry: {
      cpuUsage: 18,
      dbConnections: 15,
      redisLatency: 5,
      threadPoolUsage: 85,
      recentDeploy: 'Auth v3.0.1 (2 days ago)',
      errorRate: 3.4,
      memoryUsage: 42
    },
    logs: [
      "14:00:05 ERROR [Auth] LDAP sync failed: Connection timeout",
      "14:01:12 INFO [Auth] Authenticating user 'admin' via backup DB",
      "14:01:45 WARN [Auth] Internal session pool nearly full",
      "14:02:10 ERROR [Auth] JWT validation failure for kid 'rsa-1'"
    ]
  }
];
