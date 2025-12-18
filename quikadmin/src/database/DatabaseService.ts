import { Pool, QueryResult } from 'pg';
import { logger } from '../utils/logger';

export interface JobRecord {
  id: string;
  type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  userId?: string;
  documentsCount: number;
  startedAt?: Date;
  completedAt?: Date;
  failedAt?: Date;
  result?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ProcessingHistory {
  id: string;
  jobId: string;
  formPath: string;
  documentPaths: string[];
  outputPath: string;
  filledFields: string[];
  confidence: number;
  processingTime: number;
  createdAt: Date;
}

export interface UserSettings {
  userId: string;
  defaultValidationRules?: any[];
  preferredLanguage?: string;
  emailNotifications?: boolean;
  webhookUrl?: string;
  apiKey?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class DatabaseService {
  private pool: Pool;
  private connectionString: string;

  constructor(connectionString?: string) {
    // Validate DATABASE_URL is configured (fail-fast pattern)
    this.connectionString = connectionString || process.env.DATABASE_URL;

    if (!this.connectionString) {
      throw new Error(
        'DATABASE_URL environment variable is required. ' +
          'Please set it in your .env file. ' +
          'Example: DATABASE_URL=postgresql://user:password@host:port/database'
      );
    }

    this.pool = new Pool({
      connectionString: this.connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000, // Increased to 15s for Neon cold-start
    });

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error:', err);
    });
  }

  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      logger.info('Database connected successfully');
    } catch (error) {
      logger.error('Failed to connect to database:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    logger.info('Database disconnected');
  }

  async query(text: string, params?: any[]): Promise<QueryResult> {
    try {
      const result = await this.pool.query(text, params);
      return result;
    } catch (error) {
      logger.error('Database query error:', error);
      throw error;
    }
  }

  async initialize(): Promise<void> {
    try {
      await this.createTables();
      logger.info('Database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize database:', error);
      throw error;
    }
  }

  private async createTables(): Promise<void> {
    const queries = [
      // Jobs table
      `CREATE TABLE IF NOT EXISTS jobs (
        id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(50) NOT NULL,
        status VARCHAR(50) NOT NULL,
        user_id VARCHAR(255),
        documents_count INTEGER NOT NULL,
        started_at TIMESTAMP,
        completed_at TIMESTAMP,
        failed_at TIMESTAMP,
        result JSONB,
        error TEXT,
        metadata JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Processing history table
      `CREATE TABLE IF NOT EXISTS processing_history (
        id SERIAL PRIMARY KEY,
        job_id VARCHAR(255) REFERENCES jobs(id),
        form_path TEXT NOT NULL,
        document_paths TEXT[] NOT NULL,
        output_path TEXT NOT NULL,
        filled_fields TEXT[],
        confidence DECIMAL(3,2),
        processing_time INTEGER,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // User settings table
      `CREATE TABLE IF NOT EXISTS user_settings (
        user_id VARCHAR(255) PRIMARY KEY,
        default_validation_rules JSONB,
        preferred_language VARCHAR(10),
        email_notifications BOOLEAN DEFAULT false,
        webhook_url TEXT,
        api_key VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Field mappings table for ML training
      `CREATE TABLE IF NOT EXISTS field_mappings (
        id SERIAL PRIMARY KEY,
        form_field VARCHAR(255) NOT NULL,
        document_field VARCHAR(255) NOT NULL,
        confidence DECIMAL(3,2),
        matched BOOLEAN,
        user_feedback BOOLEAN,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Templates table
      `CREATE TABLE IF NOT EXISTS templates (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description TEXT,
        form_path TEXT NOT NULL,
        field_mappings JSONB,
        validation_rules JSONB,
        user_id VARCHAR(255),
        is_public BOOLEAN DEFAULT false,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )`,

      // Create indexes
      `CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status)`,
      `CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_processing_history_job_id ON processing_history(job_id)`,
      `CREATE INDEX IF NOT EXISTS idx_field_mappings_matched ON field_mappings(matched)`,
      `CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public)`,
    ];

    for (const query of queries) {
      await this.pool.query(query);
    }
  }

  // Job management
  async createJob(job: Partial<JobRecord>): Promise<JobRecord> {
    const query = `
      INSERT INTO jobs (id, type, status, user_id, documents_count, started_at, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      job.id,
      job.type,
      job.status || 'pending',
      job.userId,
      job.documentsCount,
      job.startedAt,
      JSON.stringify(job.metadata || {}),
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async updateJob(id: string, updates: Partial<JobRecord>): Promise<JobRecord> {
    const query = `
      UPDATE jobs 
      SET status = COALESCE($2, status),
          completed_at = COALESCE($3, completed_at),
          failed_at = COALESCE($4, failed_at),
          result = COALESCE($5, result),
          error = COALESCE($6, error),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const values = [
      id,
      updates.status,
      updates.completedAt,
      updates.failedAt,
      JSON.stringify(updates.result),
      updates.error,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getJob(id: string): Promise<JobRecord | null> {
    const query = 'SELECT * FROM jobs WHERE id = $1';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async getJobsByUser(userId: string, limit: number = 50): Promise<JobRecord[]> {
    const query = `
      SELECT * FROM jobs 
      WHERE user_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    const result = await this.pool.query(query, [userId, limit]);
    return result.rows;
  }

  // Processing history
  async createProcessingHistory(
    history: Omit<ProcessingHistory, 'id' | 'createdAt'>
  ): Promise<ProcessingHistory> {
    const query = `
      INSERT INTO processing_history 
      (job_id, form_path, document_paths, output_path, filled_fields, confidence, processing_time)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      history.jobId,
      history.formPath,
      history.documentPaths,
      history.outputPath,
      history.filledFields,
      history.confidence,
      history.processingTime,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getProcessingHistory(jobId: string): Promise<ProcessingHistory[]> {
    const query = 'SELECT * FROM processing_history WHERE job_id = $1';
    const result = await this.pool.query(query, [jobId]);
    return result.rows;
  }

  // User settings
  async upsertUserSettings(settings: UserSettings): Promise<UserSettings> {
    const query = `
      INSERT INTO user_settings 
      (user_id, default_validation_rules, preferred_language, email_notifications, webhook_url, api_key)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id) 
      DO UPDATE SET
        default_validation_rules = EXCLUDED.default_validation_rules,
        preferred_language = EXCLUDED.preferred_language,
        email_notifications = EXCLUDED.email_notifications,
        webhook_url = EXCLUDED.webhook_url,
        api_key = EXCLUDED.api_key,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const values = [
      settings.userId,
      JSON.stringify(settings.defaultValidationRules),
      settings.preferredLanguage,
      settings.emailNotifications,
      settings.webhookUrl,
      settings.apiKey,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getUserSettings(userId: string): Promise<UserSettings | null> {
    const query = 'SELECT * FROM user_settings WHERE user_id = $1';
    const result = await this.pool.query(query, [userId]);
    return result.rows[0] || null;
  }

  // Field mappings for ML training
  async saveFieldMapping(
    formField: string,
    documentField: string,
    confidence: number,
    matched: boolean,
    userFeedback?: boolean
  ): Promise<void> {
    const query = `
      INSERT INTO field_mappings 
      (form_field, document_field, confidence, matched, user_feedback)
      VALUES ($1, $2, $3, $4, $5)
    `;

    await this.pool.query(query, [formField, documentField, confidence, matched, userFeedback]);
  }

  async getFieldMappingsForTraining(limit: number = 1000): Promise<any[]> {
    const query = `
      SELECT * FROM field_mappings 
      WHERE user_feedback IS NOT NULL
      ORDER BY created_at DESC
      LIMIT $1
    `;
    const result = await this.pool.query(query, [limit]);
    return result.rows;
  }

  // Templates
  async createTemplate(template: {
    name: string;
    description?: string;
    formPath: string;
    fieldMappings?: any;
    validationRules?: any;
    userId?: string;
    isPublic?: boolean;
  }): Promise<any> {
    const query = `
      INSERT INTO templates 
      (name, description, form_path, field_mappings, validation_rules, user_id, is_public)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      template.name,
      template.description,
      template.formPath,
      JSON.stringify(template.fieldMappings),
      JSON.stringify(template.validationRules),
      template.userId,
      template.isPublic || false,
    ];

    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  async getTemplates(userId?: string): Promise<any[]> {
    let query = 'SELECT * FROM templates WHERE is_public = true';
    const values: any[] = [];

    if (userId) {
      query += ' OR user_id = $1';
      values.push(userId);
    }

    query += ' ORDER BY created_at DESC';

    const result = await this.pool.query(query, values);
    return result.rows;
  }

  // Statistics
  async getStatistics(userId?: string): Promise<{
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    averageProcessingTime: number;
    averageConfidence: number;
  }> {
    let whereClause = '';
    const values: any[] = [];

    if (userId) {
      whereClause = 'WHERE j.user_id = $1';
      values.push(userId);
    }

    const query = `
      SELECT 
        COUNT(DISTINCT j.id) as total_jobs,
        COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END) as completed_jobs,
        COUNT(DISTINCT CASE WHEN j.status = 'failed' THEN j.id END) as failed_jobs,
        AVG(ph.processing_time) as avg_processing_time,
        AVG(ph.confidence) as avg_confidence
      FROM jobs j
      LEFT JOIN processing_history ph ON j.id = ph.job_id
      ${whereClause}
    `;

    const result = await this.pool.query(query, values);
    const stats = result.rows[0];

    return {
      totalJobs: parseInt(stats.total_jobs) || 0,
      completedJobs: parseInt(stats.completed_jobs) || 0,
      failedJobs: parseInt(stats.failed_jobs) || 0,
      averageProcessingTime: parseFloat(stats.avg_processing_time) || 0,
      averageConfidence: parseFloat(stats.avg_confidence) || 0,
    };
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('Database connection pool closed');
  }
}
