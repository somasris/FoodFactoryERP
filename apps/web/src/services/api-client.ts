import { config } from '../config/env';
import { ApiResponse } from '../types/api';

export class ApiError extends Error {
  public statusCode: number;
  public details?: unknown;

  constructor(message: string, statusCode: number, details?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
  }
}

export async function apiClient<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const url = `${config.apiBaseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };

  const response = await fetch(url, {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  });

  const data: ApiResponse<T> = await response.json().catch(() => ({
    success: false,
    message: 'Failed to parse JSON response',
    timestamp: new Date().toISOString(),
  }));

  if (!response.ok) {
    throw new ApiError(data.message || 'API request failed', response.status, data.error);
  }

  return data;
}
