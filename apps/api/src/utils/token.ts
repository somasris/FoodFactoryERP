import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface TokenPayload {
  userId: string;
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
  sessionId?: string;
}

export const TOKEN_ISSUER = 'foodfactory-erp';
export const TOKEN_AUDIENCE = 'foodfactory-app';

/**
 * Generate a short-lived signed JWT access token.
 */
export function generateAccessToken(payload: TokenPayload): string {
  const options: SignOptions = {
    expiresIn: (env.JWT_ACCESS_EXPIRY || '15m') as SignOptions['expiresIn'],
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

/**
 * Verify and decode a JWT access token.
 */
export function verifyAccessToken(token: string): TokenPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: TOKEN_ISSUER,
    audience: TOKEN_AUDIENCE,
  });
  return decoded as TokenPayload;
}

/**
 * Generate a cryptographically secure random refresh token string.
 */
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString('base64url');
}

/**
 * Securely hash a raw refresh token using HMAC-SHA-256 with pepper.
 * Raw refresh tokens are never persisted in the database.
 */
export function hashRefreshToken(rawToken: string): string {
  return crypto.createHmac('sha256', env.JWT_REFRESH_SECRET).update(rawToken).digest('hex');
}
