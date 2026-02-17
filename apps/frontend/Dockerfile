# Multi-stage build for Next.js Frontend
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files (including package-lock.json from root)
COPY package.json package-lock.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared-types/package*.json ./packages/shared-types/
COPY packages/shared-types/src ./packages/shared-types/src
COPY packages/shared-types/tsconfig.json ./packages/shared-types/

# Install dependencies
RUN npm ci --legacy-peer-deps

# Build shared-types package
WORKDIR /app/packages/shared-types
RUN npm run build

# Copy source code
WORKDIR /app
COPY apps/frontend ./apps/frontend

# Ensure node_modules are accessible for build (copy from root to workspace)
# Using copy instead of symlink for Docker compatibility
RUN cp -r /app/node_modules /app/apps/frontend/node_modules

# Build-time args (Coolify will inject ALL env vars as ARGs)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_SOCKET_URL
ARG NEXT_PUBLIC_APP_URL
ARG NODE_ENV=production

# Set as ENV for Next.js build
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_SOCKET_URL=${NEXT_PUBLIC_SOCKET_URL}
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ENV NODE_ENV=${NODE_ENV}

# Disable SSL certificate verification for self-signed certificates during build
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Build Next.js app
WORKDIR /app/apps/frontend

# Increase Node.js memory limit for build (4GB)
ENV NODE_OPTIONS="--max-old-space-size=4096"

# Debug: Check node_modules structure and Tiptap packages
RUN echo "=====================================" && \
    echo "DEBUG: Build environment check" && \
    echo "=====================================" && \
    echo "Directory: $(pwd)" && \
    echo "node_modules: $(ls -ld node_modules 2>/dev/null || echo 'NOT FOUND')" && \
    echo "" && \
    echo "Tiptap packages:" && \
    ls -1 node_modules/@tiptap 2>/dev/null | head -5 || echo "ERROR: @tiptap not found!" && \
    echo "" && \
    echo "Core packages:" && \
    (test -d node_modules/@tiptap/core && echo "✓ @tiptap/core OK" || echo "✗ @tiptap/core MISSING") && \
    (test -d node_modules/@tiptap/react && echo "✓ @tiptap/react OK" || echo "✗ @tiptap/react MISSING") && \
    (test -d node_modules/@tiptap/starter-kit && echo "✓ @tiptap/starter-kit OK" || echo "✗ @tiptap/starter-kit MISSING") && \
    echo "=====================================" && \
    echo ""

# Run build with increased memory limit - capture full output even on failure
RUN npm run build 2>&1 | tee /tmp/build-output.log; \
    BUILD_EXIT=$?; \
    if [ $BUILD_EXIT -ne 0 ]; then \
        echo ""; \
        echo "=====================================" && \
        echo "BUILD FAILED - Full output above" && \
        echo "=====================================" && \
        echo "Exit code: $BUILD_EXIT" && \
        exit 1; \
    fi

# Production stage
FROM node:20-alpine AS production

# Install wget for healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Copy package files (including package-lock.json from root)
COPY package.json package-lock.json ./
COPY apps/frontend/package*.json ./apps/frontend/
COPY packages/shared-types/package*.json ./packages/shared-types/

# Install production dependencies only
RUN npm ci --omit=dev --legacy-peer-deps

# Copy built application from builder
# Copy built application from builder
COPY --from=builder /app/apps/frontend/.next/standalone ./
COPY --from=builder /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public

# Expose port
EXPOSE 3000

# Set environment
ENV NODE_ENV=production
ENV PORT=3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

# Start Next.js (Standalone mode)
# Standalone build moves entrypoint specific to the app location
CMD ["node", "apps/frontend/server.js"]
