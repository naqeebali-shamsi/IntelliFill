import { Pool } from 'pg';
import { 
  Company, 
  User, 
  Document, 
  ProcessingJob, 
  AuthContext,
  CreateCompanyResponse 
} from '../types/database';

export class NeonService {
  private pool: Pool;
  private currentCompanyId: string | null = null;
  private currentUserId: string | null = null;

  constructor() {
    const connectionString = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('NEON_DATABASE_URL or DATABASE_URL environment variable is required');
    }

    this.pool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  // Set the current tenant context for RLS
  async setTenantContext(companyId: string, userId: string): Promise<void> {
    this.currentCompanyId = companyId;
    this.currentUserId = userId;
  }

  // Execute query with tenant context
  private async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      // Set tenant context for RLS
      if (this.currentCompanyId) {
        await client.query('SET app.current_company_id = $1', [this.currentCompanyId]);
      }
      if (this.currentUserId) {
        await client.query('SET app.current_user_id = $1', [this.currentUserId]);
      }

      const result = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  // Company & User Management
  async createCompanyAndOwner(
    companyName: string,
    companySlug: string,
    ownerEmail: string,
    ownerName: string,
    authId: string
  ): Promise<CreateCompanyResponse> {
    const sql = 'SELECT create_company_and_owner($1, $2, $3, $4, $5) as result';
    const result = await this.query<{ result: CreateCompanyResponse }>(
      sql, 
      [companyName, companySlug, ownerEmail, ownerName, authId]
    );
    return result[0].result;
  }

  async getUserByAuthId(authId: string): Promise<AuthContext | null> {
    const sql = 'SELECT get_user_by_auth_id($1) as result';
    const result = await this.query<{ result: AuthContext }>(sql, [authId]);
    return result[0]?.result || null;
  }

  async getCompanyById(companyId: string): Promise<Company | null> {
    const sql = 'SELECT * FROM companies WHERE id = $1';
    const result = await this.query<Company>(sql, [companyId]);
    return result[0] || null;
  }

  async getUserById(userId: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = $1';
    const result = await this.query<User>(sql, [userId]);
    return result[0] || null;
  }

  // Document Management
  async createDocument(
    companyId: string,
    uploadedBy: string,
    fileName: string,
    fileType: string,
    fileSize: number,
    storagePath: string
  ): Promise<Document> {
    const sql = `
      INSERT INTO documents (company_id, uploaded_by, file_name, file_type, file_size, storage_path)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await this.query<Document>(
      sql,
      [companyId, uploadedBy, fileName, fileType, fileSize, storagePath]
    );
    return result[0];
  }

  async updateDocumentStatus(
    documentId: string, 
    status: Document['status'],
    metadata?: Record<string, any>
  ): Promise<void> {
    const sql = metadata 
      ? 'UPDATE documents SET status = $2, metadata = $3, processed_at = CURRENT_TIMESTAMP WHERE id = $1'
      : 'UPDATE documents SET status = $2, processed_at = CURRENT_TIMESTAMP WHERE id = $1';
    
    const params = metadata 
      ? [documentId, status, JSON.stringify(metadata)]
      : [documentId, status];
    
    await this.query(sql, params);
  }

  async getDocumentsByCompany(companyId: string, limit = 50): Promise<Document[]> {
    const sql = `
      SELECT * FROM documents 
      WHERE company_id = $1 
      ORDER BY created_at DESC 
      LIMIT $2
    `;
    return this.query<Document>(sql, [companyId, limit]);
  }

  // Processing Jobs
  async createProcessingJob(
    companyId: string,
    documentId: string,
    userId: string,
    jobType: ProcessingJob['job_type']
  ): Promise<ProcessingJob> {
    const sql = `
      INSERT INTO processing_jobs (company_id, document_id, user_id, job_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await this.query<ProcessingJob>(
      sql,
      [companyId, documentId, userId, jobType]
    );
    return result[0];
  }

  async updateJobStatus(
    jobId: string,
    status: ProcessingJob['status'],
    data?: {
      extractedData?: any;
      mappedFields?: any;
      errorMessage?: string;
      confidenceScore?: number;
    }
  ): Promise<void> {
    const updates = ['status = $2'];
    const params: any[] = [jobId, status];
    let paramCount = 2;

    if (status === 'processing') {
      updates.push('started_at = CURRENT_TIMESTAMP');
    } else if (status === 'completed' || status === 'failed') {
      updates.push('completed_at = CURRENT_TIMESTAMP');
    }

    if (data?.extractedData) {
      paramCount++;
      updates.push(`extracted_data = $${paramCount}`);
      params.push(JSON.stringify(data.extractedData));
    }

    if (data?.mappedFields) {
      paramCount++;
      updates.push(`mapped_fields = $${paramCount}`);
      params.push(JSON.stringify(data.mappedFields));
    }

    if (data?.errorMessage) {
      paramCount++;
      updates.push(`error_message = $${paramCount}`);
      params.push(data.errorMessage);
    }

    if (data?.confidenceScore !== undefined) {
      paramCount++;
      updates.push(`confidence_score = $${paramCount}`);
      params.push(data.confidenceScore);
    }

    const sql = `UPDATE processing_jobs SET ${updates.join(', ')} WHERE id = $1`;
    await this.query(sql, params);
  }

  // Usage & Billing
  async trackUsage(
    companyId: string,
    userId: string,
    action: string,
    credits: number = 1
  ): Promise<boolean> {
    const sql = 'SELECT track_usage($1, $2, $3, $4) as success';
    const result = await this.query<{ success: boolean }>(
      sql,
      [companyId, userId, action, credits]
    );
    return result[0].success;
  }

  async getCompanyUsage(companyId: string, days: number = 30): Promise<any> {
    const sql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total_actions,
        SUM(credits_used) as total_credits
      FROM usage_logs
      WHERE company_id = $1
        AND created_at >= CURRENT_DATE - INTERVAL '${days} days'
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `;
    return this.query(sql, [companyId]);
  }

  // Cleanup
  async close(): Promise<void> {
    await this.pool.end();
  }
}