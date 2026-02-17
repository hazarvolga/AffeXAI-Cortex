import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LearnedFaqEntry, FaqEntryStatus } from '../entities/learned-faq-entry.entity';
import { KnowledgeBaseArticle } from '../../tickets/entities/knowledge-base-article.entity';
import { KnowledgeBaseCategory } from '../../tickets/entities/knowledge-base-category.entity';
import { FaqLearningConfig } from '../entities/faq-learning-config.entity';

export interface FaqToArticleMapping {
  faqId: string;
  articleId: string;
  mappingType: 'direct' | 'merged' | 'referenced';
  createdAt: Date;
}

export interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasoning: string[];
}

export interface ArticleConversionResult {
  success: boolean;
  articleId?: string;
  article?: KnowledgeBaseArticle;
  mapping?: FaqToArticleMapping;
  error?: string;
  warnings?: string[];
}

export interface IntegrationStats {
  totalFaqs: number;
  convertedToArticles: number;
  pendingConversion: number;
  categorySuggestions: number;
  lastSync: Date;
}

@Injectable()
export class KnowledgeBaseIntegratorService {
  private readonly logger = new Logger(KnowledgeBaseIntegratorService.name);

  constructor(
    @InjectRepository(LearnedFaqEntry)
    private faqRepository: Repository<LearnedFaqEntry>,
    @InjectRepository(KnowledgeBaseArticle)
    private articleRepository: Repository<KnowledgeBaseArticle>,
    @InjectRepository(KnowledgeBaseCategory)
    private categoryRepository: Repository<KnowledgeBaseCategory>,
    @InjectRepository(FaqLearningConfig)
    private configRepository: Repository<FaqLearningConfig>,
  ) {}

