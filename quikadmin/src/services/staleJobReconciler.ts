import { prisma } from '../utils/prisma';
import { logger } from '../utils/logger';

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const RECONCILE_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Periodically resets documents stuck in PROCESSING status for longer than
 * STALE_THRESHOLD_MS to FAILED. This handles cases where a worker crashes
 * and the database status is never reconciled.
 */
export function startStaleJobReconciliation(): NodeJS.Timeout {
  logger.info('Stale job reconciliation started', {
    intervalMs: RECONCILE_INTERVAL_MS,
    thresholdMs: STALE_THRESHOLD_MS,
  });

  return setInterval(async () => {
    try {
      const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS);

      const staleDocuments = await prisma.document.updateMany({
        where: {
          status: 'PROCESSING',
          updatedAt: { lt: cutoff },
        },
        data: {
          status: 'FAILED',
        },
      });

      if (staleDocuments.count > 0) {
        logger.warn(`Reconciled ${staleDocuments.count} stale PROCESSING documents to FAILED`, {
          cutoff: cutoff.toISOString(),
        });
      }
    } catch (error) {
      logger.error('Stale job reconciliation failed', { error });
    }
  }, RECONCILE_INTERVAL_MS);
}
