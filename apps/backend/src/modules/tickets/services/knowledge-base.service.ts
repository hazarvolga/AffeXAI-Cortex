import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { KnowledgeBaseArticle } from '../entities/knowledge-base-article.entity';
import { slugify } from '../../../common/utils/slugify.util';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * Knowledge Base Service
 * Manages self-service help articles
 */

export interface CreateArticleDto {
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  tags?: string[];
  isFeatured?: boolean;
  status?: 'draft' | 'published' | 'archived';
}

export interface UpdateArticleDto {
  title?: string;
  content?: string;
  summary?: string;
  categoryId?: string;
  tags?: string[];
  isFeatured?: boolean;
  status?: 'draft' | 'published' | 'archived';
}

export interface ArticleSearchFilters {
  query?: string;
  categoryId?: string;
  tags?: string[];
  status?: string;
  isFeatured?: boolean;
  limit?: number;
  offset?: number;
}

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(
    @InjectRepository(KnowledgeBaseArticle)
    private readonly articleRepository: Repository<KnowledgeBaseArticle>,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getActiveTenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Create a new article
   */
  async createArticle(
    authorId: string,
    dto: CreateArticleDto,
  ): Promise<KnowledgeBaseArticle> {
    const tenantId = this.getActiveTenantId();

    const slug = this.generateSlug(dto.title);

    const article = this.articleRepository.create({
      ...dto,
      authorId,
      slug,
      tenantId,
      isPublished: dto.status === 'published',
      publishedAt: dto.status === 'published' ? new Date() : null,
    } as any) as unknown as KnowledgeBaseArticle;

    await this.articleRepository.save(article);
    this.logger.log(`Created article: ${article.id} - ${article.title}`);

    return article;
  }

  /**
   * Update an article
   */
  async updateArticle(
    id: string,
    dto: UpdateArticleDto,
  ): Promise<KnowledgeBaseArticle> {
    const tenantId = this.getActiveTenantId();
    const article = await this.articleRepository.findOne({
      where: { id, tenantId } as any
    });

    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    // Update slug if title changed
    if (dto.title && dto.title !== article.title) {
      article.slug = this.generateSlug(dto.title);
    }

    // Update published status
    if (dto.status === 'published' && !article.isPublished) {
      article.isPublished = true;
      article.publishedAt = new Date();
    } else if (dto.status !== 'published') {
      article.isPublished = false;
    }

    Object.assign(article, dto);
    await this.articleRepository.save(article);

    this.logger.log(`Updated article: ${article.id}`);
    return article;
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string): Promise<void> {
    const result = await this.articleRepository.delete(id);

    if (result.affected === 0) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    this.logger.log(`Deleted article: ${id}`);
  }

  /**
   * Get article by ID
   */
  async getArticle(id: string): Promise<KnowledgeBaseArticle> {
    const article = await this.articleRepository.findOne({
      where: { id },
      relations: ['author', 'category'],
    });

    if (!article) {
      throw new NotFoundException(`Article ${id} not found`);
    }

    return article;
  }

  /**
   * Get article by slug
   */
  async getArticleBySlug(slug: string): Promise<KnowledgeBaseArticle> {
    const tenantId = this.getActiveTenantId();
    const article = await this.articleRepository.findOne({
      where: { slug, isPublished: true, tenantId } as any,
      relations: ['author', 'category'],
    });

    if (!article) {
      throw new NotFoundException(`Article not found`);
    }

    // Increment view count
    article.viewCount++;
    await this.articleRepository.save(article);

    return article;
  }

  /**
   * Search articles
   */
  async searchArticles(
    filters: ArticleSearchFilters,
  ): Promise<{ articles: KnowledgeBaseArticle[]; total: number }> {
    const tenantId = this.getActiveTenantId();
    const query = this.articleRepository.createQueryBuilder('article')
      .where('article.tenantId = :tenantId', { tenantId })
      .leftJoinAndSelect('article.author', 'author')
      .leftJoinAndSelect('article.category', 'category');

    // Search query
    if (filters.query) {
      query.andWhere(
        '(article.title ILIKE :query OR article.content ILIKE :query OR article.summary ILIKE :query)',
        { query: `%${filters.query}%` },
      );
    }

    // Category filter
    if (filters.categoryId) {
      query.andWhere('article.categoryId = :categoryId', {
        categoryId: filters.categoryId,
      });
    }

    // Tags filter
    if (filters.tags && filters.tags.length > 0) {
      query.andWhere('article.tags && :tags', { tags: filters.tags });
    }

    // Status filter
    if (filters.status) {
      query.andWhere('article.status = :status', { status: filters.status });
    } else {
      // Default: only show published articles for public search
      query.andWhere('article.isPublished = :isPublished', {
        isPublished: true,
      });
    }

    // Featured filter
    if (filters.isFeatured !== undefined) {
      query.andWhere('article.isFeatured = :isFeatured', {
        isFeatured: filters.isFeatured,
      });
    }

    // Order by relevance and popularity
    query.orderBy('article.searchScore', 'DESC')
      .addOrderBy('article.viewCount', 'DESC')
      .addOrderBy('article.publishedAt', 'DESC');

    // Pagination
    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    query.take(limit).skip(offset);

    const [articles, total] = await query.getManyAndCount();

    return { articles, total };
  }

  /**
   * Get featured articles
   */
  async getFeaturedArticles(limit: number = 5): Promise<KnowledgeBaseArticle[]> {
    const tenantId = this.getActiveTenantId();
    return await this.articleRepository.find({
      where: { isFeatured: true, isPublished: true, tenantId } as any,
      relations: ['author', 'category'],
      order: { viewCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get popular articles
   */
  async getPopularArticles(limit: number = 10): Promise<KnowledgeBaseArticle[]> {
    return await this.articleRepository.find({
      where: { isPublished: true },
      relations: ['author', 'category'],
      order: { viewCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Get related articles
   */
  async getRelatedArticles(
    articleId: string,
    limit: number = 5,
  ): Promise<KnowledgeBaseArticle[]> {
    const article = await this.getArticle(articleId);

    if (!article) {
      return [];
    }

    // Find articles with similar tags or same category
    const query = this.articleRepository
      .createQueryBuilder('article')
      .where('article.id != :articleId', { articleId })
      .andWhere('article.isPublished = :isPublished', { isPublished: true });

    if (article.tags && article.tags.length > 0) {
      query.andWhere('article.tags && :tags', { tags: article.tags });
    } else if (article.categoryId) {
      query.andWhere('article.categoryId = :categoryId', {
        categoryId: article.categoryId,
      });
    }

    query
      .orderBy('article.viewCount', 'DESC')
      .take(limit);

    return await query.getMany();
  }

  /**
   * Mark article as helpful
   */
  async markHelpful(id: string, isHelpful: boolean): Promise<KnowledgeBaseArticle> {
    const article = await this.getArticle(id);

    if (isHelpful) {
      article.helpfulCount++;
    } else {
      article.notHelpfulCount++;
    }

    // Update search score based on helpfulness
    const totalFeedback = article.helpfulCount + article.notHelpfulCount;
    if (totalFeedback > 0) {
      article.searchScore = Math.round(
        (article.helpfulCount / totalFeedback) * 100,
      );
    }

    await this.articleRepository.save(article);
    return article;
  }

  /**
   * Get article statistics
   */
  async getStatistics(): Promise<{
    total: number;
    published: number;
    draft: number;
    archived: number;
    totalViews: number;
    avgHelpfulness: number;
  }> {
    const tenantId = this.getActiveTenantId();
    const [total, published, draft, archived] = await Promise.all([
      this.articleRepository.count({ where: { tenantId } as any }),
      this.articleRepository.count({ where: { status: 'published', tenantId } as any }),
      this.articleRepository.count({ where: { status: 'draft', tenantId } as any }),
      this.articleRepository.count({ where: { status: 'archived', tenantId } as any }),
    ]);

    const articles = await this.articleRepository.find({ where: { tenantId } as any });
    const totalViews = articles.reduce((sum, a) => sum + a.viewCount, 0);
    const totalHelpful = articles.reduce((sum, a) => sum + a.helpfulCount, 0);
    const totalFeedback = articles.reduce(
      (sum, a) => sum + a.helpfulCount + a.notHelpfulCount,
      0,
    );

    const avgHelpfulness =
      totalFeedback > 0 ? Math.round((totalHelpful / totalFeedback) * 100) : 0;

    return {
      total,
      published,
      draft,
      archived,
      totalViews,
      avgHelpfulness,
    };
  }

  /**
   * Generate URL-friendly slug from title
   * Uses centralized slugify utility with Turkish character support
   */
  private generateSlug(title: string): string {
    const slug = slugify(title);
    return `${slug || 'untitled'}-${Date.now()}`;
  }
}
