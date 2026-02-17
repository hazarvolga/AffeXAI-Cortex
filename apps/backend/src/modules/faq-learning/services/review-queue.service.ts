import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Between } from 'typeorm';
import { LearnedFaqEntry, FaqEntryStatus } from '../entities/learned-faq-entry.entity';
import { FaqLearningConfig } from '../entities/faq-learning-config.entity';
import { User } from '../../users/entities/user.entity';

export interface ReviewQueueFilters {
  status?: FaqEntryStatus[];
  confidence?: { min?: number; max?: number };
  source?: ('chat' | 'ticket')[];
  category?: string[];
  dateRange?: { from: Date; to: Date };
  reviewedBy?: string;
  createdBy?: string;
  page?: number;
  limit?: number;
  sortBy?: 'createdAt' | 'confidence' | 'usageCount' | 'helpfulCount';
  sortOrder?: 'ASC' | 'DESC';
}

export interface ReviewQueueItem {
  id: string;
  question: string;
  answer: string;
  confidence: number;
  status: FaqEntryStatus;
  source: string;
  sourceId: string;
  category?: string;
  keywords: string[];
  usageCount: number;
  helpfulCount: number;
  notHelpfulCount: number;
  createdAt: Date;
  metadata?: any;
  creator?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  reviewer?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email: string;
  };
  reviewedAt?: Date;
}

export interface ReviewQueueResponse {
  items: ReviewQueueItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface BulkReviewRequest {
  faqIds: string[];
  action: 'approve' | 'reject' | 'publish';
  reviewerId: string;
  reason?: string;
}

export interface ReviewDecision {
  faqId: string;
  action: 'approve' | 'reject' | 'publish' | 'edit';
  reviewerId: string;
  reason?: string;
  editedAnswer?: string;
  editedCategory?: string;
  editedKeywords?: string[];
}

@Injectable()
export class ReviewQueueService {
  private readonly logger = new Logger(ReviewQueueService.name);

  constructor(
    @InjectRepository(LearnedFaqEntry)
    private faqRepository: Repository<LearnedFaqEntry>,
    @InjectRepository(FaqLearningConfig)
    private configRepository: Repository<FaqLearningConfig>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
  ) { }

  async getReviewQueue(filters: ReviewQueueFilters = {}): Promise<ReviewQueueResponse> {
    const {
      status = [FaqEntryStatus.PENDING_REVIEW],
      confidence,
      source,
      category,
      dateRange,
      reviewedBy,
      createdBy,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'DESC'
    } = filters;

    try {
      const queryBuilder = this.faqRepository.createQueryBuilder('faq')
        .leftJoinAndSelect('faq.creator', 'creator')
        .leftJoinAndSelect('faq.reviewer', 'reviewer');

      // Apply filters
      if (status.length > 0) {
        queryBuilder.andWhere('faq.status IN (:...status)', { status });
      }

      if (confidence) {
        if (confidence.min !== undefined) {
          queryBuilder.andWhere('faq.confidence >= :minConfidence', { minConfidence: confidence.min });
        }
        if (confidence.max !== undefined) {
          queryBuilder.andWhere('faq.confidence <= :maxConfidence', { maxConfidence: confidence.max });
        }
      }

      if (source && source.length > 0) {
        queryBuilder.andWhere('faq.source IN (:...source)', { source });
      }

      if (category && category.length > 0) {
        queryBuilder.andWhere('faq.category IN (:...category)', { category });
      }

      if (dateRange) {
        queryBuilder.andWhere('faq.createdAt BETWEEN :fromDate AND :toDate', {
          fromDate: dateRange.from,
          toDate: dateRange.to
        });
      }

      if (reviewedBy) {
        queryBuilder.andWhere('faq.reviewedBy = :reviewedBy', { reviewedBy });
      }

      if (createdBy) {
        queryBuilder.andWhere('faq.createdBy = :createdBy', { createdBy });
      }

      // Apply sorting
      queryBuilder.orderBy(`faq.${sortBy}`, sortOrder);

      // Apply pagination
      const offset = (page - 1) * limit;
      queryBuilder.skip(offset).take(limit);

      const [faqs, total] = await queryBuilder.getManyAndCount();

      const items: ReviewQueueItem[] = faqs.map(faq => ({
        id: faq.id,
        question: faq.question,
        answer: faq.answer,
        confidence: faq.confidence,
        status: faq.status,
        source: faq.source,
        sourceId: faq.sourceId,
        category: faq.category,
        keywords: faq.keywords,
        usageCount: faq.usageCount,
        helpfulCount: faq.helpfulCount,
        notHelpfulCount: faq.notHelpfulCount,
        createdAt: faq.createdAt,
        metadata: faq.metadata,
        creator: faq.creator ? {
          id: faq.creator.id,
          firstName: faq.creator.firstName,
          lastName: faq.creator.lastName,
          email: faq.creator.email
        } : undefined,
        reviewer: faq.reviewer ? {
          id: faq.reviewer.id,
          firstName: faq.reviewer.firstName,
          lastName: faq.reviewer.lastName,
          email: faq.reviewer.email
        } : undefined,
        reviewedAt: faq.reviewedAt
      }));

      const totalPages = Math.ceil(total / limit);

      return {
        items,
        total,
        page,
        limit,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      };

    } catch (error) {
      this.logger.error('Failed to get review queue:', error);
      throw new Error(`Failed to get review queue: ${error.message}`);
    }
  }

