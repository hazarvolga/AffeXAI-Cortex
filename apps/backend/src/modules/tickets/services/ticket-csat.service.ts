import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCSAT } from '../entities/ticket-csat.entity';
import { Ticket } from '../entities/ticket.entity';
import { TicketEmailService } from './ticket-email.service';
import { randomBytes } from 'crypto';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * CSAT Service
 * Manages customer satisfaction surveys
 */

export interface CSATSurveyData {
  ticketId: string;
  customerId: string;
  rating: number;
  feedback?: string;
  responses?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
}

export interface CSATStatistics {
  totalResponses: number;
  averageRating: number;
  ratingDistribution: { rating: number; count: number }[];
  responseRate: number; // percentage of surveys completed
  satisfactionScore: number; // % of 4-5 star ratings
  promoterScore: number; // NPS-style metric
}

@Injectable()
export class TicketCSATService {
  private readonly logger = new Logger(TicketCSATService.name);

  constructor(
    @InjectRepository(TicketCSAT)
    private readonly csatRepository: Repository<TicketCSAT>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly emailService: TicketEmailService,
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
   * Request CSAT survey for a resolved ticket
   */
  async requestSurvey(ticketId: string): Promise<TicketCSAT> {
    const tenantId = this.getActiveTenantId();
    const ticket = await this.ticketRepository.findOne({
      where: { id: ticketId, tenantId },
      relations: ['customer', 'assignedAgent'],
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket ${ticketId} not found`);
    }

    // Check if survey already exists
    const existingSurvey = await this.csatRepository.findOne({
      where: { ticketId, tenantId },
    });

    if (existingSurvey) {
      this.logger.warn(`CSAT survey already exists for ticket ${ticketId}`);
      return existingSurvey;
    }

    // Generate unique survey token
    const surveyToken = this.generateSurveyToken();

    // Create CSAT record
    const csat = this.csatRepository.create({
      ticketId,
      customerId: ticket.userId, // userId is the ticket creator (customer)
      surveyToken,
      surveyRequestedAt: new Date(),
      rating: 0, // Placeholder, will be updated when customer responds
      tenantId,
    });

    await this.csatRepository.save(csat);

    // Send survey email
    await this.emailService.sendTicketResolved(ticket, surveyToken);

    this.logger.log(`CSAT survey requested for ticket ${ticketId}, token: ${surveyToken}`);
    return csat;
  }

  /**
   * Submit CSAT survey response
   */
  async submitSurvey(
    token: string,
    surveyData: Partial<CSATSurveyData>,
  ): Promise<TicketCSAT> {
    // Find survey by token
    const csat = await this.csatRepository.findOne({
      where: { surveyToken: token },
      relations: ['ticket', 'customer'],
    });

    if (!csat) {
      throw new NotFoundException('Survey not found or invalid token');
    }

    // Check if already completed
    if (csat.surveyCompletedAt) {
      throw new BadRequestException('Survey already completed');
    }

    // Validate rating
    if (!surveyData.rating || surveyData.rating < 1 || surveyData.rating > 5) {
      throw new BadRequestException('Rating must be between 1 and 5');
    }

    // Update CSAT record
    csat.rating = surveyData.rating;
    csat.feedback = surveyData.feedback || '';
    csat.responses = surveyData.responses || {};
    csat.ipAddress = surveyData.ipAddress || '';
    csat.userAgent = surveyData.userAgent || '';
    csat.surveyCompletedAt = new Date();

    await this.csatRepository.save(csat);

    this.logger.log(`CSAT survey completed for ticket ${csat.ticketId}, rating: ${csat.rating}`);
    return csat;
  }

  /**
   * Get CSAT survey by token (for public access)
   */
  async getSurveyByToken(token: string): Promise<TicketCSAT> {
    const csat = await this.csatRepository.findOne({
      where: { surveyToken: token },
      relations: ['ticket'],
    });

    if (!csat) {
      throw new NotFoundException('Survey not found');
    }

    return csat;
  }

  /**
   * Get CSAT statistics for analytics
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date,
    agentId?: string,
  ): Promise<CSATStatistics> {
    const tenantId = this.getActiveTenantId();
    const queryBuilder = this.csatRepository
      .createQueryBuilder('csat')
      .leftJoin('csat.ticket', 'ticket')
      .where('csat.surveyCompletedAt IS NOT NULL')
      .andWhere('csat.tenantId = :tenantId', { tenantId });

    // Date range filter
    if (startDate) {
      queryBuilder.andWhere('csat.surveyCompletedAt >= :startDate', { startDate });
    }
    if (endDate) {
      queryBuilder.andWhere('csat.surveyCompletedAt <= :endDate', { endDate });
    }

    // Agent filter
    if (agentId) {
      queryBuilder.andWhere('ticket.assignedAgentId = :agentId', { agentId });
    }

    const responses = await queryBuilder.getMany();
    const totalRequested = await this.csatRepository.count({
      where: { tenantId, ...(startDate || endDate || agentId ? {} : {}) }, // Apply same filters + tenantId
    });

    // Calculate statistics
    const totalResponses = responses.length;
    const averageRating =
      totalResponses > 0
        ? responses.reduce((sum, r) => sum + r.rating, 0) / totalResponses
        : 0;

    // Rating distribution
    const ratingDistribution = [1, 2, 3, 4, 5].map((rating) => ({
      rating,
      count: responses.filter((r) => r.rating === rating).length,
    }));

    // Response rate
    const responseRate =
      totalRequested > 0 ? (totalResponses / totalRequested) * 100 : 0;

    // Satisfaction score (% of 4-5 star ratings)
    const satisfiedCount = responses.filter((r) => r.rating >= 4).length;
    const satisfactionScore =
      totalResponses > 0 ? (satisfiedCount / totalResponses) * 100 : 0;

    // Promoter score (5 stars = promoters, 1-3 = detractors)
    const promoters = responses.filter((r) => r.rating === 5).length;
    const detractors = responses.filter((r) => r.rating <= 3).length;
    const promoterScore =
      totalResponses > 0
        ? ((promoters - detractors) / totalResponses) * 100
        : 0;

    return {
      totalResponses,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution,
      responseRate: Math.round(responseRate * 10) / 10,
      satisfactionScore: Math.round(satisfactionScore * 10) / 10,
      promoterScore: Math.round(promoterScore * 10) / 10,
    };
  }

  /**
   * Get recent CSAT feedback
   */
  async getRecentFeedback(limit: number = 10): Promise<TicketCSAT[]> {
    const tenantId = this.getActiveTenantId();
    return await this.csatRepository.find({
      where: { tenantId, surveyCompletedAt: undefined },
      order: { surveyCompletedAt: 'DESC' },
      take: limit,
      relations: ['ticket', 'customer'],
    });
  }

  /**
   * Generate unique survey token
   */
  private generateSurveyToken(): string {
    return randomBytes(32).toString('hex');
  }
}
