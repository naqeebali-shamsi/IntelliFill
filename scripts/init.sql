-- Database initialization script for PDF Filler Tool

-- Create database if not exists
SELECT 'CREATE DATABASE pdffiller'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'pdffiller')\gexec

-- Connect to the database
\c pdffiller;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE job_type AS ENUM ('single', 'multiple', 'batch');
CREATE TYPE user_role AS ENUM ('user', 'admin', 'api');

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role user_role DEFAULT 'user',
    api_key VARCHAR(255) UNIQUE,
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Jobs table (updated)
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    type job_type NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    documents_count INTEGER NOT NULL,
    priority INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    result JSONB,
    error TEXT,
    metadata JSONB,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Processing history table (updated)
CREATE TABLE IF NOT EXISTS processing_history (
    id SERIAL PRIMARY KEY,
    job_id VARCHAR(255) REFERENCES jobs(id) ON DELETE CASCADE,
    form_path TEXT NOT NULL,
    document_paths TEXT[] NOT NULL,
    output_path TEXT NOT NULL,
    filled_fields TEXT[],
    confidence DECIMAL(3,2),
    processing_time INTEGER,
    ocr_applied BOOLEAN DEFAULT false,
    ml_enhanced BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User settings table (updated)
CREATE TABLE IF NOT EXISTS user_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    default_validation_rules JSONB,
    preferred_language VARCHAR(10) DEFAULT 'en',
    email_notifications BOOLEAN DEFAULT true,
    webhook_url TEXT,
    auto_ocr BOOLEAN DEFAULT false,
    auto_ml_enhancement BOOLEAN DEFAULT true,
    default_output_format VARCHAR(20) DEFAULT 'pdf',
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Field mappings table for ML training (updated)
CREATE TABLE IF NOT EXISTS field_mappings (
    id SERIAL PRIMARY KEY,
    form_field VARCHAR(255) NOT NULL,
    document_field VARCHAR(255) NOT NULL,
    confidence DECIMAL(3,2),
    matched BOOLEAN,
    user_feedback BOOLEAN,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    model_version VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates table (updated)
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    form_path TEXT NOT NULL,
    field_mappings JSONB,
    validation_rules JSONB,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    average_confidence DECIMAL(3,2),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    endpoint VARCHAR(255) NOT NULL,
    method VARCHAR(10) NOT NULL,
    status_code INTEGER,
    response_time INTEGER,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ML model versions
CREATE TABLE IF NOT EXISTS ml_models (
    id SERIAL PRIMARY KEY,
    model_name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    accuracy DECIMAL(3,2),
    precision_score DECIMAL(3,2),
    recall_score DECIMAL(3,2),
    f1_score DECIMAL(3,2),
    training_samples INTEGER,
    model_path TEXT,
    is_active BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(model_name, version)
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    entity_type VARCHAR(100),
    entity_id VARCHAR(255),
    old_value JSONB,
    new_value JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_type_status ON jobs(type, status);

CREATE INDEX IF NOT EXISTS idx_processing_history_job_id ON processing_history(job_id);
CREATE INDEX IF NOT EXISTS idx_processing_history_created_at ON processing_history(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_field_mappings_matched ON field_mappings(matched);
CREATE INDEX IF NOT EXISTS idx_field_mappings_user_feedback ON field_mappings(user_feedback);
CREATE INDEX IF NOT EXISTS idx_field_mappings_model_version ON field_mappings(model_version);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_is_public ON templates(is_public);
CREATE INDEX IF NOT EXISTS idx_templates_tags ON templates USING GIN(tags);

CREATE INDEX IF NOT EXISTS idx_api_usage_user_id ON api_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_endpoint ON api_usage(endpoint);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_templates_updated_at BEFORE UPDATE ON templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default admin user (password: admin123)
INSERT INTO users (email, password_hash, full_name, role, email_verified)
VALUES (
    'admin@pdffiller.local',
    crypt('admin123', gen_salt('bf')),
    'System Administrator',
    'admin',
    true
) ON CONFLICT (email) DO NOTHING;

-- Insert default ML model record
INSERT INTO ml_models (model_name, version, accuracy, is_active)
VALUES (
    'field-mapper',
    '1.0.0',
    0.941,
    true
) ON CONFLICT (model_name, version) DO NOTHING;

-- Create materialized view for statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS job_statistics AS
SELECT 
    u.id as user_id,
    u.email,
    COUNT(DISTINCT j.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN j.status = 'completed' THEN j.id END) as completed_jobs,
    COUNT(DISTINCT CASE WHEN j.status = 'failed' THEN j.id END) as failed_jobs,
    AVG(ph.processing_time) as avg_processing_time,
    AVG(ph.confidence) as avg_confidence,
    MAX(j.created_at) as last_job_date
FROM users u
LEFT JOIN jobs j ON u.id = j.user_id
LEFT JOIN processing_history ph ON j.id = ph.job_id
GROUP BY u.id, u.email;

-- Create index on materialized view
CREATE INDEX IF NOT EXISTS idx_job_statistics_user_id ON job_statistics(user_id);

-- Refresh materialized view function
CREATE OR REPLACE FUNCTION refresh_job_statistics()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY job_statistics;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO pdffiller;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO pdffiller;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO pdffiller;