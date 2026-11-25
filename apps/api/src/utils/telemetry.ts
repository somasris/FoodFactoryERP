import { redactSensitiveData } from '../modules/governance/governance.service';

export interface RequestMetric {
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  timestamp: string;
}

export interface ErrorRecord {
  requestId: string;
  category: 'VALIDATION' | 'AUTH' | 'BUSINESS' | 'SYSTEM';
  message: string;
  route: string;
  method: string;
  statusCode: number;
  environment: string;
  stack?: string;
  timestamp: string;
}

const MAX_METRICS = 500;
const MAX_ERRORS = 200;

const metricsBuffer: RequestMetric[] = [];
const errorsBuffer: ErrorRecord[] = [];

export const TelemetryStore = {
  recordRequest(metric: RequestMetric) {
    metricsBuffer.push(metric);
    if (metricsBuffer.length > MAX_METRICS) {
      metricsBuffer.shift();
    }
  },

  recordError(err: ErrorRecord) {
    const safeMsg = String(
      redactSensitiveData({ message: err.message }) && err.message,
    ).replace(/postgres(ql)?:\/\/[^\s]+/gi, '[REDACTED_DB_URL]');

    errorsBuffer.push({
      ...err,
      message: safeMsg,
    });
    if (errorsBuffer.length > MAX_ERRORS) {
      errorsBuffer.shift();
    }
  },

  getPerformanceSummary(slowThresholdMs = 500) {
    const total = metricsBuffer.length;
    if (total === 0) {
      return {
        totalRequestsSampled: 0,
        avgDurationMs: 0,
        p95DurationMs: 0,
        errorRatePercent: 0,
        slowThresholdMs,
        slowRequestsCount: 0,
        slowEndpoints: [],
      };
    }

    const durations = metricsBuffer.map(m => m.durationMs).sort((a, b) => a - b);
    const avgDurationMs = Math.round(
      durations.reduce((sum, d) => sum + d, 0) / total,
    );
    const p95Index = Math.min(total - 1, Math.floor(total * 0.95));
    const p95DurationMs = durations[p95Index];

    const errorCount = metricsBuffer.filter(m => m.statusCode >= 500).length;
    const errorRatePercent = Number(((errorCount / total) * 100).toFixed(2));
    const slow = metricsBuffer.filter(m => m.durationMs >= slowThresholdMs);

    return {
      totalRequestsSampled: total,
      avgDurationMs,
      p95DurationMs,
      errorRatePercent,
      slowThresholdMs,
      slowRequestsCount: slow.length,
      slowEndpoints: slow.slice(-20).reverse(),
    };
  },

  getRecentErrors(includeStack: boolean) {
    return errorsBuffer
      .slice(-50)
      .reverse()
      .map(e => ({
        requestId: e.requestId,
        category: e.category,
        message: e.message,
        route: e.route,
        method: e.method,
        statusCode: e.statusCode,
        environment: e.environment,
        timestamp: e.timestamp,
        ...(includeStack && e.stack ? { stack: e.stack } : {}),
      }));
  },
};
