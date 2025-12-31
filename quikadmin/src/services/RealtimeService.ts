import { Response } from 'express';
import { logger } from '../utils/logger';

// Connection limits to prevent DoS
const MAX_TOTAL_CLIENTS = 10000;
const MAX_CLIENTS_PER_USER = 5;

interface SSEClient {
  id: string;
  userId?: string;
  res: Response;
  connectedAt: number;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private clients: Map<string, SSEClient> = new Map();
  private clientsByUser: Map<string, Set<string>> = new Map(); // O(1) user lookups
  private eventCounter = 0;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Register a new SSE client
   * Returns null if connection limits are exceeded
   */
  public registerClient(res: Response, userId?: string): string | null {
    // Check global connection limit
    if (this.clients.size >= MAX_TOTAL_CLIENTS) {
      logger.warn('SSE global connection limit reached', { limit: MAX_TOTAL_CLIENTS });
      return null;
    }

    // Check per-user connection limit
    if (userId) {
      const userClients = this.clientsByUser.get(userId);
      if (userClients && userClients.size >= MAX_CLIENTS_PER_USER) {
        logger.warn('SSE per-user connection limit reached', {
          userId,
          limit: MAX_CLIENTS_PER_USER,
        });
        return null;
      }
    }

    const id = Date.now().toString(36) + Math.random().toString(36).substring(2);

    // Get CORS origin from environment or use restrictive default
    const corsOrigin =
      process.env.CORS_ORIGIN || process.env.FRONTEND_URL || 'http://localhost:8080';

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no', // Disable nginx buffering
      'Access-Control-Allow-Origin': corsOrigin,
      'Access-Control-Allow-Credentials': 'true',
    });

    // Send initial connection event with event ID
    const eventId = ++this.eventCounter;
    try {
      res.write(`id: ${eventId}\n`);
      res.write('retry: 10000\n');
      res.write(`data: ${JSON.stringify({ type: 'connected', id })}\n\n`);
    } catch (error) {
      logger.error('Failed to send initial SSE data', { error, clientId: id });
      return null;
    }

    this.clients.set(id, { id, userId, res, connectedAt: Date.now() });

    // Track by user for O(1) lookups
    if (userId) {
      if (!this.clientsByUser.has(userId)) {
        this.clientsByUser.set(userId, new Set());
      }
      this.clientsByUser.get(userId)!.add(id);
    }

    logger.debug(
      `SSE Client connected: ${id}${userId ? ` (User: ${userId})` : ''}. Total clients: ${this.clients.size}`
    );

    return id;
  }

  /**
   * Remove an SSE client
   */
  public removeClient(id: string): void {
    const client = this.clients.get(id);
    if (client) {
      // Remove from user index
      if (client.userId) {
        const userClients = this.clientsByUser.get(client.userId);
        if (userClients) {
          userClients.delete(id);
          if (userClients.size === 0) {
            this.clientsByUser.delete(client.userId);
          }
        }
      }

      this.clients.delete(id);
      logger.debug(`SSE Client disconnected: ${id}. Total clients: ${this.clients.size}`);
    }
  }

  /**
   * Broadcast an event to all connected clients
   * Use sparingly - prefer sendToUser for user-specific data
   */
  public broadcast(type: string, data: unknown): void {
    const eventId = ++this.eventCounter;
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    const deadClients: string[] = [];

    this.clients.forEach((client) => {
      try {
        client.res.write(`id: ${eventId}\n`);
        client.res.write(`data: ${payload}\n\n`);
      } catch (error) {
        logger.warn('Failed to broadcast to client, marking for removal', { clientId: client.id });
        deadClients.push(client.id);
      }
    });

    // Clean up dead clients
    deadClients.forEach((id) => this.removeClient(id));
  }

  /**
   * Send an event to a specific user (all their connected clients)
   */
  public sendToUser(userId: string, type: string, data: unknown): void {
    const clientIds = this.clientsByUser.get(userId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }

    const eventId = ++this.eventCounter;
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    const deadClients: string[] = [];

    clientIds.forEach((clientId) => {
      const client = this.clients.get(clientId);
      if (client) {
        try {
          client.res.write(`id: ${eventId}\n`);
          client.res.write(`data: ${payload}\n\n`);
        } catch (error) {
          logger.warn('Failed to send to user client, marking for removal', { clientId, userId });
          deadClients.push(clientId);
        }
      }
    });

    // Clean up dead clients
    deadClients.forEach((id) => this.removeClient(id));
  }

  /**
   * Send an event to a specific client ID
   */
  public sendToClient(clientId: string, type: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      const eventId = ++this.eventCounter;
      const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
      try {
        client.res.write(`id: ${eventId}\n`);
        client.res.write(`data: ${payload}\n\n`);
      } catch (error) {
        logger.warn('Failed to send to client, removing', { clientId });
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Start heartbeat to keep connections alive
   */
  public startHeartbeat(intervalMs: number = 30000): void {
    if (this.heartbeatInterval) {
      return;
    }

    this.heartbeatInterval = setInterval(() => {
      const deadClients: string[] = [];

      this.clients.forEach((client) => {
        try {
          client.res.write(': heartbeat\n\n');
        } catch (error) {
          deadClients.push(client.id);
        }
      });

      // Clean up dead clients
      deadClients.forEach((id) => this.removeClient(id));

      if (deadClients.length > 0) {
        logger.debug(`Heartbeat removed ${deadClients.length} dead clients`);
      }
    }, intervalMs);

    // Prevent interval from keeping process alive
    if (this.heartbeatInterval.unref) {
      this.heartbeatInterval.unref();
    }

    logger.info('SSE heartbeat started', { intervalMs });
  }

  /**
   * Stop heartbeat
   */
  public stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
      logger.info('SSE heartbeat stopped');
    }
  }

  /**
   * Graceful shutdown - close all connections
   */
  public shutdown(): void {
    this.stopHeartbeat();

    this.clients.forEach((client) => {
      try {
        client.res.write(`data: ${JSON.stringify({ type: 'shutdown' })}\n\n`);
        client.res.end();
      } catch {
        // Ignore errors during shutdown
      }
    });

    this.clients.clear();
    this.clientsByUser.clear();
    logger.info('SSE service shut down, all clients disconnected');
  }

  /**
   * Get service statistics
   */
  public getStats(): {
    totalClients: number;
    uniqueUsers: number;
    oldestConnection: number | null;
  } {
    let oldestConnection: number | null = null;

    this.clients.forEach((client) => {
      if (oldestConnection === null || client.connectedAt < oldestConnection) {
        oldestConnection = client.connectedAt;
      }
    });

    return {
      totalClients: this.clients.size,
      uniqueUsers: this.clientsByUser.size,
      oldestConnection,
    };
  }
}

export const realtimeService = RealtimeService.getInstance();
