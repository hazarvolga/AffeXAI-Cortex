import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, FindOptionsWhere, Like, In } from 'typeorm';
import { CompanyKnowledgeSource } from '../entities/company-knowledge-source.entity';
import { CreateKnowledgeSourceDto } from '../dto/create-knowledge-source.dto';
import { UpdateKnowledgeSourceDto } from '../dto/update-knowledge-source.dto';
import { QueryKnowledgeSourceDto } from '../dto/query-knowledge-source.dto';
import { SearchKnowledgeSourceDto } from '../dto/search-knowledge-source.dto';
import { KnowledgeSourceType } from '../entities/enums/knowledge-source-type.enum';
import { KnowledgeSourceStatus } from '../entities/enums/knowledge-source-status.enum';
import { FileProcessingService } from './file-processing.service';
import { UrlProcessingService } from './url-processing.service';
import { S3Service } from '../../media/s3.service';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

export interface KnowledgeSourceSearchResult {
  source: CompanyKnowledgeSource;
  relevanceScore: number;
}

@Injectable()
export class KnowledgeSourcesService {
  private readonly logger = new Logger(KnowledgeSourcesService.name);

  constructor(
    @InjectRepository(CompanyKnowledgeSource)
    private readonly knowledgeSourceRepository: Repository<CompanyKnowledgeSource>,
    private readonly fileProcessingService: FileProcessingService,
    private readonly urlProcessingService: UrlProcessingService,
    private readonly s3Service: S3Service,
  ) { }

  /**
   * Create a new knowledge source
   */
  async create(createDto: CreateKnowledgeSourceDto): Promise<CompanyKnowledgeSource> {
    this.logger.log(`Creating knowledge source: ${createDto.title}`);

    // Validate source type specific fields
    this.validateSourceTypeFields(createDto);

    const knowledgeSource = this.knowledgeSourceRepository.create({
      ...createDto,
      status: KnowledgeSourceStatus.PENDING,
      extractedContent: createDto.extractedContent || '',
    });

    const savedSource = await this.knowledgeSourceRepository.save(knowledgeSource);

    // Trigger async processing (don't await)
    this.processKnowledgeSource(savedSource.id).catch(err =>
      this.logger.error(`Failed to trigger processing for source ${savedSource.id}`, err.stack)
    );

    return savedSource;
  }

  /**
   * Process knowledge source (extract content, generate metadata)
   */
  async processKnowledgeSource(id: string): Promise<void> {
    this.logger.log(`Starting processing for source: ${id}`);
    const source = await this.findById(id);

    try {
      source.status = KnowledgeSourceStatus.PROCESSING;
      await this.knowledgeSourceRepository.save(source);

      let extractedText = '';
      let metadata: any = {};
      let title = source.title;

      switch (source.sourceType) {
        case KnowledgeSourceType.DOCUMENT:
          if (source.filePath) {
            let processPath = source.filePath;
            let tempPath = null;

            // Check if file is on S3 (URL)
            if (source.filePath.startsWith('http')) {
              this.logger.log(`Processing S3 file: ${source.filePath}`);
              try {
                // Extract Key from URL
                // URL format: endpoint/bucket/key (if path style)
                // We assume path style as configured in S3Service
                const url = new URL(source.filePath);
                const pathParts = url.pathname.split('/');
                // pathParts[0] is empty, [1] is bucket, [2+] is key
                if (pathParts.length < 3) {
                  throw new Error(`Invalid S3 URL format: ${source.filePath}`);
                }
                const key = pathParts.slice(2).join('/');

                // Create temp file
                const ext = path.extname(new URL(source.filePath).pathname);
                tempPath = path.join(os.tmpdir(), `${source.id}-${Date.now()}${ext}`);

                await this.s3Service.downloadFile(key, source.tenantId, tempPath);
                processPath = tempPath;
              } catch (err) {
                this.logger.error(`Failed to download from S3: ${err.message}`);
                throw err;
              }
            }

            try {
              const result = await this.fileProcessingService.processDocument(processPath, source.fileType);
              extractedText = result.text;
              metadata = result.metadata;
            } finally {
              // Cleanup temp file
              if (tempPath) {
                await fs.unlink(tempPath).catch(err =>
                  this.logger.warn(`Failed to cleanup temp file ${tempPath}: ${err.message}`)
                );
              }
            }
          }
          break;

        case KnowledgeSourceType.URL:
          if (source.url) {
            const result = await this.urlProcessingService.processUrl(source.url);
            extractedText = result.text;
            metadata = result.metadata;
            if (!title || title === 'New Knowledge Source') {
              title = result.title;
            }
          }
          break;

        case KnowledgeSourceType.TEXT:
          extractedText = source.extractedContent;
          metadata = {
            wordCount: extractedText.split(/\s+/).length,
            characterCount: extractedText.length,
            processedAt: new Date(),
          };
          break;
      }

      // Update source
      source.extractedContent = extractedText;
      source.metadata = { ...source.metadata, ...metadata };
      source.title = title;
      source.status = KnowledgeSourceStatus.ACTIVE;

      await this.knowledgeSourceRepository.save(source);
      this.logger.log(`Successfully processed source: ${id}`);

    } catch (error) {
      this.logger.error(`Failed to process source ${id}: ${error.message}`, error.stack);
      source.status = KnowledgeSourceStatus.FAILED;
      source.metadata = {
        ...source.metadata,
        error: error.message,
        failedAt: new Date(),
      } as any;
      await this.knowledgeSourceRepository.save(source);
    }
  }

