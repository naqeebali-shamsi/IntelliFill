// Generated types for Neon database schema
// Project: quikadmin-production

export interface Company {
  id: string;
  name: string;
  slug: string;
  subscription_tier: 'trial' | 'starter' | 'professional' | 'enterprise';
  subscription_status: 'active' | 'past_due' | 'canceled' | 'trialing';
  credits_remaining: number;
  credits_monthly_limit: number;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  settings: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

export interface User {
  id: string;
  company_id: string;
  email: string;
  full_name?: string | null;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  auth_id?: string | null;
  is_active: boolean;
  last_login?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface Document {
  id: string;
  company_id: string;
  uploaded_by: string;
  file_name: string;
  file_type?: string | null;
  file_size?: number | null;
  storage_path?: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  metadata: Record<string, any>;
  processed_at?: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ProcessingJob {
  id: string;
  company_id: string;
  document_id: string;
  user_id: string;
  job_type: 'extract' | 'map' | 'fill' | 'validate';
  status: 'queued' | 'processing' | 'completed' | 'failed';
  priority: number;
  extracted_data?: Record<string, any> | null;
  mapped_fields?: Record<string, any> | null;
  filled_form_url?: string | null;
  confidence_score?: number | null;
  credits_used: number;
  error_message?: string | null;
  started_at?: Date | null;
  completed_at?: Date | null;
  created_at: Date;
}

export interface FormTemplate {
  id: string;
  company_id: string;
  name: string;
  description?: string | null;
  fields: Record<string, any>;
  is_public: boolean;
  created_by?: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UsageLog {
  id: string;
  company_id: string;
  user_id?: string | null;
  action: string;
  credits_used: number;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface ApiKey {
  id: string;
  company_id: string;
  name: string;
  key_hash: string;
  last_used_at?: Date | null;
  expires_at?: Date | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: Date;
}

// Helper types for API responses
export interface AuthContext {
  user_id: string;
  company_id: string;
  email: string;
  full_name?: string;
  role: User['role'];
  company_name: string;
  company_slug: string;
  subscription_tier: Company['subscription_tier'];
  credits_remaining: number;
}

export interface CreateCompanyResponse {
  company_id: string;
  user_id: string;
  company_slug: string;
}