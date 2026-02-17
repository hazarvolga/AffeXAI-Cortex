# AffexAI Project - Core Configuration & Architecture

**Last Updated**: 2024-11-29

## Critical Port Configuration

### Backend Services
- **Backend API**: Port **9006** (NOT 9005!)
  - Base URL: `http://localhost:9006`
  - API Endpoints: `http://localhost:9006/api`
  - Environment: `apps/backend/.env` → `PORT=9006`

### Frontend Services
- **Frontend**: Port **9003**
  - Base URL: `http://localhost:9003`
  - Environment: `apps/backend/.env` → `FRONTEND_URL=http://localhost:9003`

### Database & Infrastructure
- **PostgreSQL**: Port **5434** (Docker)
  - Connection: `postgresql://postgres:postgres@localhost:5434/affexai_dev`
  - Container: `affexai-postgres`
  
- **Redis**: Port **6380** (Docker)
  - Connection: `localhost:6380`
  
- **MinIO (S3)**: Port **9007**
  - Endpoint: `http://localhost:9007`
  - Credentials: `minioadmin/minioadmin`
  - Bucket: `affexai-files`

## Project Structure

### Monorepo Layout
```
Affexai/
├── apps/
│   ├── backend/          # NestJS backend (Port 9006)
│   └── frontend/         # Next.js frontend (Port 9003)
├── packages/
│   └── shared-types/     # Shared TypeScript types
├── docker/               # Docker compose for local dev
└── scripts/              # Utility scripts
```

### Backend Architecture
- **Framework**: NestJS + TypeScript
- **Database**: PostgreSQL 16 + TypeORM
- **Cache**: Redis
- **Storage**: MinIO (S3-compatible)
- **Queue**: BullMQ
- **WebSocket**: Socket.io

### Key Backend Modules
1. **CMS Module** (`apps/backend/src/modules/cms/`)
   - Pages, Components, Media management
   - Block-based content system
   - Reusable components

2. **Media Module** (`apps/backend/src/modules/media/`)
   - File upload endpoint: `POST /api/media/upload`
   - Supports: images (jpg, png, gif, svg, webp)
   - Storage: Local uploads directory + database metadata
   - Categories: GENERAL, WORDPRESS, MIGRATION, etc.

3. **Chat Module** (`apps/backend/src/modules/chat/`)
   - AI-powered support chatbot
   - Document & URL processing
   - Context engine

4. **FAQ Learning** (`apps/backend/src/modules/faq-learning/`)
   - Self-learning from tickets/chats
   - Confidence scoring

5. **Knowledge Base** (`apps/backend/src/modules/tickets/`)
   - Manual help articles
   - Categories & search

## WordPress to CMS Migration System

### Migration Architecture
**Location**: `apps/backend/scripts/migration/`

**Key Components**:
1. **MigrationOrchestrator** - Main coordinator
2. **ContentParser** - HTML parsing
3. **IndustrySolutionParser** - Specialized parser
4. **MediaManager** - Image upload to CMS
5. **URLTransformer** - URL rewriting
6. **TemplateMapper** - Page template mapping
7. **PageCreator** - CMS page creation
8. **Logger** - Structured logging
9. **ErrorHandler** - Error management
10. **ReportGenerator** - Migration reports

### Migration CLI
**Command**: `tsx apps/backend/scripts/migration/migrate.ts`

**Options**:
- `--dry-run` - Test without changes
- `--verbose` - Detailed logging
- `--skip-media` - Skip media upload
- `--pages "Page1,Page2"` - Migrate specific pages
- `--source <dir>` - Source directory

**API URL**: Uses `http://localhost:9006/api` (NOT 9005!)

### Media Upload Process
1. Scans `extracted_pages/uploads/` directory
2. Uploads each image to `POST /api/media/upload?module=MIGRATION&category=WORDPRESS`
3. Creates mapping: old WordPress URL → new CMS URL
4. Transforms content URLs using mapping

**Requirements**:
- Backend server MUST be running on port 9006
- Database MUST be accessible
- Uploads directory MUST exist and be writable

## Database Schema