  /**
   * Find knowledge source by ID
   */
  async findById(id: string): Promise<CompanyKnowledgeSource> {
    const source = await this.knowledgeSourceRepository.findOne({
      where: { id },
      relations: ['uploadedBy', 'archivedBy'],
    });

    if (!source) {
      throw new NotFoundException(`Knowledge source with ID ${id} not found`);
    }

    return source;
  }

  /**
   * Find all knowledge sources with filters
   */
  async findAll(queryDto: QueryKnowledgeSourceDto): Promise<{ data: CompanyKnowledgeSource[]; total: number }> {
    const {
      search,
      sourceType,
      status,
      uploadedById,
      tags,
      enableForFaqLearning,
      enableForChat,
      limit = 20,
      offset = 0,
      sortBy = 'createdAt',
      sortOrder = 'DESC',
    } = queryDto;

    const queryBuilder = this.knowledgeSourceRepository.createQueryBuilder('ks');

    // Apply filters
    if (search) {
      queryBuilder.andWhere(
        '(ks.title ILIKE :search OR ks.description ILIKE :search OR array_to_string(ks.tags, \',\') ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    if (sourceType) {
      queryBuilder.andWhere('ks.sourceType = :sourceType', { sourceType });
    }

    if (status) {
      queryBuilder.andWhere('ks.status = :status', { status });
    } else {
      // By default, exclude archived sources
      queryBuilder.andWhere('ks.status != :archived', { archived: KnowledgeSourceStatus.ARCHIVED });
    }

    if (uploadedById) {
      queryBuilder.andWhere('ks.uploadedById = :uploadedById', { uploadedById });
    }

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('ks.tags && :tags', { tags });
    }

    if (enableForFaqLearning !== undefined) {
      queryBuilder.andWhere('ks.enableForFaqLearning = :enableForFaqLearning', { enableForFaqLearning });
    }

    if (enableForChat !== undefined) {
      queryBuilder.andWhere('ks.enableForChat = :enableForChat', { enableForChat });
    }

    // Sorting
    queryBuilder.orderBy(`ks.${sortBy}`, sortOrder);

    // Pagination
    queryBuilder.skip(offset).take(limit);

    const [data, total] = await queryBuilder.getManyAndCount();

    return { data, total };
  }

  /**
   * Full-text search on knowledge sources
   */
  async search(searchDto: SearchKnowledgeSourceDto): Promise<KnowledgeSourceSearchResult[]> {
    const { query, limit = 10, minRelevanceScore = 0.3, tags } = searchDto;

    this.logger.log(`Searching knowledge sources: "${query}"`);

    // PostgreSQL full-text search
    const queryBuilder = this.knowledgeSourceRepository
      .createQueryBuilder('ks')
      .select('ks')
      .addSelect(
        `ts_rank(
          to_tsvector('english', COALESCE(ks.title, '') || ' ' || COALESCE(ks.extractedContent, '') || ' ' || array_to_string(COALESCE(ks.tags, '{}'), ' ')),
          plainto_tsquery('english', :query)
        )`,
        'relevance_score'
      )
      .where(
        `to_tsvector('english', COALESCE(ks.title, '') || ' ' || COALESCE(ks.extractedContent, '') || ' ' || array_to_string(COALESCE(ks.tags, '{}'), ' ')) @@ plainto_tsquery('english', :query)`,
        { query }
      )
      .andWhere('ks.status = :status', { status: KnowledgeSourceStatus.ACTIVE })
      .andWhere('ks.enableForChat = :enableForChat', { enableForChat: true });

    if (tags && tags.length > 0) {
      queryBuilder.andWhere('ks.tags && :tags', { tags });
    }

    queryBuilder
      .orderBy('relevance_score', 'DESC')
      .limit(limit);

    const results = await queryBuilder.getRawAndEntities();

    return results.entities
      .map((entity, index) => ({
        source: entity,
        relevanceScore: parseFloat(results.raw[index].relevance_score),
      }))
      .filter(result => result.relevanceScore >= minRelevanceScore);
  }

