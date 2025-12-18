import { QueueService } from '../queue/QueueService';
import { IntelliFillService } from '../services/IntelliFillService';
import { DatabaseService } from '../database/DatabaseService';
import { piiSafeLogger as logger } from '../utils/piiSafeLogger';
import * as dotenv from 'dotenv';

dotenv.config();

class QueueProcessor {
  private queueService: QueueService | null = null;
  private isRunning: boolean = false;

  async initialize(): Promise<boolean> {
    try {
      // Verify Redis connection before initializing queues
      const redisAvailable = await QueueService.initialize();

      if (!redisAvailable) {
        logger.error('Redis is not available. Queue processor cannot start.');
        logger.error('Please ensure Redis is running and REDIS_URL is correctly configured.');
        return false;
      }

      // Initialize services with required dependencies (lazy loaded to avoid circular deps)
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { DocumentParser } = require('../parsers/DocumentParser');
      const { DataExtractor } = require('../extractors/DataExtractor');
      const { FieldMapper } = require('../mappers/FieldMapper');
      const { FormFiller } = require('../fillers/FormFiller');
      const { ValidationService } = require('../validators/ValidationService');
      /* eslint-enable @typescript-eslint/no-require-imports */

      const intelliFillService = new IntelliFillService({
        documentParser: new DocumentParser(),
        dataExtractor: new DataExtractor(),
        fieldMapper: new FieldMapper(),
        formFiller: new FormFiller(),
        validationService: new ValidationService()
      });

      const databaseUrl = process.env.DATABASE_URL || 'postgresql://pdffiller:pdffiller123@localhost:5432/pdffiller';
      const databaseService = new DatabaseService(databaseUrl);
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.queueService = new QueueService(
        intelliFillService,
        databaseService,
        redisUrl
      );

      logger.info('Queue processor initialized successfully');
      return true;
    } catch (error) {
      logger.error('Failed to initialize queue processor:', error);
      return false;
    }
  }

  async start() {
    logger.info('Queue processor starting...');
    logger.info('Redis URL:', process.env.REDIS_URL);

    // Initialize and verify Redis connectivity
    const initialized = await this.initialize();

    if (!initialized) {
      logger.error('Queue processor initialization failed. Exiting...');
      process.exit(1);
    }

    if (!this.queueService) {
      logger.error('Queue service is null after initialization. Exiting...');
      process.exit(1);
    }

    // Verify queue service is available
    const status = QueueService.getStatus();
    if (!status.available) {
      logger.error('Queue service is not available:', status.message);
      process.exit(1);
    }

    logger.info('Queue service status:', status.message);
    this.isRunning = true;

    try {
      logger.info('Queue service initialized and connected to Redis');

      // Monitor queue metrics periodically
      while (this.isRunning) {
        try {
          const metrics = await this.queueService.getQueueMetrics();
          console.log('Queue metrics:', metrics);
          
          // Wait before checking again
          await this.sleep(10000); // Check every 10 seconds
        } catch (error) {
          console.error('Error getting queue metrics:', error);
          await this.sleep(5000); // Wait longer on error
        }
      }
    } catch (error) {
      console.error('Fatal error in queue processor:', error);
      process.exit(1);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async stop() {
    logger.info('Stopping queue processor...');
    this.isRunning = false;

    if (this.queueService) {
      await this.queueService.close();
      logger.info('Queue processor stopped');
    } else {
      logger.info('Queue processor stopped (no active queue service)');
    }
  }
}

// Handle graceful shutdown
const processor = new QueueProcessor();

process.on('SIGINT', async () => {
  console.log('Received SIGINT, shutting down gracefully...');
  await processor.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  await processor.stop();
  process.exit(0);
});

// Start the processor
processor.start().catch(error => {
  console.error('Failed to start queue processor:', error);
  process.exit(1);
});