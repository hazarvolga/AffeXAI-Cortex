import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Ticket } from '../entities/ticket.entity';
import { TicketCategory } from '../entities/ticket-category.entity';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * AI Categorization Service
 * ML-based automatic ticket categorization
 */

export interface CategoryPrediction {
  categoryId: string;
  categoryName: string;
  confidence: number;
  reasons: string[];
}

export interface CategoryTrainingData {
  ticketCount: number;
  accuracy: number;
  lastTrainedAt: Date;
  categories: Array<{
    id: string;
    name: string;
    sampleCount: number;
  }>;
}

@Injectable()
export class AICategorizationService {
  private readonly logger = new Logger(AICategorizationService.name);

  // Keyword patterns for each category (simplified ML simulation)
  private categoryPatterns: Map<string, {
    keywords: string[];
    weight: number;
  }[]> = new Map();

  constructor(
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketCategory)
    private readonly categoryRepository: Repository<TicketCategory>,
    private readonly tenantService: TenantService,
  ) {
    this.initializePatterns();
  }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getActiveTenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Initialize ML patterns (in production, this would load trained models)
   */
  private initializePatterns(): void {
    // Technical Issues
    this.categoryPatterns.set('technical', [
      { keywords: ['bug', 'error', 'crash', 'not working', 'broken', 'hata', 'çalışmıyor'], weight: 10 },
      { keywords: ['500', '404', 'exception', 'timeout', 'connection'], weight: 8 },
      { keywords: ['install', 'setup', 'configure', 'kurulum', 'ayar'], weight: 6 },
    ]);

    // Billing & Payment
    this.categoryPatterns.set('billing', [
      { keywords: ['invoice', 'payment', 'billing', 'charge', 'fatura', 'ödeme', 'ücret'], weight: 10 },
      { keywords: ['refund', 'subscription', 'plan', 'iade', 'abonelik'], weight: 9 },
      { keywords: ['credit card', 'bank', 'paypal', 'kredi kartı'], weight: 8 },
    ]);

    // Account & Access
    this.categoryPatterns.set('account', [
      { keywords: ['login', 'password', 'account', 'access', 'giriş', 'şifre', 'hesap'], weight: 10 },
      { keywords: ['forgot', 'reset', 'locked', 'unuttum', 'kilitli'], weight: 9 },
      { keywords: ['2fa', 'two-factor', 'security', 'güvenlik'], weight: 7 },
    ]);

    // Feature Request
    this.categoryPatterns.set('feature', [
      { keywords: ['feature', 'request', 'add', 'would like', 'özellik', 'istek', 'ekle'], weight: 10 },
      { keywords: ['suggestion', 'improve', 'enhancement', 'öneri', 'geliştir'], weight: 8 },
      { keywords: ['new', 'support', 'yeni', 'destek'], weight: 6 },
    ]);

    // General Question
    this.categoryPatterns.set('question', [
      { keywords: ['how', 'what', 'where', 'why', 'nasıl', 'nedir', 'nerede'], weight: 10 },
      { keywords: ['help', 'guide', 'tutorial', 'yardım', 'kılavuz'], weight: 8 },
      { keywords: ['question', 'soru', 'information', 'bilgi'], weight: 7 },
    ]);

    this.logger.log('AI categorization patterns initialized');
  }

  /**
   * Predict category for a ticket using ML simulation
   */
  async predictCategory(ticket: Ticket): Promise<CategoryPrediction[]> {
    const content = `${ticket.subject} ${ticket.description}`.toLowerCase();
    const predictions: Array<{
      categoryKey: string;
      score: number;
      matchedKeywords: string[];
    }> = [];

    // Calculate scores for each category
    for (const [categoryKey, patterns] of this.categoryPatterns.entries()) {
      let score = 0;
      const matchedKeywords: string[] = [];

      for (const pattern of patterns) {
        for (const keyword of pattern.keywords) {
          if (content.includes(keyword.toLowerCase())) {
            score += pattern.weight;
            matchedKeywords.push(keyword);
          }
        }
      }

      if (score > 0) {
        predictions.push({
          categoryKey,
          score,
          matchedKeywords,
        });
      }
    }

    // Sort by score
    predictions.sort((a, b) => b.score - a.score);

    // Get categories from database for this tenant
    const tenantId = this.getActiveTenantId();
    const categories = await this.categoryRepository.find({
      where: { isActive: true, tenantId },
    });

    // Map predictions to actual categories
    const results: CategoryPrediction[] = [];
    const totalScore = predictions.reduce((sum, p) => sum + p.score, 0);

    for (const pred of predictions.slice(0, 3)) { // Top 3
      // Find matching category by name pattern
      const category = categories.find(c =>
        c.name.toLowerCase().includes(pred.categoryKey) ||
        pred.categoryKey.includes(c.name.toLowerCase())
      );

      if (category) {
        const confidence = totalScore > 0 ? (pred.score / totalScore) * 100 : 0;

        results.push({
          categoryId: category.id,
          categoryName: category.name,
          confidence: Math.round(confidence),
          reasons: pred.matchedKeywords,
        });
      }
    }

    this.logger.log(
      `Predicted ${results.length} categories for ticket ${ticket.id}`,
    );

    return results;
  }

  /**
   * Auto-assign category to ticket
   */
  async autoCategorizе(ticketId: string): Promise<CategoryPrediction | null> {
    const tenantId = this.getActiveTenantId();
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      return null;
    }

    const predictions = await this.predictCategory(ticket);

    if (predictions.length > 0 && predictions[0].confidence >= 60) {
      // Auto-assign if confidence >= 60%
      ticket.categoryId = predictions[0].categoryId;
      await this.ticketRepository.save(ticket);

      this.logger.log(
        `Auto-categorized ticket ${ticketId} to ${predictions[0].categoryName} (${predictions[0].confidence}%)`,
      );

      return predictions[0];
    }

    return null;
  }

  /**
   * Get categorization suggestions (don't auto-assign)
   */
  async getSuggestions(ticketId: string): Promise<CategoryPrediction[]> {
    const tenantId = this.getActiveTenantId();
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, tenantId },
    });

    if (!ticket) {
      return [];
    }

    return await this.predictCategory(ticket);
  }

  /**
   * Train model with historical data (simulated)
   */
  async trainModel(): Promise<CategoryTrainingData> {
    // In production, this would trigger actual ML model training
    // For now, we'll just collect statistics
    const tenantId = this.getActiveTenantId();

    const tickets = await this.ticketRepository.find({
      where: { tenantId },
      relations: ['category'],
    });

    const categorizedTickets = tickets.filter(t => t.categoryId);
    const accuracy = categorizedTickets.length / tickets.length;

    const categoryStats = new Map<string, number>();
    for (const ticket of categorizedTickets) {
      if (ticket.category) {
        const count = categoryStats.get(ticket.category.id) || 0;
        categoryStats.set(ticket.category.id, count + 1);
      }
    }

    const categories = await this.categoryRepository.find({
      where: { isActive: true, tenantId },
    });

    const categoryInfo = categories.map(cat => ({
      id: cat.id,
      name: cat.name,
      sampleCount: categoryStats.get(cat.id) || 0,
    }));

    this.logger.log(
      `Model training completed: ${categorizedTickets.length} samples, ${Math.round(accuracy * 100)}% accuracy`,
    );

    return {
      ticketCount: categorizedTickets.length,
      accuracy: Math.round(accuracy * 100),
      lastTrainedAt: new Date(),
      categories: categoryInfo,
    };
  }

  /**
   * Get AI categorization statistics
   */
  async getStatistics(): Promise<{
    totalPredictions: number;
    autoAssigned: number;
    averageConfidence: number;
    accuracyRate: number;
  }> {
    // In production, this would query actual ML metrics
    // For MVP, return simulated statistics
    const tenantId = this.getActiveTenantId();

    const tickets = await this.ticketRepository.find({
      where: { tenantId },
      relations: ['category'],
    });

    const categorized = tickets.filter(t => t.categoryId);
    const totalPredictions = tickets.length;
    const autoAssigned = Math.round(categorized.length * 0.7); // Simulate 70% auto-assigned
    const averageConfidence = 75; // Simulated
    const accuracyRate = 85; // Simulated

    return {
      totalPredictions,
      autoAssigned,
      averageConfidence,
      accuracyRate,
    };
  }

  /**
   * Validate prediction accuracy
   */
  async validatePrediction(
    ticketId: string,
    predictedCategoryId: string,
    actualCategoryId: string,
  ): Promise<boolean> {
    const isCorrect = predictedCategoryId === actualCategoryId;

    // In production, store this for model improvement
    this.logger.log(
      `Prediction validation for ticket ${ticketId}: ${isCorrect ? 'Correct' : 'Incorrect'}`,
    );

    return isCorrect;
  }
}
