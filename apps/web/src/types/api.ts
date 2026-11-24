export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
  timestamp: string;
}

export interface ApiHealthData {
  application: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  environment: string;
  uptimeSeconds: number;
  timestamp: string;
}

export interface DatabaseHealthData {
  application: string;
  database: string;
  status: 'connected' | 'disconnected';
  latencyMs: number;
  timestamp: string;
}
