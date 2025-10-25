-- Create a test user with known credentials
-- Password: Test123! (hashed with bcrypt)

INSERT INTO users (
    id,
    email,
    password_hash,
    full_name,
    role,
    email_verified,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'test@example.com',
    '$2b$12$6f0X8eWJ6MteVqvPXvD.9O3kZGWEPbLYSgT.xZJYBFAhWL9CK5V5a', -- Test123!
    'Test User',
    'user',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true,
    email_verified = true,
    updated_at = CURRENT_TIMESTAMP;

-- Also create an admin user
INSERT INTO users (
    id,
    email,
    password_hash,
    full_name,
    role,
    email_verified,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'admin@example.com',
    '$2b$12$6f0X8eWJ6MteVqvPXvD.9O3kZGWEPbLYSgT.xZJYBFAhWL9CK5V5a', -- Test123!
    'Admin User',
    'admin',
    true,
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    is_active = true,
    email_verified = true,
    role = 'admin',
    updated_at = CURRENT_TIMESTAMP;