  async convertFaqToArticle(
    faqId: string,
    options?: {
      categoryId?: string;
      authorId?: string;
      publishImmediately?: boolean;
      customTitle?: string;
      customContent?: string;
    }
  ): Promise<ArticleConversionResult> {
    
    try {
      this.logger.log(`Converting FAQ ${faqId} to Knowledge Base article`);

      const faq = await this.faqRepository.findOne({
        where: { id: faqId, status: FaqEntryStatus.PUBLISHED }
      });

      if (!faq) {
        return {
          success: false,
          error: 'FAQ not found or not published'
        };
      }

      // Check if already converted
      const existingMapping = await this.findExistingMapping(faqId);
      if (existingMapping) {
        return {
          success: false,
          error: 'FAQ already converted to article',
          mapping: existingMapping
        };
      }

      // Determine category
      let categoryId = options?.categoryId;
      if (!categoryId && faq.category) {
        const suggestedCategory = await this.suggestCategory(faq.question, faq.answer, faq.category);
        categoryId = suggestedCategory?.categoryId;
      }

      // Create article content
      const articleContent = this.buildArticleContent(faq, options?.customContent);
      const articleTitle = options?.customTitle || this.generateArticleTitle(faq.question);

      // Create the article
      const article = this.articleRepository.create({
        title: articleTitle,
        content: articleContent,
        summary: this.generateSummary(faq.answer),
        slug: this.generateSlug(articleTitle),
        categoryId: categoryId,
        authorId: options?.authorId,
        tags: faq.keywords,
        isPublished: options?.publishImmediately || false,
        status: options?.publishImmediately ? 'published' : 'draft',
        metadata: {
          sourceType: 'faq_learning',
          sourceFaqId: faqId,
          originalConfidence: faq.confidence,
          conversionDate: new Date(),
          faqMetadata: faq.metadata
        }
      });

      const savedArticles = await this.articleRepository.save(article);
      const savedArticle = Array.isArray(savedArticles) ? savedArticles[0] : savedArticles;

      // Create mapping
      const mapping: FaqToArticleMapping = {
        faqId: faqId,
        articleId: savedArticle.id,
        mappingType: 'direct',
        createdAt: new Date()
      };

      // Store mapping in FAQ metadata
      faq.metadata = {
        ...faq.metadata,
        kbIntegration: {
          articleId: savedArticle.id,
          convertedAt: new Date(),
          mappingType: 'direct'
        }
      } as any;
      await this.faqRepository.save(faq);

      this.logger.log(`Successfully converted FAQ ${faqId} to article ${savedArticle.id}`);

      return {
        success: true,
        articleId: savedArticle.id,
        article: savedArticle,
        mapping
      };

    } catch (error) {
      this.logger.error(`Failed to convert FAQ ${faqId} to article:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  async suggestCategory(question: string, answer: string, currentCategory?: string): Promise<CategorySuggestion | null> {
    try {
      // Get all available categories
      const categories = await this.categoryRepository.find({
        where: { isActive: true }
      });

      if (categories.length === 0) {
        return null;
      }

      // Simple keyword-based matching for now
      // In a real implementation, you might use AI for better categorization
      const text = `${question} ${answer}`.toLowerCase();
      const scores: Array<{ category: KnowledgeBaseCategory; score: number; reasons: string[] }> = [];

      for (const category of categories) {
        const categoryKeywords = [
          category.name.toLowerCase(),
          category.description?.toLowerCase() || '',
          category.slug.toLowerCase()
        ];

        let score = 0;
        const reasons: string[] = [];

        // Check for keyword matches
        for (const keyword of categoryKeywords) {
          if (keyword && text.includes(keyword)) {
            score += 10;
            reasons.push(`Contains keyword: ${keyword}`);
          }
        }

        // Boost score if matches current category
        if (currentCategory && category.name.toLowerCase().includes(currentCategory.toLowerCase())) {
          score += 20;
          reasons.push(`Matches current category: ${currentCategory}`);
        }

        // Check for common patterns
        if (this.checkCategoryPatterns(text, category.name)) {
          score += 15;
          reasons.push(`Matches category patterns`);
        }

        if (score > 0) {
          scores.push({ category, score, reasons });
        }
      }

      // Sort by score and return the best match
      scores.sort((a, b) => b.score - a.score);

      if (scores.length > 0 && scores[0].score >= 10) {
        const best = scores[0];
        return {
          categoryId: best.category.id,
          categoryName: best.category.name,
          confidence: Math.min(100, (best.score / 50) * 100), // Normalize to 0-100
          reasoning: best.reasons
        };
      }

      return null;
    } catch (error) {
      this.logger.error('Failed to suggest category:', error);
      return null;
    }
  }

  async bulkConvertFaqs(
    faqIds: string[],
    options?: {
      authorId?: string;
      publishImmediately?: boolean;
      defaultCategoryId?: string;
    }
  ): Promise<{
    successful: ArticleConversionResult[];
    failed: Array<{ faqId: string; error: string }>;
  }> {
    
    const successful: ArticleConversionResult[] = [];
    const failed: Array<{ faqId: string; error: string }> = [];

    this.logger.log(`Starting bulk conversion of ${faqIds.length} FAQs`);

    for (const faqId of faqIds) {
      try {
        const result = await this.convertFaqToArticle(faqId, {
          ...options,
          categoryId: options?.defaultCategoryId
        });

        if (result.success) {
          successful.push(result);
        } else {
          failed.push({ faqId, error: result.error || 'Unknown error' });
        }
      } catch (error) {
        failed.push({ faqId, error: error.message });
      }
    }

    this.logger.log(`Bulk conversion completed: ${successful.length} successful, ${failed.length} failed`);

    return { successful, failed };
  }

  async syncFaqUpdates(): Promise<{
    updated: number;
    errors: Array<{ faqId: string; error: string }>;
  }> {
    
    try {
      this.logger.log('Starting FAQ-to-Article sync');

      // Find FAQs that have been updated after their article conversion
      const faqs = await this.faqRepository
        .createQueryBuilder('faq')
        .where('faq.metadata->>\'kbIntegration\' IS NOT NULL')
        .andWhere('faq.status = :status', { status: FaqEntryStatus.PUBLISHED })
        .getMany();

      const updated: string[] = [];
      const errors: Array<{ faqId: string; error: string }> = [];

      for (const faq of faqs) {
        try {
          const kbIntegration = (faq.metadata as any)?.kbIntegration;
          if (!kbIntegration?.articleId) continue;

          const article = await this.articleRepository.findOne({
            where: { id: kbIntegration.articleId }
          });

          if (!article) {
            errors.push({ faqId: faq.id, error: 'Associated article not found' });
            continue;
          }

          // Check if FAQ was updated after article
          const faqUpdated = new Date(faq.updatedAt).getTime();
          const articleUpdated = new Date(article.updatedAt).getTime();
          const conversionDate = new Date(kbIntegration.convertedAt).getTime();

          if (faqUpdated > Math.max(articleUpdated, conversionDate)) {
            // Update article with FAQ changes
            article.content = this.buildArticleContent(faq);
            article.tags = faq.keywords;
            article.metadata = {
              ...article.metadata,
              lastSyncedAt: new Date(),
              syncedFromFaq: faq.id
            };

            await this.articleRepository.save(article);
            updated.push(faq.id);

            this.logger.log(`Synced FAQ ${faq.id} changes to article ${article.id}`);
          }
        } catch (error) {
          errors.push({ faqId: faq.id, error: error.message });
        }
      }

      this.logger.log(`Sync completed: ${updated.length} articles updated`);

      return { updated: updated.length, errors };
    } catch (error) {
      this.logger.error('FAQ sync failed:', error);
      return { updated: 0, errors: [{ faqId: 'all', error: error.message }] };
    }
  }

  async getIntegrationStats(): Promise<IntegrationStats> {
    try {
      const [totalFaqs, convertedCount] = await Promise.all([
        this.faqRepository.count({ where: { status: FaqEntryStatus.PUBLISHED } }),
        this.faqRepository.count({
          where: {
            status: FaqEntryStatus.PUBLISHED,
            metadata: { kbIntegration: { articleId: { $ne: null } } } as any
          }
        })
      ]);

      const pendingConversion = totalFaqs - convertedCount;

      // Count category suggestions (FAQs without categories)
      const categorySuggestions = await this.faqRepository.count({
        where: {
          status: FaqEntryStatus.PUBLISHED,
          category: null
        }
      });

      return {
        totalFaqs,
        convertedToArticles: convertedCount,
        pendingConversion,
        categorySuggestions,
        lastSync: new Date() // This would be stored in config in real implementation
      };
    } catch (error) {
      this.logger.error('Failed to get integration stats:', error);
      return {
        totalFaqs: 0,
        convertedToArticles: 0,
        pendingConversion: 0,
        categorySuggestions: 0,
        lastSync: new Date()
      };
    }
  }

  async getCategorySuggestions(limit: number = 10): Promise<Array<{
    faq: LearnedFaqEntry;
    suggestions: CategorySuggestion[];
  }>> {
    
    try {
      // Get FAQs without categories
      const faqs = await this.faqRepository.find({
        where: {
          status: FaqEntryStatus.PUBLISHED,
          category: null
        },
        take: limit,
        order: { confidence: 'DESC' }
      });

      const results = [];

      for (const faq of faqs) {
        const suggestion = await this.suggestCategory(faq.question, faq.answer);
        if (suggestion) {
          results.push({
            faq,
            suggestions: [suggestion]
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to get category suggestions:', error);
      return [];
    }
  }

  private async findExistingMapping(faqId: string): Promise<FaqToArticleMapping | null> {
    try {
      const faq = await this.faqRepository.findOne({ where: { id: faqId } });
      const kbIntegration = (faq?.metadata as any)?.kbIntegration;
      
      if (kbIntegration?.articleId) {
        return {
          faqId: faqId,
          articleId: kbIntegration.articleId,
          mappingType: kbIntegration.mappingType || 'direct',
          createdAt: new Date(kbIntegration.convertedAt)
        };
      }
      
      return null;
    } catch (error) {
      return null;
    }
  }

  private buildArticleContent(faq: LearnedFaqEntry, customContent?: string): string {
    if (customContent) {
      return customContent;
    }

    let content = `# ${faq.question}\n\n`;
    content += `${faq.answer}\n\n`;

    if (faq.keywords.length > 0) {
      content += `## Anahtar Kelimeler\n`;
      content += faq.keywords.map(keyword => `- ${keyword}`).join('\n');
      content += '\n\n';
    }

    if ((faq.metadata as any)?.relatedQuestions?.length > 0) {
      content += `## İlgili Sorular\n`;
      content += (faq.metadata as any).relatedQuestions.map((q: string) => `- ${q}`).join('\n');
      content += '\n\n';
    }

    content += `---\n`;
    content += `*Bu makale AI destekli FAQ öğrenme sistemi tarafından otomatik olarak oluşturulmuştur.*\n`;
    content += `*Güven Skoru: ${faq.confidence}%*\n`;

    return content;
  }

  private generateArticleTitle(question: string): string {
    // Clean up the question to make a good title
    let title = question.trim();
    
    // Remove question mark if present
    if (title.endsWith('?')) {
      title = title.slice(0, -1);
    }

    // Capitalize first letter
    title = title.charAt(0).toUpperCase() + title.slice(1);

    // Limit length
    if (title.length > 100) {
      title = title.substring(0, 97) + '...';
    }

    return title;
  }

  private generateSummary(answer: string): string {
    // Generate a summary from the answer
    let summary = answer.trim();
    
    // Take first sentence or first 150 characters
    const firstSentence = summary.split('.')[0];
    if (firstSentence.length > 0 && firstSentence.length <= 150) {
      return firstSentence + '.';
    }

    if (summary.length > 150) {
      summary = summary.substring(0, 147) + '...';
    }

    return summary;
  }

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim()
      .substring(0, 100); // Limit length
  }

  private checkCategoryPatterns(text: string, categoryName: string): boolean {
    // Define common patterns for different categories
    const patterns: Record<string, string[]> = {
      'hesap': ['hesap', 'profil', 'giriş', 'şifre', 'kullanıcı'],
      'teknik': ['hata', 'çalışmıyor', 'problem', 'sorun', 'bug'],
      'faturalandırma': ['ödeme', 'fatura', 'ücret', 'para', 'kredi'],
      'genel': ['nasıl', 'nedir', 'ne zaman', 'nerede']
    };

    const categoryKey = categoryName.toLowerCase();
    const categoryPatterns = patterns[categoryKey] || [];

    return categoryPatterns.some(pattern => text.includes(pattern));
  }
}