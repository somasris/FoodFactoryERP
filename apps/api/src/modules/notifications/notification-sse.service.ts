import { Response } from 'express';
import crypto from 'crypto';
import { logger } from '../../utils/logger';

interface SseClient {
  id: string;
  userId: string;
  res: Response;
  heartbeatTimer: NodeJS.Timeout;
}

const MAX_CONNECTIONS_PER_USER = 5;
const HEARTBEAT_INTERVAL_MS = 25_000;

export class NotificationSseService {
  private static clients = new Map<string, SseClient[]>();

  /**
   * Register an authenticated SSE client for a specific user.
   */
  static addClient(userId: string, res: Response): string {
    const clientId = crypto.randomUUID();

    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    const userClients = this.clients.get(userId) ?? [];

    // Enforce per-user connection cap by closing oldest connection if exceeded
    while (userClients.length >= MAX_CONNECTIONS_PER_USER) {
      const oldest = userClients.shift();
      if (oldest) {
        clearInterval(oldest.heartbeatTimer);
        try {
          oldest.res.end();
        } catch {
          // Ignore already closed stream
        }
      }
    }

    const heartbeatTimer = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        this.removeClient(userId, clientId);
      }
    }, HEARTBEAT_INTERVAL_MS);

    const client: SseClient = { id: clientId, userId, res, heartbeatTimer };
    userClients.push(client);
    this.clients.set(userId, userClients);

    // Advise browser reconnection delay and confirm stream connection
    try {
      res.write('retry: 5000\n');
      res.write(
        `event: connected\ndata: ${JSON.stringify({ clientId, timestamp: new Date().toISOString() })}\n\n`,
      );
    } catch {
      this.removeClient(userId, clientId);
    }

    return clientId;
  }

  /**
   * Remove a disconnected SSE client and clean up its heartbeat timer.
   */
  static removeClient(userId: string, clientId: string): void {
    const userClients = this.clients.get(userId);
    if (!userClients) return;

    const remaining: SseClient[] = [];
    for (const c of userClients) {
      if (c.id === clientId) {
        clearInterval(c.heartbeatTimer);
        try {
          if (!c.res.writableEnded) {
            c.res.end();
          }
        } catch {
          // Ignore
        }
      } else {
        remaining.push(c);
      }
    }

    if (remaining.length === 0) {
      this.clients.delete(userId);
    } else {
      this.clients.set(userId, remaining);
    }
  }

  /**
   * Publish an event strictly to a single authenticated user's active SSE connections.
   * Returns true if at least one connection received the payload.
   */
  static publishToUser(userId: string, event: string, data: unknown): boolean {
    const userClients = this.clients.get(userId);
    if (!userClients || userClients.length === 0) {
      return false;
    }

    const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
    let delivered = false;
    const deadClients: string[] = [];

    for (const client of userClients) {
      try {
        if (!client.res.writableEnded) {
          client.res.write(frame);
          delivered = true;
        } else {
          deadClients.push(client.id);
        }
      } catch (err) {
        logger.debug(`SSE write failed for user ${userId}: ${err instanceof Error ? err.message : String(err)}`);
        deadClients.push(client.id);
      }
    }

    for (const deadId of deadClients) {
      this.removeClient(userId, deadId);
    }

    return delivered;
  }

  /**
   * Returns active connection count for a user (useful for diagnostics and tests).
   */
  static getConnectionCount(userId?: string): number {
    if (userId) {
      return this.clients.get(userId)?.length ?? 0;
    }
    let total = 0;
    for (const list of this.clients.values()) {
      total += list.length;
    }
    return total;
  }

  /**
   * Close all active SSE connections (e.g., during graceful server shutdown).
   */
  static closeAll(): void {
    for (const [userId, list] of this.clients.entries()) {
      for (const c of list) {
        clearInterval(c.heartbeatTimer);
        try {
          if (!c.res.writableEnded) {
            c.res.end();
          }
        } catch {
          // Ignore
        }
      }
      this.clients.delete(userId);
    }
  }
}
