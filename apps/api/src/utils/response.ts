import { Response } from 'express';

export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: unknown;
  timestamp: string;
}

export const sendSuccess = <T>(
  res: Response,
  message: string,
  data?: T,
  statusCode = 200,
): Response => {
  const responseBody: ApiResponse<T> = {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(responseBody);
};

export const sendError = (
  res: Response,
  message: string,
  error?: unknown,
  statusCode = 500,
): Response => {
  const responseBody: ApiResponse = {
    success: false,
    message,
    error,
    timestamp: new Date().toISOString(),
  };
  return res.status(statusCode).json(responseBody);
};