  /**
   * Update knowledge source
   */
  async update(id: string, updateDto: UpdateKnowledgeSourceDto): Promise<CompanyKnowledgeSource> {
    const source = await this.findById(id);

    Object.assign(source, updateDto);

    return await this.knowledgeSourceRepository.save(source);
  }

  /**
   * Archive knowledge source (soft delete)
   */
  async archive(id: string, archivedById: string): Promise<CompanyKnowledgeSource> {
    const source = await this.findById(id);

    source.status = KnowledgeSourceStatus.ARCHIVED;
    source.archivedAt = new Date();
    source.archivedById = archivedById;

    return await this.knowledgeSourceRepository.save(source);
  }

  /**
   * Permanently delete knowledge source
   */
  async delete(id: string): Promise<void> {
    const source = await this.findById(id);
    await this.knowledgeSourceRepository.remove(source);
    this.logger.log(`Deleted knowledge source: ${id}`);
  }

  /**
   * Update usage statistics
   */
  async updateUsageStats(
    id: string,
    wasHelpful: boolean,
    relevanceScore?: number
  ): Promise<void> {
    const source = await this.findById(id);

    source.usageCount += 1;

    if (wasHelpful) {
      source.helpfulCount += 1;
    }

    if (relevanceScore !== undefined) {
      // Calculate running average
      const totalScore = source.averageRelevanceScore * (source.usageCount - 1) + relevanceScore;
      source.averageRelevanceScore = totalScore / source.usageCount;
    }

    await this.knowledgeSourceRepository.save(source);
  }

  /**
   * Get statistics for knowledge sources
   */
  async getStatistics(): Promise<{
    total: number;
    byType: Record<KnowledgeSourceType, number>;
    byStatus: Record<KnowledgeSourceStatus, number>;
    avgEffectiveness: number;
  }> {
    const [total, byType, byStatus, effectiveness] = await Promise.all([
      this.knowledgeSourceRepository.count(),
      this.getCountByType(),
      this.getCountByStatus(),
      this.getAverageEffectiveness(),
    ]);

    return {
      total,
      byType,
      byStatus,
      avgEffectiveness: effectiveness,
    };
  }

  /**
   * Validate source type specific fields
   */
  private validateSourceTypeFields(dto: CreateKnowledgeSourceDto): void {
    if (dto.sourceType === KnowledgeSourceType.DOCUMENT) {
      if (!dto.fileName && !dto.filePath) {
        throw new BadRequestException('Document sources require fileName or filePath');
      }
    }

    if (dto.sourceType === KnowledgeSourceType.URL) {
      if (!dto.url) {
        throw new BadRequestException('URL sources require url field');
      }
    }

    if (dto.sourceType === KnowledgeSourceType.TEXT) {
      if (!dto.extractedContent) {
        throw new BadRequestException('Text sources require extractedContent field');
      }
    }
  }

  /**
   * Get count by type
   */
  private async getCountByType(): Promise<Record<KnowledgeSourceType, number>> {
    const results = await this.knowledgeSourceRepository
      .createQueryBuilder('ks')
      .select('ks.sourceType', 'type')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ks.sourceType')
      .getRawMany();

    const counts: Record<string, number> = {};
    results.forEach(r => {
      counts[r.type] = parseInt(r.count, 10);
    });

    return counts as Record<KnowledgeSourceType, number>;
  }

  /**
   * Get count by status
   */
  private async getCountByStatus(): Promise<Record<KnowledgeSourceStatus, number>> {
    const results = await this.knowledgeSourceRepository
      .createQueryBuilder('ks')
      .select('ks.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ks.status')
      .getRawMany();

    const counts: Record<string, number> = {};
    results.forEach(r => {
      counts[r.status] = parseInt(r.count, 10);
    });

    return counts as Record<KnowledgeSourceStatus, number>;
  }

  /**
   * Get average effectiveness score
   */
  private async getAverageEffectiveness(): Promise<number> {
    const result = await this.knowledgeSourceRepository
      .createQueryBuilder('ks')
      .select('AVG(ks.usageCount * ks.averageRelevanceScore)', 'avg')
      .where('ks.status = :status', { status: KnowledgeSourceStatus.ACTIVE })
      .getRawOne();

    return parseFloat(result?.avg || '0');
  }
}
