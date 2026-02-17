#!/bin/sh
set -e

echo "🔄 Running database migrations..."
echo "📂 Current directory: $(pwd)"
echo "📂 Checking for CLI file..."
ls -la apps/backend/dist/database/cli.js || echo "❌ CLI file not found!"

if [ -f "apps/backend/dist/database/cli.js" ]; then
    echo "✅ CLI file exists, running migrations..."
    node apps/backend/dist/database/cli.js
    MIGRATION_EXIT_CODE=$?
    
    if [ $MIGRATION_EXIT_CODE -ne 0 ]; then
        echo "❌ Migration failed with exit code: $MIGRATION_EXIT_CODE"
        exit 1
    fi
    
    echo "✅ Migrations completed successfully"
else
    echo "⚠️  Migration CLI not found, skipping migrations"
    echo "⚠️  This might cause runtime errors if tables don't exist"
fi

echo "🚀 Starting application..."
exec "$@"