  async reviewFaq(decision: ReviewDecision): Promise<LearnedFaqEntry> {
    const { faqId, action, reviewerId, reason, editedAnswer, editedCategory, editedKeywords } = decision;

    try {
      const faq = await this.faqRepository.findOne({
        where: { id: faqId },
        relations: ['creator', 'reviewer']
      });

      if (!faq) {
        throw new NotFoundException(`FAQ with ID ${faqId} not found`);
      }

      const reviewer = await this.userRepository.findOne({
        where: { id: reviewerId }
      });

      if (!reviewer) {
        throw new NotFoundException(`Reviewer with ID ${reviewerId} not found`);
      }

      // Update FAQ based on action
      switch (action) {
        case 'approve':
          faq.status = FaqEntryStatus.APPROVED;
          break;
        case 'publish':
          faq.status = FaqEntryStatus.PUBLISHED;
          faq.publishedAt = new Date();
          break;
        case 'reject':
          faq.status = FaqEntryStatus.REJECTED;
          break;
        case 'edit':
          if (editedAnswer) faq.answer = editedAnswer;
          if (editedCategory) faq.category = editedCategory;
          if (editedKeywords) faq.keywords = editedKeywords;
          faq.status = FaqEntryStatus.APPROVED; // Edited FAQs are approved
          break;
        default:
          throw new BadRequestException(`Invalid action: ${action}`);
      }

      // Set review metadata
      faq.reviewedBy = reviewerId;
      faq.reviewedAt = new Date();
      faq.reviewer = reviewer;

      // Add review reason to metadata
      if (reason) {
        faq.metadata = {
          ...faq.metadata,
          reviewReason: reason,
          reviewAction: action,
          reviewedAt: new Date()
        };
      }

      const savedFaq = await this.faqRepository.save(faq);

      this.logger.log(`FAQ ${faqId} ${action}ed by reviewer ${reviewerId}`);

      // Send notification if configured
      await this.sendReviewNotification(savedFaq, action, reviewer);

      return savedFaq;

    } catch (error) {
      this.logger.error(`Failed to review FAQ ${faqId}:`, error);
      throw error;
    }
  }

  async bulkReview(request: BulkReviewRequest): Promise<{
    successful: string[];
    failed: Array<{ faqId: string; error: string }>;
  }> {
    const { faqIds, action, reviewerId, reason } = request;
    const successful: string[] = [];
    const failed: Array<{ faqId: string; error: string }> = [];

    this.logger.log(`Starting bulk review: ${action} for ${faqIds.length} FAQs by reviewer ${reviewerId}`);

    for (const faqId of faqIds) {
      try {
        await this.reviewFaq({
          faqId,
          action,
          reviewerId,
          reason
        });
        successful.push(faqId);
      } catch (error) {
        failed.push({
          faqId,
          error: error.message
        });
        this.logger.warn(`Bulk review failed for FAQ ${faqId}:`, error);
      }
    }

    this.logger.log(`Bulk review completed: ${successful.length} successful, ${failed.length} failed`);

    return { successful, failed };
  }

