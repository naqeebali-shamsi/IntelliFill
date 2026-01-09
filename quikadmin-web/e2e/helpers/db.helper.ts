/**
 * Database Seeding Helper for E2E Tests
 *
 * Provides direct database manipulation for:
 * - Seeding test data
 * - Verifying record existence
 * - Cleanup after tests
 *
 * Uses Supabase client or direct connection when API endpoints are insufficient.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TEST_PREFIX, generateTestId } from './api.helper';

/**
 * Database connection configuration
 */
interface DbConfig {
  supabaseUrl?: string;
  supabaseKey?: string;
  serviceRoleKey?: string;
}

/**
 * Record verification result
 */
interface VerificationResult {
  exists: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

/**
 * Seeded data reference for cleanup
 */
interface SeededData {
  table: string;
  id: string;
  createdAt: Date;
}

/**
 * Database Helper class for test data operations
 */
export class DbHelper {
  private supabase: SupabaseClient | null = null;
  private seededRecords: SeededData[] = [];
  private config: DbConfig;

  constructor(config?: DbConfig) {
    this.config = {
      supabaseUrl: config?.supabaseUrl || process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
      supabaseKey: config?.supabaseKey || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
      serviceRoleKey: config?.serviceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY,
    };
  }

  /**
   * Initialize Supabase client
   */
  async init(): Promise<void> {
    if (!this.supabase && this.config.supabaseUrl && this.config.supabaseKey) {
      // Use service role key if available for full access, otherwise use anon key
      const key = this.config.serviceRoleKey || this.config.supabaseKey;

      this.supabase = createClient(this.config.supabaseUrl, key, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  }

  /**
   * Check if database is accessible
   */
  async isConnected(): Promise<boolean> {
    try {
      await this.init();
      if (!this.supabase) return false;

      // Try a simple query to verify connection
      const { error } = await this.supabase.from('User').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Verify a record exists in the database
   */
  async verifyRecordExists(
    table: string,
    conditions: Record<string, unknown>
  ): Promise<VerificationResult> {
    await this.init();

    if (!this.supabase) {
      return { exists: false, error: 'Database not connected' };
    }

    try {
      let query = this.supabase.from(table).select('*');

      // Apply conditions
      for (const [key, value] of Object.entries(conditions)) {
        query = query.eq(key, value);
      }

      const { data, error } = await query.maybeSingle();

      if (error) {
        return { exists: false, error: error.message };
      }

      return {
        exists: data !== null,
        data: data || undefined,
      };
    } catch (error) {
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Verify user exists by email
   */
  async verifyUserExists(email: string): Promise<VerificationResult> {
    return this.verifyRecordExists('User', { email });
  }

  /**
   * Verify user has completed onboarding
   */
  async verifyUserOnboardingComplete(userId: string): Promise<boolean> {
    const result = await this.verifyRecordExists('User', {
      id: userId,
      onboardingCompleted: true
    });
    return result.exists;
  }

  /**
   * Verify document exists
   */
  async verifyDocumentExists(documentId: string): Promise<VerificationResult> {
    return this.verifyRecordExists('Document', { id: documentId });
  }

  /**
   * Verify organization exists
   */
  async verifyOrganizationExists(organizationId: string): Promise<VerificationResult> {
    return this.verifyRecordExists('Organization', { id: organizationId });
  }

  /**
   * Seed template data for testing
   */
  async seedTemplateData(templateData: {
    name: string;
    category?: string;
    fields?: Record<string, unknown>[];
    organizationId?: string;
  }): Promise<{ id: string } | null> {
    await this.init();

    if (!this.supabase) {
      console.warn('Database not connected, cannot seed template');
      return null;
    }

    try {
      const testId = generateTestId();
      const template = {
        id: testId,
        name: templateData.name,
        category: templateData.category || 'test',
        fields: templateData.fields || [],
        organizationId: templateData.organizationId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('Template')
        .insert(template)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to seed template:', error);
        return null;
      }

      this.seededRecords.push({
        table: 'Template',
        id: data.id,
        createdAt: new Date(),
      });

      return { id: data.id };
    } catch (error) {
      console.error('Error seeding template:', error);
      return null;
    }
  }

  /**
   * Seed organization data for testing
   */
  async seedOrganizationData(orgData: {
    name: string;
    slug?: string;
    ownerId?: string;
  }): Promise<{ id: string } | null> {
    await this.init();

    if (!this.supabase) {
      console.warn('Database not connected, cannot seed organization');
      return null;
    }

    try {
      const testId = generateTestId();
      const organization = {
        id: testId,
        name: orgData.name,
        slug: orgData.slug || `${TEST_PREFIX}-${testId.slice(-8)}`,
        ownerId: orgData.ownerId,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('Organization')
        .insert(organization)
        .select('id')
        .single();

      if (error) {
        console.error('Failed to seed organization:', error);
        return null;
      }

      this.seededRecords.push({
        table: 'Organization',
        id: data.id,
        createdAt: new Date(),
      });

      return { id: data.id };
    } catch (error) {
      console.error('Error seeding organization:', error);
      return null;
    }
  }

  /**
   * Cleanup organization data and related records
   */
  async cleanupOrgData(organizationId: string): Promise<void> {
    await this.init();

    if (!this.supabase) {
      console.warn('Database not connected, cannot cleanup');
      return;
    }

    try {
      // Delete in order respecting foreign key constraints
      // 1. Delete documents
      await this.supabase
        .from('Document')
        .delete()
        .eq('organizationId', organizationId);

      // 2. Delete templates
      await this.supabase
        .from('Template')
        .delete()
        .eq('organizationId', organizationId);

      // 3. Delete memberships
      await this.supabase
        .from('Membership')
        .delete()
        .eq('organizationId', organizationId);

      // 4. Delete organization
      await this.supabase
        .from('Organization')
        .delete()
        .eq('id', organizationId);

      console.log(`Cleaned up organization ${organizationId}`);
    } catch (error) {
      console.error('Error cleaning up organization:', error);
    }
  }

  /**
   * Cleanup all test data created with the test prefix
   */
  async cleanupTestData(): Promise<void> {
    await this.init();

    if (!this.supabase) {
      console.warn('Database not connected, cannot cleanup');
      return;
    }

    try {
      // Cleanup users with test prefix email
      await this.supabase
        .from('User')
        .delete()
        .like('email', `${TEST_PREFIX}%`);

      // Cleanup organizations with test prefix slug
      await this.supabase
        .from('Organization')
        .delete()
        .like('slug', `${TEST_PREFIX}%`);

      console.log('Cleaned up all test data');
    } catch (error) {
      console.error('Error cleaning up test data:', error);
    }
  }

  /**
   * Cleanup all seeded records from this session
   */
  async cleanupSeededRecords(): Promise<void> {
    await this.init();

    if (!this.supabase) {
      console.warn('Database not connected, cannot cleanup');
      return;
    }

    // Cleanup in reverse order (LIFO)
    for (let i = this.seededRecords.length - 1; i >= 0; i--) {
      const record = this.seededRecords[i];
      try {
        await this.supabase
          .from(record.table)
          .delete()
          .eq('id', record.id);

        console.log(`Deleted ${record.table} record ${record.id}`);
      } catch (error) {
        console.error(`Failed to delete ${record.table} record ${record.id}:`, error);
      }
    }

    this.seededRecords = [];
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<Record<string, unknown> | null> {
    await this.init();

    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('User')
      .select('*')
      .eq('email', email)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<Record<string, unknown> | null> {
    await this.init();

    if (!this.supabase) return null;

    const { data, error } = await this.supabase
      .from('Document')
      .select('*')
      .eq('id', documentId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  }

  /**
   * Update user password hash (for testing)
   */
  async verifyPasswordUpdated(userId: string, afterTimestamp: Date): Promise<boolean> {
    await this.init();

    if (!this.supabase) return false;

    const { data, error } = await this.supabase
      .from('User')
      .select('updatedAt')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) return false;

    const updatedAt = new Date(data.updatedAt);
    return updatedAt > afterTimestamp;
  }

  /**
   * Count documents for organization
   */
  async countDocuments(organizationId: string): Promise<number> {
    await this.init();

    if (!this.supabase) return 0;

    const { count, error } = await this.supabase
      .from('Document')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Count members in organization
   */
  async countMembers(organizationId: string): Promise<number> {
    await this.init();

    if (!this.supabase) return 0;

    const { count, error } = await this.supabase
      .from('Membership')
      .select('*', { count: 'exact', head: true })
      .eq('organizationId', organizationId);

    if (error) return 0;
    return count || 0;
  }

  /**
   * Dispose client
   */
  async dispose(): Promise<void> {
    this.supabase = null;
    this.seededRecords = [];
  }
}

// Singleton instance
let defaultDbHelper: DbHelper | null = null;

export function getDbHelper(): DbHelper {
  if (!defaultDbHelper) {
    defaultDbHelper = new DbHelper();
  }
  return defaultDbHelper;
}

export async function disposeDbHelper(): Promise<void> {
  if (defaultDbHelper) {
    await defaultDbHelper.dispose();
    defaultDbHelper = null;
  }
}
