#!/bin/bash

# QuikAdmin Authentication Setup Script
# This script sets up the authentication system by running database migrations

echo "🔧 Setting up QuikAdmin Authentication System..."

# Check if psql is available
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL client (psql) is not installed. Please install it first."
    exit 1
fi

# Set default environment variables if not provided
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_NAME=${DB_NAME:-pdffiller}
DB_USER=${DB_USER:-pdffiller}

echo "📊 Database Configuration:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"

# Check if database exists and is accessible
echo "🔍 Checking database connectivity..."
if ! psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "❌ Cannot connect to database. Please check your database configuration."
    echo "   Make sure PostgreSQL is running and the database exists."
    echo "   You may need to run: createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME"
    exit 1
fi

echo "✅ Database connection successful!"

# Run the initial database setup if needed
echo "🏗️  Running initial database setup..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/init.sql > /dev/null 2>&1; then
    echo "✅ Initial database setup completed (or already exists)"
else
    echo "⚠️  Initial database setup failed or already exists - continuing..."
fi

# Run the authentication migration
echo "🔐 Setting up authentication tables..."
if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f scripts/auth-migration.sql > /dev/null 2>&1; then
    echo "✅ Authentication migration completed successfully!"
else
    echo "❌ Authentication migration failed. Please check the error messages above."
    exit 1
fi

# Verify the setup
echo "🔍 Verifying authentication setup..."
TABLES_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name IN ('users', 'refresh_tokens');" | tr -d ' ')

if [ "$TABLES_COUNT" = "2" ]; then
    echo "✅ Authentication tables verified successfully!"
    
    # Check if default admin user exists
    USER_COUNT=$(psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM users WHERE role = 'admin';" | tr -d ' ')
    if [ "$USER_COUNT" -gt "0" ]; then
        echo "✅ Default admin user exists"
    else
        echo "⚠️  No admin users found - you may need to create one"
    fi
else
    echo "❌ Authentication setup verification failed!"
    exit 1
fi

echo ""
echo "🎉 QuikAdmin Authentication Setup Complete!"
echo ""
echo "📝 Next Steps:"
echo "   1. Copy .env.example to .env and configure your JWT secrets:"
echo "      cp .env.example .env"
echo ""
echo "   2. Generate secure JWT secrets (recommended):"
echo "      JWT_SECRET=\$(openssl rand -base64 32)"
echo "      JWT_REFRESH_SECRET=\$(openssl rand -base64 32)"
echo ""
echo "   3. Start the server:"
echo "      npm run dev"
echo ""
echo "   4. Test the API endpoints:"
echo "      curl http://localhost:3000/health"
echo "      curl -X POST http://localhost:3000/api/auth/register \\"
echo "           -H \"Content-Type: application/json\" \\"
echo "           -d '{\"email\":\"test@example.com\",\"password\":\"Test123!\",\"fullName\":\"Test User\"}'"
echo ""
echo "📚 API Documentation: /mnt/n/NomadCrew/quikadmin/docs/API_DOCUMENTATION.md"
echo ""