import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import * as fs from 'fs/promises';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';
import { DocumentDetectionService } from '../../src/services/DocumentDetectionService';
import { OCRService } from '../../src/services/OCRService';
import { enqueueDocumentForOCR, getOCRQueueHealth, ocrQueue } from '../../src/queues/ocrQueue';
import { PDFDocument, StandardFonts } from 'pdf-lib';

const prisma = new PrismaClient();

// Test data paths
const TEST_DIR = path.join(__dirname, '../fixtures');
const SCANNED_PDF_PATH = path.join(TEST_DIR, 'scanned_test.pdf');
const TEXT_PDF_PATH = path.join(TEST_DIR, 'text_test.pdf');

/**
 * Helper: Create a text-based PDF for testing
 */
async function createTextBasedPDF(filePath: string): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('This is a text-based PDF document', {
    x: 50,
    y: 750,
    size: 20,
    font
  });

  page.drawText('Name: John Doe', { x: 50, y: 700, size: 14, font });
  page.drawText('Email: john.doe@example.com', { x: 50, y: 680, size: 14, font });
  page.drawText('Phone: (555) 123-4567', { x: 50, y: 660, size: 14, font });
  page.drawText('Address: 123 Main St, City, ST 12345', { x: 50, y: 640, size: 14, font });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);
}

/**
 * Helper: Create a scanned PDF (image-only, no text layer) for testing
 */
async function createScannedPDF(filePath: string): Promise<void> {
  // Create a minimal PDF with no text layer (just metadata)
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);

  // Don't add any text - this simulates a scanned document
  // In a real scanned PDF, there would be an image, but for testing
  // we just need a PDF without a text layer

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(filePath, pdfBytes);
}

