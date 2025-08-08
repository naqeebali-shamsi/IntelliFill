import { QueueService } from '../queue/QueueService';
import { PDFFillerService } from '../services/PDFFillerService';
import { DatabaseService } from '../database/DatabaseService';
import * as dotenv from 'dotenv';

dotenv.config();

class QueueProcessor {
  private queueService: QueueService;
  private isRunning: boolean = false;

  constructor() {
    // Initialize services with required dependencies
    const { DocumentParser } = require('../parsers/DocumentParser');
    const { DataExtractor } = require('../extractors/DataExtractor');
    const { FieldMapper } = require('../mappers/FieldMapper');
    const { FormFiller } = require('../fillers/FormFiller');
    const { ValidationService } = require('../validators/ValidationService');
    
    const pdfFillerService = new PDFFillerService({
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
      pdfFillerService,
      databaseService,
      redisUrl
    );
  }

  async start() {
    console.log('Queue processor starting...');
    console.log('Redis URL:', process.env.REDIS_URL);
    this.isRunning = true;

    try {
      // The QueueService automatically connects and sets up processors
      console.log('Queue service initialized and connected to Redis');

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
    console.log('Stopping queue processor...');
    this.isRunning = false;
    await this.queueService.close();
    console.log('Queue processor stopped');
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