  async getReviewStats(): Promise<{
    total: number;
    pendingReview: number;
    approved: number;
    rejected: number;
    published: number;
    averageConfidence: number;
    topCategories: Array<{ category: string; count: number }>;
    reviewerStats: Array<{ reviewerId: string; reviewerName: string; reviewCount: number }>;
  }> {
    try {
      const [
        total,
        pendingReview,
        approved,
        rejected,
        published
      ] = await Promise.all([
        this.faqRepository.count(),
        this.faqRepository.count({ where: { status: FaqEntryStatus.PENDING_REVIEW } }),
        this.faqRepository.count({ where: { status: FaqEntryStatus.APPROVED } }),
        this.faqRepository.count({ where: { status: FaqEntryStatus.REJECTED } }),
        this.faqRepository.count({ where: { status: FaqEntryStatus.PUBLISHED } })
      ]);

      // Calculate average confidence
      const avgResult = await this.faqRepository
        .createQueryBuilder('faq')
        .select('AVG(faq.confidence)', 'avg')
        .getRawOne();

      const averageConfidence = Math.round(parseFloat(avgResult.avg) || 0);

      // Get top categories
      const categoryStats = await this.faqRepository
        .createQueryBuilder('faq')
        .select('faq.category', 'category')
        .addSelect('COUNT(*)', 'count')
        .where('faq.category IS NOT NULL')
        .groupBy('faq.category')
        .orderBy('count', 'DESC')
        .limit(10)
        .getRawMany();

      const topCategories = categoryStats.map(stat => ({
        category: stat.category,
        count: parseInt(stat.count)
      }));

      // Get reviewer stats
      const reviewerStats = await this.faqRepository
        .createQueryBuilder('faq')
        .leftJoin('faq.reviewer', 'reviewer')
        .select('reviewer.id', 'reviewerId')
        .addSelect('CONCAT(reviewer.firstName, \' \', reviewer.lastName)', 'reviewerName')
        .addSelect('COUNT(*)', 'reviewCount')
        .where('faq.reviewedBy IS NOT NULL')
        .groupBy('reviewer.id, reviewer.firstName, reviewer.lastName')
        .orderBy('"reviewCount"', 'DESC')
        .limit(10)
        .getRawMany();

      return {
        total,
        pendingReview,
        approved,
        rejected,
        published,
        averageConfidence,
        topCategories,
        reviewerStats: reviewerStats.map(stat => ({
          reviewerId: stat.reviewerId,
          reviewerName: stat.reviewerName || 'Unknown',
          reviewCount: parseInt(stat.reviewCount)
        }))
      };

    } catch (error) {
      this.logger.error('Failed to get review stats:', error);
      throw new Error(`Failed to get review stats: ${error.message}`);
    }
  }

  async autoPublishHighConfidenceFaqs(tenantId: string): Promise<number> {
    try {
      const config = await this.getAutoPublishConfig(tenantId);

      if (!config.enableAutoPublishing) {
        return 0;
      }

      const faqs = await this.faqRepository.find({
        where: {
          status: FaqEntryStatus.APPROVED,
          confidence: config.minConfidenceForAutoPublish || 85,
          tenantId,
        }
      });

      if (faqs.length === 0) {
        return 0;
      }

      // Update status to published
      await this.faqRepository.update(
        { id: In(faqs.map(f => f.id)), tenantId },
        {
          status: FaqEntryStatus.PUBLISHED,
          publishedAt: new Date()
        }
      );

      this.logger.log(`Auto-published ${faqs.length} high-confidence FAQs`);

      return faqs.length;

    } catch (error) {
      this.logger.error('Failed to auto-publish FAQs:', error);
      return 0;
    }
  }

  async getReviewHistory(faqId: string): Promise<Array<{
    action: string;
    reviewerId: string;
    reviewerName: string;
    reviewedAt: Date;
    reason?: string;
  }>> {
    try {
      const faq = await this.faqRepository.findOne({
        where: { id: faqId },
        relations: ['reviewer']
      });

      if (!faq) {
        throw new NotFoundException(`FAQ with ID ${faqId} not found`);
      }

      // For now, return current review info
      // In a full implementation, you'd have a separate review history table
      const history = [];

      if (faq.reviewedAt && faq.reviewer) {
        history.push({
          action: faq.status,
          reviewerId: faq.reviewer.id,
          reviewerName: `${faq.reviewer.firstName} ${faq.reviewer.lastName}`.trim() || faq.reviewer.email,
          reviewedAt: faq.reviewedAt,
          reason: faq.metadata?.reviewReason
        });
      }

      return history;

    } catch (error) {
      this.logger.error(`Failed to get review history for FAQ ${faqId}:`, error);
      throw error;
    }
  }

  private async sendReviewNotification(faq: LearnedFaqEntry, action: string, reviewer: User): Promise<void> {
    try {
      // This would integrate with your notification system
      // For now, just log the notification
      this.logger.log(`Notification: FAQ "${faq.question}" was ${action}ed by ${reviewer.email}`);

      // In a real implementation, you might:
      // - Send email notifications
      // - Create in-app notifications
      // - Update dashboard metrics
      // - Trigger webhooks

    } catch (error) {
      this.logger.warn('Failed to send review notification:', error);
    }
  }

  private async getAutoPublishConfig(tenantId: string): Promise<any> {
    try {
      const config = await this.configRepository.findOne({
        where: { configKey: 'advanced_settings', tenantId }
      });

      return config?.configValue || {
        enableAutoPublishing: false,
        minConfidenceForAutoPublish: 85
      };
    } catch (error) {
      this.logger.error('Failed to load auto-publish config:', error);
      return {
        enableAutoPublishing: false,
        minConfidenceForAutoPublish: 85
      };
    }
  }
}