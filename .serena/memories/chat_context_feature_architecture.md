# Chat Context Feature Architecture

## Feature Overview
**Name**: Chat Context (Bağlam Kaynakları / Knowledge Sources)
**Purpose**: Document and URL-based knowledge source management for AI Support Chatbot
**Location**: Sidebar - Below Knowledge Base section
**User Role**: Customer role access

## Current System Analysis

### Existing Components
1. **FAQ Learning System** (Self-learning from tickets/chats)
   - Location: `apps/backend/src/modules/faq-learning/`
   - Automatically learns from support interactions
   - Generates FAQs with confidence scores
   - Review queue for approval workflow

2. **Knowledge Base** (Manual articles)
   - Location: `apps/backend/src/modules/tickets/entities/knowledge-base-article.entity.ts`
   - Admin-created help articles
   - Categories, search, ratings
   - Public customer access

3. **Chat System** (AI-powered support bot)
   - Location: `apps/backend/src/modules/chat/`
   - Real-time WebSocket communication
   - Document upload capability (already exists)
   - URL processing capability (already exists)
   - Context engine integration

## Proposed Chat Context Architecture

### 1. Entity Structure

#### ChatContextSource Entity
```typescript
- id: UUID
- organizationId: UUID
- name: string
- description?: string
- sourceType: 'document' | 'url' | 'excel' | 'powerpoint'
- contentHash: string
- metadata: JSON {
    fileName?: string,
    fileSize?: number,
    mimeType?: string,
    url?: string,
    pageCount?: number,
    lastCrawled?: Date
  }
- content: text (extracted/processed content)
- isActive: boolean
- processingStatus: 'pending' | 'processing' | 'completed' | 'failed'
- errorMessage?: string
- embeddingStatus: 'pending' | 'processing' | 'completed' | 'failed'
- lastSyncedAt?: Date
- createdBy: UUID
- createdAt: Date
- updatedAt: Date
```

### 2. Backend Architecture

#### New Module: `chat-context` or extend `chat` module

**Services**:
1. **ChatContextSourceService**
   - CRUD operations for sources
   - Batch operations (import multiple docs)
   - Activation/deactivation
   - Search and filtering

2. **DocumentProcessingService** (extend existing)
   - PDF processing (pdf-parse)
   - Word processing (mammoth)
   - Excel processing (xlsx)
   - PowerPoint processing (structured extraction)
   - Text/Markdown processing

3. **UrlCrawlerService** (extend existing)
   - URL validation (robots.txt check)
   - Web scraping (cheerio)
   - Content extraction
   - Refresh scheduling
   - Sitemap support

4. **ContentIndexingService**
   - Vector embeddings generation
   - Semantic search preparation
   - Integration with AI providers (OpenAI/Anthropic/Gemini)

5. **ChatContextIntegrationService**
   - Integration with ChatAiService
   - Context retrieval for AI responses
   - Relevance ranking
   - Source attribution in responses

**Controllers**:
1. **ChatContextSourceController**
   - GET /api/chat-context/sources (list all sources)
   - POST /api/chat-context/sources (create new source)
   - PUT /api/chat-context/sources/:id (update source)
   - DELETE /api/chat-context/sources/:id (delete source)
   - POST /api/chat-context/sources/:id/activate (activate/deactivate)
   - POST /api/chat-context/sources/:id/refresh (re-process)
   - GET /api/chat-context/sources/:id/content (view processed content)
   - POST /api/chat-context/sources/bulk-upload (bulk import)

2. **ChatContextStatsController**
   - GET /api/chat-context/stats (usage statistics)
   - GET /api/chat-context/sources/:id/usage (source-specific stats)

### 3. Frontend Architecture

#### Pages
1. **Admin Page**: `/admin/support/chat-context` or `/admin/support/knowledge-sources`
   - Full CRUD interface
   - Bulk upload
   - Processing status monitoring
   - Usage analytics

2. **Customer View** (read-only): Integrated into chatbox
   - See active sources in sidebar
   - Filter by source type
   - No direct management access

#### Components
1. **ChatContextManager** (Admin)
   - Source list with DataTable
   - Upload dialog (file + URL)
   - Processing status indicators
   - Activation toggles
   - Bulk actions

2. **ChatContextSidebar** (Customer)
   - Active sources list
   - Source type badges
   - Last updated timestamps
   - Simple filtering

3. **SourceUploadDialog**
   - File upload (drag & drop)
   - URL input with validation
   - Batch upload support
   - Name/description fields

4. **SourceDetailView**
   - Metadata display
   - Content preview
   - Processing logs
   - Usage statistics

### 4. Integration Points

#### With FAQ Learning
- FAQ Learning can suggest creating Chat Context sources from frequently accessed knowledge
- Chat Context sources can contribute to FAQ generation confidence

#### With Knowledge Base
- Bidirectional: Knowledge Base articles can be auto-synced as Chat Context sources
- Option to "Export to Chat Context" from KB articles

#### With Chat AI Service
```typescript
// Modify ChatAiService to include context sources
async generateResponse(session, message) {
  // 1. Get relevant FAQ entries (existing)
  const faqs = await faqSearch(message);
  
  // 2. Get relevant KB articles (existing)
  const kbArticles = await kbSearch(message);
  
  // 3. NEW: Get relevant Chat Context sources
  const contextSources = await chatContextSearch(message);
  
  // 4. Build enhanced context for AI
  const enhancedContext = {
    faqs,
    kbArticles,
    contextSources, // NEW
    conversationHistory
  };
  
  // 5. Generate AI response with source attribution
  const response = await aiProvider.generate(enhancedContext);
  
  return {
    answer: response.text,
    sources: response.sources // Include which sources were used
  };
}
```

