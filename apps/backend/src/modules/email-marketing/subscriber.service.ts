import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Subscriber } from './entities/subscriber.entity';
import { CreateSubscriberDto } from './dto/create-subscriber.dto';
import { UpdateSubscriberDto } from './dto/update-subscriber.dto';
import { EmailValidationService } from './services/email-validation.service';
import { AdvancedEmailValidationService } from './services/advanced-email-validation.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { Logger } from '@nestjs/common';

@Injectable()
export class SubscriberService {
  private readonly logger = new Logger(SubscriberService.name);
  constructor(
    @InjectRepository(Subscriber)
    private subscribersRepository: Repository<Subscriber>,
    private readonly emailValidationService: EmailValidationService,
    private readonly advancedEmailValidationService: AdvancedEmailValidationService,
    private readonly tenantService: TenantService,
  ) { }

  async create(createSubscriberDto: CreateSubscriberDto, senderIp?: string): Promise<Subscriber> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context required');

    // If mailerCheckResult is not provided, validate the email automatically
    let mailerCheckResult = createSubscriberDto.mailerCheckResult;
    if (!mailerCheckResult) {
      const validationResult = await this.advancedEmailValidationService.validateEmail(createSubscriberDto.email, senderIp);
      mailerCheckResult = validationResult.status;
    }

    const subscriber = this.subscribersRepository.create({
      ...createSubscriberDto,
      mailerCheckResult,
      status: createSubscriberDto.status || 'pending',
      groups: createSubscriberDto.groups || [],
      segments: createSubscriberDto.segments || [],
      tenantId,
    });
    return this.subscribersRepository.save(subscriber);
  }

  async findAll(): Promise<Subscriber[]> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context required');
    return this.subscribersRepository.find({ where: { tenantId } });
  }

  async findOne(id: string): Promise<Subscriber> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context required');

    const subscriber = await this.subscribersRepository.findOne({ where: { id, tenantId } });
    if (!subscriber) {
      throw new NotFoundException(`Subscriber with ID ${id} not found`);
    }
    return subscriber;
  }

  async findByEmail(email: string): Promise<Subscriber> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context required');

    const subscriber = await this.subscribersRepository.findOne({ where: { email, tenantId } });
    if (!subscriber) {
      throw new NotFoundException(`Subscriber with email ${email} not found`);
    }
    return subscriber;
  }

  async update(id: string, updateSubscriberDto: UpdateSubscriberDto): Promise<Subscriber> {
    const subscriber = await this.findOne(id);
    Object.assign(subscriber, updateSubscriberDto);
    return this.subscribersRepository.save(subscriber);
  }

  async remove(id: string): Promise<void> {
    const subscriber = await this.findOne(id);
    await this.subscribersRepository.remove(subscriber);
  }

  async subscribe(email: string, senderIp?: string): Promise<Subscriber> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) throw new UnauthorizedException('Tenant context required');

    let subscriber = await this.subscribersRepository.findOne({ where: { email, tenantId } });

    if (subscriber) {
      // If subscriber exists, update their status to active
      subscriber.status = 'active';
      subscriber.lastUpdated = new Date();
    } else {
      // If subscriber doesn't exist, create a new one
      // Validate email with IP reputation checking before creating subscriber
      const validationResult = await this.advancedEmailValidationService.validateEmail(email, senderIp);
      const mailerCheckResult = validationResult.status;

      subscriber = this.subscribersRepository.create({
        email,
        mailerCheckResult,
        status: 'active',
        groups: [],
        segments: [],
        subscribedAt: new Date(),
        lastUpdated: new Date(),
        tenantId,
      });
    }

    return this.subscribersRepository.save(subscriber);
  }

  async unsubscribe(email: string): Promise<Subscriber> {
    const subscriber = await this.findByEmail(email);
    subscriber.status = 'unsubscribed';
    subscriber.lastUpdated = new Date();
    return this.subscribersRepository.save(subscriber);
  }

  /**
   * Update subscriber status based on webhook events
   * Called by WebhookService when bounce/complaint events occur
   * NOTE: This method might be called from a webhook without tenant context or with explicit tenant context.
   * If tenantId is passed explicitly, use it. Otherwise, try to infer or fail.
   * Since webhooks might not have auth headers, we accept optional tenantId if passed from controller/service logic.
   */
  async updateStatusFromWebhook(
    email: string,
    status: 'bounced' | 'complained' | 'unsubscribed',
    metadata?: Record<string, any>,
    explicitTenantId?: string,
  ): Promise<Subscriber | null> {
    try {
      const tenantId = explicitTenantId || this.tenantService.getTenantId();
      // If no tenant context found (webhook context), we might need to find by email globally (dangerous? or find all matching emails?)
      // For now, let's assume tenantId is provided or we search by email + tenantId if available.

      const where: any = { email };
      if (tenantId) {
        where.tenantId = tenantId;
      } else {
        // Critical: If no tenantId is available, we cannot safely update from webhook
        // without searching all potential matches. For now, we log warning and abort.
        this.logger.warn(`Potential multi-tenancy breach: Webhook received for ${email} without tenant context`);
        return null;
      }

      const subscriber = await this.subscribersRepository.findOne({ where });

      if (!subscriber) {
        // Subscriber not found - this is OK, they might not be in marketing list
        return null;
      }

      // Update status
      subscriber.status = status;
      subscriber.lastUpdated = new Date();

      // Store webhook metadata if provided
      if (metadata) {
        subscriber.mailerCheckResult = metadata.bounceType || metadata.reason || subscriber.mailerCheckResult;
      }

      await this.subscribersRepository.save(subscriber);
      return subscriber;
    } catch (error) {
      // Log error but don't throw - webhook processing should continue
      console.error(`Failed to update subscriber ${email} from webhook:`, error);
      return null;
    }
  }

  /**
   * Check if email is suppressed (bounced, complained, or unsubscribed)
   * Should be checked before sending any marketing email
   */
  async isEmailSuppressed(email: string): Promise<boolean> {
    const tenantId = this.tenantService.getTenantId();
    if (!tenantId) return false; // Or throw? Safer to return false if no context, but usually this is called in context.

    const where: any = { email, tenantId };

    const subscriber = await this.subscribersRepository.findOne({ where });
    if (!subscriber) {
      return false;
    }
    return ['bounced', 'complained', 'unsubscribed'].includes(subscriber.status);
  }
}