### CMS Components Table
```sql
cms_components (
  id UUID PRIMARY KEY,
  type VARCHAR (block/section/page),
  block_type VARCHAR,      -- NEW: extracted from props
  block_category VARCHAR,  -- NEW: extracted from props
  block_id VARCHAR,        -- NEW: extracted from props
  reusable_component_id UUID,  -- NEW: for reusable components
  props JSONB,
  content TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

**Indexes**:
- `idx_cms_components_block_type`
- `idx_cms_components_block_category`
- `idx_cms_components_block_id`
- `idx_cms_components_reusable_component_id`
- `idx_cms_components_type_block_type` (composite)

### Media Table
```sql
media (
  id UUID PRIMARY KEY,
  filename VARCHAR,
  original_name VARCHAR,
  mime_type VARCHAR,
  size INTEGER,
  url VARCHAR,
  type VARCHAR (IMAGE/VIDEO/DOCUMENT),
  storage_type VARCHAR (LOCAL/S3),
  module VARCHAR (GENERAL/MIGRATION/WORDPRESS),
  category VARCHAR (OTHER/PRODUCT/SOLUTION),
  tags TEXT[],
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
)
```

## Environment Variables

### Critical Variables (apps/backend/.env)
```env
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5434/affexai_dev
DB_HOST=localhost
DB_PORT=5434
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_NAME=affexai_dev

# Application
PORT=9006                    # ⚠️ CRITICAL: Backend port
APP_PROTOCOL=http
APP_HOST=localhost

# Frontend
FRONTEND_URL=http://localhost:9003
CORS_ORIGINS=http://localhost:9003

# Redis
REDIS_HOST=localhost
REDIS_PORT=6380

# MinIO/S3
S3_ENDPOINT=http://localhost:9007
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET_NAME=affexai-files

# JWT
JWT_SECRET=affexai-secret-key-change-in-production
JWT_EXPIRES_IN=3600
```

## Common Issues & Solutions

### Issue: Media Upload 500 Errors
**Cause**: Backend not running or wrong port
**Solution**: 
1. Check backend is running: `curl http://localhost:9006/health`
2. Start backend: `cd apps/backend && npm run start:dev`
3. Verify port in migration script is 9006 (not 9005)

### Issue: Database Connection Failed
**Cause**: PostgreSQL container not running
**Solution**:
1. Check container: `docker ps | grep postgres`
2. Start container: `docker-compose -f docker/docker-compose.yml up -d postgres`

### Issue: Migration Can't Find Files
**Cause**: Wrong source directory path
**Solution**: Use `--source` flag with correct path to `extracted_pages/`

## Development Workflow

### Starting Development Environment
```bash
# 1. Start infrastructure (PostgreSQL, Redis, MinIO)
cd docker
docker-compose up -d

# 2. Start backend (Port 9006)
cd apps/backend
npm run start:dev

# 3. Start frontend (Port 9003)
cd apps/frontend
npm run dev
```

### Running Migrations
```bash
# Database migrations
cd apps/backend
npm run migration:run

# WordPress to CMS migration
cd apps/backend
tsx scripts/migration/migrate.ts --dry-run --verbose
```

### Testing
```bash
# Backend tests
cd apps/backend
npm test

# Migration tests
cd apps/backend
tsx scripts/migration/run-all-tests.ts
```

## Important Notes

1. **ALWAYS use port 9006 for backend API** - This is configured in .env and should never be assumed to be 3000 or 9005
2. **Backend must be running** before attempting media uploads or any API operations
3. **Docker containers must be running** for database, Redis, and MinIO
4. **Migration is idempotent** - Can be run multiple times safely with proper error handling
5. **Use --dry-run first** - Always test migrations before running for real
6. **Check logs** - Migration logs are in `apps/backend/logs/migration.log`

## Spec-Driven Development

### Active Specs
Located in `.kiro/specs/`:
- `wordpress-cms-migration/` - Current migration system
- `ai-support-chatbox/` - AI chatbot
- `dynamic-kb-categories/` - Knowledge base
- `faq-learning-settings/` - FAQ learning
- `knowledge-sources/` - Chat context sources
- `self-learning-faq/` - Self-learning FAQ

### Spec Workflow
1. Requirements → Design → Tasks
2. Each phase requires explicit user approval
3. Tasks are executed one at a time
4. Property-based testing for correctness

## Technology Stack Summary

**Backend**:
- NestJS 10.x
- TypeScript 5.x
- TypeORM
- PostgreSQL 16
- Redis
- BullMQ
- Socket.io
- Multer (file uploads)
- Axios (HTTP client)

**Frontend**:
- Next.js 14.x
- React 18.x
- TypeScript
- TailwindCSS
- Shadcn/ui components

**DevOps**:
- Docker & Docker Compose
- Coolify (deployment)
- GitHub Actions (CI/CD)

---

**Remember**: This is a Turkish company (AffexAI) building a customer support platform with AI capabilities. The project uses modern TypeScript stack with emphasis on type safety, modularity, and spec-driven development.
