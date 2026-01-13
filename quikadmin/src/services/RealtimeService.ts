/**
 * RealtimeService - Server-Sent Events using better-sse
 *
 * Provides real-time updates to connected clients via SSE.
 * Uses better-sse for robust session/channel management.
 *
 * Architecture:
 * - Each user gets their own Channel for targeted messaging
 * - Sessions track individual client connections with state
 * - Automatic heartbeat and reconnection handling via better-sse
 */

import { Request, Response } from 'express';
import { createSession, createChannel, Session, Channel } from 'better-sse';
import { logger } from '../utils/logger';

// Connection limits to prevent DoS
const MAX_TOTAL_CLIENTS = 10000;
const MAX_CLIENTS_PER_USER = 5;

/** Session state for tracking user info */
interface SessionState {
  userId: string;
  connectedAt: number;
}

/** Channel state for user channels */
interface UserChannelState {
  userId: string;
  createdAt: number;
}

export class RealtimeService {
  private static instance: RealtimeService;

  /** All active sessions indexed by session ID */
  private sessions: Map<string, Session<SessionState>> = new Map();

  /** Per-user channels for targeted messaging */
  private userChannels: Map<string, Channel<UserChannelState, SessionState>> = new Map();

  /** Track session count per user for connection limits */
  private sessionCountByUser: Map<string, number> = new Map();

  /** Global event counter for SSE event IDs */
  private eventCounter = 0;

  /** Total session count */
  private totalSessions = 0;

  private constructor() {}

  public static getInstance(): RealtimeService {
    if (!RealtimeService.instance) {
      RealtimeService.instance = new RealtimeService();
    }
    return RealtimeService.instance;
  }

  /**
   * Get or create a channel for a specific user
   */
  private getOrCreateUserChannel(userId: string): Channel<UserChannelState, SessionState> {
    if (!this.userChannels.has(userId)) {
      const channel = createChannel<UserChannelState, SessionState>();
      channel.state = {
        userId,
        createdAt: Date.now(),
      };

      // Clean up channel when last session disconnects
      channel.on('session-disconnected', () => {
        if (channel.sessionCount === 0) {
          this.userChannels.delete(userId);
          logger.debug(`User channel removed: ${userId}`);
        }
      });

      this.userChannels.set(userId, channel);
      logger.debug(`User channel created: ${userId}`);
    }
    return this.userChannels.get(userId)!;
  }

