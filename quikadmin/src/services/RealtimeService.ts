import { Response } from 'express';
import { logger } from '../utils/logger';

interface SSEClient {
  id: string;
  userId?: string;
  res: Response;
}

export class RealtimeService {
  private static instance: RealtimeService;
  private clients: Map<string, SSEClient> = new Map();

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Register a new SSE client
   */
  public registerClient(res: Response, userId?: string): string {
    const id = Date.now().toString(36) + Math.random().toString(36).substr(2);

    // Set headers for SSE
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*', // Adjust according to your CORS policy
    });

    // Send initial keep-alive
    res.write('retry: 10000\n\n');
    res.write(`data: ${JSON.stringify({ type: 'connected', id })}\n\n`);

    this.clients.set(id, { id, userId, res });

    logger.debug(
      `SSE Client connected: ${id}${userId ? ` (User: ${userId})` : ''}. Total clients: ${this.clients.size}`
    );

    return id;
  }

  /**
   * Remove an SSE client
   */
  public removeClient(id: string): void {
    if (this.clients.has(id)) {
      this.clients.delete(id);
      logger.debug(`SSE Client disconnected: ${id}. Total clients: ${this.clients.size}`);
    }
  }

  /**
   * Broadcast an event to all connected clients
   */
  public broadcast(type: string, data: unknown): void {
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    this.clients.forEach((client) => {
      client.res.write(`data: ${payload}\n\n`);
    });
  }

  /**
   * Send an event to a specific user
   */
  public sendToUser(userId: string, type: string, data: unknown): void {
    const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    this.clients.forEach((client) => {
      if (client.userId === userId) {
        client.res.write(`data: ${payload}\n\n`);
      }
    });
  }

  /**
   * Send an event to a specific client ID
   */
  public sendToClient(clientId: string, type: string, data: unknown): void {
    const client = this.clients.get(clientId);
    if (client) {
      const payload = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
      client.res.write(`data: ${payload}\n\n`);
    }
  }
}

export const realtimeService = RealtimeService.getInstance();
