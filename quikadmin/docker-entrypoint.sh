#!/bin/sh
set -e

echo "=== IntelliFill Backend Startup ==="
echo "Environment: ${NODE_ENV:-development}"

# Run database migrations using the direct (non-pooled) connection.
# DIRECT_DATABASE_URL bypasses PgBouncer for DDL operations.
# prisma migrate deploy is safe for production: it only applies pending
# migrations and uses advisory locks to prevent concurrent execution.
if [ -n "$DATABASE_URL" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy --schema ./prisma/schema.prisma
  echo "Migrations completed successfully."
else
  echo "WARNING: DATABASE_URL not set, skipping migrations."
fi

echo "Starting application..."
exec "$@"
