/**
 * Error thrown when a queue is unavailable (e.g., Redis is down)
 */
export class QueueUnavailableError extends Error {
  constructor(queueName: string) {
    super(`Queue '${queueName}' is currently unavailable. Redis may be down.`);
    this.name = 'QueueUnavailableError';
  }
}