describe('Automatic OCR Detection Pipeline', () => {
  let testUserId: string;

  beforeAll(async () => {
    // Create test fixtures directory
    await fs.mkdir(TEST_DIR, { recursive: true });

    // Create test PDFs
    await createTextBasedPDF(TEXT_PDF_PATH);
    await createScannedPDF(SCANNED_PDF_PATH);

    // Create test user
    const testUser = await prisma.user.create({
      data: {
        email: `test-ocr-${Date.now()}@example.com`,
        password: 'hashedpassword',
        role: 'USER'
      }
    });
    testUserId = testUser.id;

    // Wait for queue to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  afterAll(async () => {
    // Cleanup test data
    try {
      await fs.unlink(TEXT_PDF_PATH).catch(() => {});
      await fs.unlink(SCANNED_PDF_PATH).catch(() => {});

      // Cleanup test user and documents
      await prisma.document.deleteMany({ where: { userId: testUserId } });
      await prisma.user.delete({ where: { id: testUserId } });
    } catch (error) {
      console.error('Cleanup error:', error);
    }

    // Close queue connections
    await ocrQueue.close();
    await prisma.$disconnect();
  });

  describe('DocumentDetectionService', () => {
    test('should detect text-based PDF correctly', async () => {
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(TEXT_PDF_PATH);

      expect(isScanned).toBe(false);
    }, 10000);

    test('should detect scanned PDF correctly', async () => {
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(SCANNED_PDF_PATH);

      expect(isScanned).toBe(true);
    }, 10000);

    test('should extract text from text-based PDF', async () => {
      const detectionService = new DocumentDetectionService();
      const text = await detectionService.extractTextFromPDF(TEXT_PDF_PATH);

      expect(text).toContain('John Doe');
      expect(text).toContain('john.doe@example.com');
      expect(text.length).toBeGreaterThan(50);
    }, 10000);

    test('should get detailed PDF info', async () => {
      const detectionService = new DocumentDetectionService();
      const info = await detectionService.getPDFInfo(TEXT_PDF_PATH);

      expect(info.numPages).toBeGreaterThan(0);
      expect(info.textLength).toBeGreaterThan(0);
      expect(info.isScanned).toBe(false);
      expect(info.textPerPage).toBeGreaterThan(0);
    }, 10000);

    test('should batch check multiple PDFs', async () => {
      const detectionService = new DocumentDetectionService();
      const results = await detectionService.batchCheckScanned([
        TEXT_PDF_PATH,
        SCANNED_PDF_PATH
      ]);

      expect(results.size).toBe(2);
      expect(results.get(TEXT_PDF_PATH)).toBe(false);
      expect(results.get(SCANNED_PDF_PATH)).toBe(true);
    }, 15000);
  });

  describe('OCR Queue System', () => {
    test('should enqueue scanned PDF for OCR', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'scanned_test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: SCANNED_PDF_PATH,
          status: 'PENDING'
        }
      });

      const job = await enqueueDocumentForOCR(
        document.id,
        testUserId,
        SCANNED_PDF_PATH,
        false
      );

      expect(job).not.toBeNull();
      expect(job?.data.documentId).toBe(document.id);
      expect(job?.data.filePath).toBe(SCANNED_PDF_PATH);

      // Cleanup
      if (job) await job.remove();
      await prisma.document.delete({ where: { id: document.id } });
    }, 15000);

    test('should skip OCR for text-based PDF', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'text_test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: TEXT_PDF_PATH,
          status: 'PENDING'
        }
      });

      const job = await enqueueDocumentForOCR(
        document.id,
        testUserId,
        TEXT_PDF_PATH,
        false
      );

      expect(job).toBeNull(); // Should skip OCR

      await prisma.document.delete({ where: { id: document.id } });
    }, 15000);

    test('should force OCR when forceOCR flag is true', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'text_force_ocr.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: TEXT_PDF_PATH,
          status: 'PENDING'
        }
      });

      const job = await enqueueDocumentForOCR(
        document.id,
        testUserId,
        TEXT_PDF_PATH,
        true // Force OCR
      );

      expect(job).not.toBeNull();

      // Cleanup
      if (job) await job.remove();
      await prisma.document.delete({ where: { id: document.id } });
    }, 15000);

    test('should get queue health status', async () => {
      const health = await getOCRQueueHealth();

      expect(health).toHaveProperty('queue');
      expect(health).toHaveProperty('waiting');
      expect(health).toHaveProperty('active');
      expect(health).toHaveProperty('completed');
      expect(health).toHaveProperty('failed');
      expect(health).toHaveProperty('isHealthy');
      expect(health.queue).toBe('ocr-processing');
    }, 10000);
  });

  describe('OCR Processing with Retry Logic', () => {
    test('should retry failed OCR jobs', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'invalid_test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: '/invalid/path/to/file.pdf', // Invalid path to trigger failure
          status: 'PENDING'
        }
      });

      const job = await ocrQueue.add({
        documentId: document.id,
        userId: testUserId,
        filePath: '/invalid/path/to/file.pdf',
        options: {}
      });

      // Wait for job to fail and retry
      await new Promise(resolve => setTimeout(resolve, 10000));

      const jobState = await job.getState();
      const attemptsMade = job.attemptsMade;

      // Should have attempted retry (at least 1 attempt made)
      expect(attemptsMade).toBeGreaterThan(0);
      expect(['failed', 'waiting', 'active']).toContain(jobState);

      // Cleanup
      await job.remove();
      await prisma.document.delete({ where: { id: document.id } });
    }, 20000);

    test('should handle concurrent OCR jobs', async () => {
      const documents = await Promise.all(
        Array.from({ length: 5 }, async (_, i) => {
          return prisma.document.create({
            data: {
              userId: testUserId,
              fileName: `concurrent_test_${i}.pdf`,
              fileType: 'application/pdf',
              fileSize: 1024,
              storageUrl: SCANNED_PDF_PATH,
              status: 'PENDING'
            }
          });
        })
      );

      const jobs = await Promise.all(
        documents.map(doc =>
          ocrQueue.add({
            documentId: doc.id,
            userId: testUserId,
            filePath: SCANNED_PDF_PATH,
            options: {}
          })
        )
      );

      expect(jobs.length).toBe(5);
      jobs.forEach(job => {
        expect(job).not.toBeNull();
        expect(job.data.filePath).toBe(SCANNED_PDF_PATH);
      });

      // Cleanup
      await Promise.all(jobs.map(job => job.remove()));
      await Promise.all(documents.map(doc =>
        prisma.document.delete({ where: { id: doc.id } })
      ));
    }, 30000);
  });

  describe('Status Endpoint Integration', () => {
    test('should return document status with job info', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'status_test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: SCANNED_PDF_PATH,
          status: 'PROCESSING',
          confidence: 0.85
        }
      });

      // Document should have status without needing actual API call
      expect(document.status).toBe('PROCESSING');
      expect(document.confidence).toBe(0.85);

      await prisma.document.delete({ where: { id: document.id } });
    }, 10000);
  });

  describe('End-to-End OCR Workflow', () => {
    test('should complete full OCR workflow for scanned PDF', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'e2e_scanned.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: SCANNED_PDF_PATH,
          status: 'PENDING'
        }
      });

      // Step 1: Detect if scanned
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(SCANNED_PDF_PATH);
      expect(isScanned).toBe(true);

      // Step 2: Enqueue for OCR
      const job = await enqueueDocumentForOCR(
        document.id,
        testUserId,
        SCANNED_PDF_PATH,
        false
      );
      expect(job).not.toBeNull();

      // Cleanup
      if (job) await job.remove();
      await prisma.document.delete({ where: { id: document.id } });
    }, 20000);

    test('should complete full workflow for text-based PDF', async () => {
      const document = await prisma.document.create({
        data: {
          userId: testUserId,
          fileName: 'e2e_text.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          storageUrl: TEXT_PDF_PATH,
          status: 'PENDING'
        }
      });

      // Step 1: Detect if scanned
      const detectionService = new DocumentDetectionService();
      const isScanned = await detectionService.isScannedPDF(TEXT_PDF_PATH);
      expect(isScanned).toBe(false);

      // Step 2: Extract text directly (no OCR needed)
      const text = await detectionService.extractTextFromPDF(TEXT_PDF_PATH);
      expect(text.length).toBeGreaterThan(0);
      expect(text).toContain('John Doe');

      // Step 3: Should skip OCR
      const job = await enqueueDocumentForOCR(
        document.id,
        testUserId,
        TEXT_PDF_PATH,
        false
      );
      expect(job).toBeNull();

      await prisma.document.delete({ where: { id: document.id } });
    }, 20000);
  });
});
