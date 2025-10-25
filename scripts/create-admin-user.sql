-- Create admin user for testing
INSERT INTO users (email, password_hash, full_name, role, email_verified, is_active)
VALUES (
    'admin@example.com',
    '$2b$12$ZWacrOnS1S81WGTMOaLfueSvesa4rJ5p0FGT6rD3pOdLKJ01VHk0.',
    'Admin User',
    'admin',
    true,
    true
) ON CONFLICT (email) 
DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    email_verified = EXCLUDED.email_verified,
    is_active = EXCLUDED.is_active;