  /**
   * Register a new SSE client connection
   * Returns session ID if successful, null if limits exceeded
   */
  public async registerClient(req: Request, res: Response, userId: string): Promise<string | null> {
    // Check global connection limit
    if (this.totalSessions >= MAX_TOTAL_CLIENTS) {
      logger.warn('SSE global connection limit reached', { limit: MAX_TOTAL_CLIENTS });
      return null;
    }

    // Check per-user connection limit
    const userSessionCount = this.sessionCountByUser.get(userId) || 0;
    if (userSessionCount >= MAX_CLIENTS_PER_USER) {
      logger.warn('SSE per-user connection limit reached', {
        userId,
        limit: MAX_CLIENTS_PER_USER,
      });
      return null;
    }

    try {
      // Create session with better-sse
      const session = await createSession<SessionState>(req, res, {
        headers: {
          'X-Accel-Buffering': 'no', // Disable nginx buffering
        },
      });

      // Generate session ID
      const sessionId = Date.now().toString(36) + Math.random().toString(36).substring(2);

      // Set session state
      session.state = {
        userId,
        connectedAt: Date.now(),
      };

      // Register to user's channel
      const userChannel = this.getOrCreateUserChannel(userId);
      userChannel.register(session);

      // Track session
      this.sessions.set(sessionId, session);
      this.totalSessions++;
      this.sessionCountByUser.set(userId, userSessionCount + 1);

      // Send initial connection event
      session.push({ type: 'connected', sessionId }, 'connected');

      logger.debug(
        `SSE Client connected: ${sessionId} (User: ${userId}). Total: ${this.totalSessions}`
      );

      // Handle disconnect
      res.on('close', () => {
        this.removeSession(sessionId, userId);
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create SSE session', { error, userId });
      return null;
    }
  }

  /**
   * Remove a session and clean up
   */
  private removeSession(sessionId: string, userId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      this.sessions.delete(sessionId);
      this.totalSessions--;

      const userCount = (this.sessionCountByUser.get(userId) || 1) - 1;
      if (userCount <= 0) {
        this.sessionCountByUser.delete(userId);
      } else {
        this.sessionCountByUser.set(userId, userCount);
      }

      logger.debug(
        `SSE Client disconnected: ${sessionId} (User: ${userId}). Total: ${this.totalSessions}`
      );
    }
  }

  /**
   * Send an event to a specific user (all their connected clients)
   * Maintains backward compatibility with existing queue code
   */
  public sendToUser(userId: string, type: string, data: unknown): void {
    const channel = this.userChannels.get(userId);
    if (!channel || channel.sessionCount === 0) {
      return;
    }

    const eventId = String(++this.eventCounter);
    const payload = { type, data, timestamp: new Date().toISOString() };

    try {
      channel.broadcast(payload, type, { eventId });
    } catch (error) {
      logger.warn('Failed to send to user channel', { userId, error });
    }
  }

  /**
   * Broadcast an event to all connected clients
   * Use sparingly - prefer sendToUser for user-specific data
   */
  public broadcast(type: string, data: unknown): void {
    const eventId = String(++this.eventCounter);
    const payload = { type, data, timestamp: new Date().toISOString() };

    this.userChannels.forEach((channel, userId) => {
      try {
        channel.broadcast(payload, type, { eventId });
      } catch (error) {
        logger.warn('Failed to broadcast to channel', { userId, error });
      }
    });
  }

  /**
   * Send an event to a specific session
   */
  public sendToSession(sessionId: string, type: string, data: unknown): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const eventId = String(++this.eventCounter);
      const payload = { type, data, timestamp: new Date().toISOString() };

      try {
        session.push(payload, type, eventId);
      } catch (error) {
        logger.warn('Failed to send to session', { sessionId, error });
      }
    }
  }

  /**
   * Start heartbeat - better-sse handles keep-alive automatically
   * This method is kept for backward compatibility but is now a no-op
   */
  public startHeartbeat(_intervalMs: number = 30000): void {
    // better-sse handles keep-alive automatically via its internal ping mechanism
    logger.info('SSE service started (better-sse handles heartbeat automatically)');
  }

  /**
   * Stop heartbeat - no-op for better-sse
   */
  public stopHeartbeat(): void {
    // No-op for better-sse
    logger.info('SSE service heartbeat stopped');
  }

  /**
   * Graceful shutdown - close all connections
   */
  public shutdown(): void {
    // Notify all clients of shutdown
    this.userChannels.forEach((channel) => {
      try {
        channel.broadcast({ type: 'shutdown' }, 'shutdown');
      } catch {
        // Ignore errors during shutdown
      }
    });

    // Clear all tracking
    this.sessions.clear();
    this.userChannels.clear();
    this.sessionCountByUser.clear();
    this.totalSessions = 0;

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

    this.sessions.forEach((session) => {
      const connectedAt = session.state?.connectedAt;
      if (connectedAt && (oldestConnection === null || connectedAt < oldestConnection)) {
        oldestConnection = connectedAt;
      }
    });

    return {
      totalClients: this.totalSessions,
      uniqueUsers: this.userChannels.size,
      oldestConnection,
    };
  }

  // ========== Backward Compatibility Methods ==========

  /**
   * @deprecated Use registerClient instead
   * Kept for backward compatibility with old route code
   */
  public registerClientLegacy(res: Response, userId?: string): string | null {
    logger.warn('Using deprecated registerClientLegacy - migrate to registerClient');
    // Return null to indicate this method shouldn't be used
    return null;
  }

  /**
   * @deprecated No longer needed - handled automatically
   */
  public removeClient(_id: string): void {
    // No-op - sessions are cleaned up automatically via res.on('close')
  }
}

export const realtimeService = RealtimeService.getInstance();
