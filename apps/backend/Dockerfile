# Multi-stage build for NestJS Backend
FROM node:22-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/shared-types/tsconfig.json ./packages/shared-types/

# Install dependencies
RUN NODE_ENV=development npm ci --legacy-peer-deps --ignore-scripts
RUN npm install -g typescript @nestjs/cli tsx

# Build shared-types package
WORKDIR /app/packages/shared-types
RUN npm run build

# Copy source code
WORKDIR /app
COPY apps/backend ./apps/backend

# Build backend
WORKDIR /app/apps/backend
RUN npm run build

# Production stage
FROM node:22-alpine AS production

# Install wget for healthcheck and postgresql-client for SQL imports
RUN apk add --no-cache wget postgresql-client

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY apps/backend/package*.json ./apps/backend/
COPY packages/shared-types/package*.json ./packages/shared-types/

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps --ignore-scripts

# Copy built application from builder
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

# Copy deployment scripts and SQL files
COPY apps/backend/.coolify-deploy.sh ./apps/backend/.coolify-deploy.sh
COPY apps/backend/mark-migrations-executed.sql ./apps/backend/mark-migrations-executed.sql
COPY apps/backend/cms-seed-data.sql ./apps/backend/cms-seed-data.sql
COPY apps/backend/scripts/sync-migrations.sh ./apps/backend/scripts/sync-migrations.sh
RUN chmod +x ./apps/backend/.coolify-deploy.sh ./apps/backend/scripts/sync-migrations.sh

# Create uploads directory for persistent storage
RUN mkdir -p ./apps/backend/uploads && chmod 755 ./apps/backend/uploads

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 -O /dev/null http://localhost:3000/api/health || exit 1

# Copy and configure entrypoint script
COPY apps/backend/docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Set entrypoint
ENTRYPOINT ["docker-entrypoint.sh"]

# Start application
CMD ["node", "apps/backend/dist/main.js"]