### 5. Technical Considerations

**File Storage**:
- Store original files in S3 (already configured: `@aws-sdk/client-s3`)
- Store processed text in database for fast access
- Implement content hash to avoid duplicates

**Vector Embeddings**:
- Option 1: Use OpenAI embeddings API
- Option 2: Use Anthropic Claude embeddings
- Option 3: Use Google Gemini embeddings
- Store embeddings in PostgreSQL with pgvector extension

**Processing Queue**:
- Use BullMQ (already in project) for async processing
- Job types: document-processing, url-crawling, embedding-generation
- Retry logic for failed processing

**Security**:
- Validate URLs (no internal networks, check robots.txt)
- Scan uploaded files for malware
- Rate limiting on URL crawling
- Content moderation for uploaded docs

**Performance**:
- Implement caching for processed content
- Use Redis for embedding cache
- Batch embedding generation
- Lazy loading for large documents

### 6. User Flow

#### Admin Flow
1. Navigate to Knowledge Sources page
2. Click "Add Source" or "Bulk Upload"
3. Choose type: Document or URL
4. Upload file(s) or enter URL(s)
5. Provide name, description (optional)
6. Submit for processing
7. Monitor processing status (real-time updates)
8. Activate/deactivate sources as needed
9. View usage analytics

#### Customer Flow (Chatbox)
1. Open support chatbox
2. See "Knowledge Sources" section in sidebar
3. View list of active sources (read-only)
4. Ask questions in chat
5. AI responds using all available sources (KB + FAQ + Chat Context)
6. See source attribution in responses (which documents/URLs were used)

### 7. Database Schema

```sql
CREATE TABLE chat_context_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('document', 'url', 'excel', 'powerpoint')),
  content_hash VARCHAR(64) NOT NULL,
  metadata JSONB,
  content TEXT,
  is_active BOOLEAN DEFAULT true,
  processing_status VARCHAR(20) DEFAULT 'pending',
  error_message TEXT,
  embedding_status VARCHAR(20) DEFAULT 'pending',
  last_synced_at TIMESTAMP,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_context_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES chat_context_sources(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  chunk_text TEXT NOT NULL,
  embedding VECTOR(1536), -- For OpenAI ada-002
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE chat_context_usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES chat_context_sources(id) ON DELETE CASCADE,
  chat_session_id UUID REFERENCES chat_sessions(id),
  relevance_score FLOAT,
  used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_chat_context_sources_org ON chat_context_sources(organization_id);
CREATE INDEX idx_chat_context_sources_active ON chat_context_sources(is_active);
CREATE INDEX idx_chat_context_embeddings_source ON chat_context_embeddings(source_id);
```

### 8. Migration Strategy

**Phase 1**: Backend Foundation
- Create entities and migrations
- Implement DocumentProcessingService
- Implement UrlCrawlerService
- Add to ChatModule or create new ChatContextModule

**Phase 2**: Core Services
- ContentIndexingService
- ChatContextSourceService
- Integration with existing ChatAiService

**Phase 3**: Admin Interface
- Admin CRUD pages
- Upload dialogs
- Processing status UI

**Phase 4**: Customer Integration
- Sidebar component for chatbox
- Source attribution in AI responses
- FAQ Learning integration

**Phase 5**: Advanced Features
- Bulk operations
- Scheduled URL refresh
- Usage analytics
- Export/import functionality

### 9. Existing Code to Leverage

**Document Processing** (Already exists):
- `apps/backend/src/modules/chat/services/document-processor.service.ts`
- Supports PDF, Word, Excel
- File validation

**URL Processing** (Already exists):
- `apps/backend/src/modules/chat/services/url-processor.service.ts`
- Web scraping with cheerio
- URL validation

**Chat Context Engine** (Partial):
- `apps/backend/src/modules/chat/services/chat-context-engine.service.ts`
- Needs extension for new source types

### 10. API Endpoints Summary

```
Admin Endpoints:
POST   /api/admin/chat-context/sources              - Create source
GET    /api/admin/chat-context/sources              - List sources
GET    /api/admin/chat-context/sources/:id          - Get source details
PUT    /api/admin/chat-context/sources/:id          - Update source
DELETE /api/admin/chat-context/sources/:id          - Delete source
POST   /api/admin/chat-context/sources/:id/toggle   - Activate/deactivate
POST   /api/admin/chat-context/sources/:id/refresh  - Reprocess source
POST   /api/admin/chat-context/sources/bulk-upload  - Bulk import
GET    /api/admin/chat-context/stats                - Global statistics
GET    /api/admin/chat-context/sources/:id/usage    - Source usage stats

Customer Endpoints (Read-only):
GET    /api/chat-context/active-sources             - List active sources
GET    /api/chat-context/sources/:id/preview        - Preview source content
```

### 11. Configuration Requirements

**Environment Variables**:
```env
# Existing
OPENAI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx
GOOGLE_AI_API_KEY=xxx
AWS_S3_BUCKET=xxx

# New (optional)
MAX_DOCUMENT_SIZE_MB=50
MAX_URL_DEPTH=3
URL_CRAWL_DELAY_MS=1000
EMBEDDING_MODEL=text-embedding-ada-002
VECTOR_SEARCH_LIMIT=10
```

**Feature Flags** (in settings):
```json
{
  "chat_context_enabled": true,
  "max_sources_per_org": 100,
  "auto_refresh_urls": true,
  "url_refresh_interval_hours": 24,
  "enable_source_attribution": true
}
```
