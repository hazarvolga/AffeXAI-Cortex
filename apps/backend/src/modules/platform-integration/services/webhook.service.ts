import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { OnEvent } from '@nestjs/event-emitter';
import { Webhook, WebhookAuthType } from '../entities/webhook.entity';
import { PlatformEvent, PlatformEventType } from '../entities/platform-event.entity';

/**
 * Webhook Service
 * 
 * Manages webhook subscriptions and deliveries.
 * Sends platform events to external systems via HTTP.
 * 
 * Features:
 * - Event-based webhook triggering
 * - Multiple authentication methods (Bearer, API Key, Basic)
 * - Automatic retry with exponential backoff
 * - Success/failure tracking
 * - Webhook health monitoring
 */
@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    @InjectRepository(Webhook)
    private readonly webhookRepository: Repository<Webhook>,
    private readonly httpService: HttpService,
  ) { }

  /**
   * Listen to platform events and trigger webhooks
   */
  @OnEvent('platform.event')
  async handlePlatformEvent(data: {
    event: PlatformEvent;
    payload: Record<string, any>;
    metadata?: Record<string, any>;
  }): Promise<void> {
    const { event } = data;

    try {
      // Find all active webhooks subscribed to this event type for this tenant
      const webhooks = await this.findSubscribedWebhooks(event.eventType, event.tenantId);

      if (webhooks.length === 0) {
        return;
      }

      this.logger.log(
        `Found ${webhooks.length} webhooks subscribed to ${event.eventType}`,
      );

      // Trigger webhooks in parallel
      await Promise.all(
        webhooks.map(webhook => this.triggerWebhook(webhook, event)),
      );
    } catch (error) {
      this.logger.error(
        `Failed to handle platform event for webhooks: ${event.id}`,
        error.stack,
      );
    }
  }

  /**
   * Find webhooks subscribed to an event type
   */
  private async findSubscribedWebhooks(
    eventType: PlatformEventType,
    tenantId: string,
  ): Promise<Webhook[]> {
    return this.webhookRepository
      .createQueryBuilder('webhook')
      .where('webhook.is_active = :isActive', { isActive: true })
      .andWhere('webhook.tenantId = :tenantId', { tenantId })
      .andWhere(':eventType = ANY(webhook.subscribed_events)', { eventType })
      .getMany();
  }

  /**
   * Trigger a webhook with an event
   */
  async triggerWebhook(webhook: Webhook, event: PlatformEvent): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Triggering webhook: ${webhook.name} (${webhook.id})`,
        { eventType: event.eventType },
      );

      // Prepare payload
      const payload = {
        event: {
          id: event.id,
          type: event.eventType,
          source: event.source,
          timestamp: event.createdAt,
        },
        data: event.payload,
        metadata: event.metadata,
      };

      // Send HTTP request with retry logic
      await this.sendWithRetry(webhook, payload);

      const duration = Date.now() - startTime;

      this.logger.log(
        `Webhook triggered successfully: ${webhook.name}`,
        { duration: `${duration}ms` },
      );
    } catch (error) {
      this.logger.error(
        `Failed to trigger webhook: ${webhook.name}`,
        error.stack,
      );
      // Error is already recorded in sendWithRetry
    }
  }

  /**
   * Send HTTP request with retry logic
   */
  private async sendWithRetry(
    webhook: Webhook,
    payload: any,
    attempt = 1,
  ): Promise<void> {
    try {
      // Prepare headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Aluplan-Webhook/1.0',
        ...webhook.getAuthHeaders(),
        ...webhook.customHeaders,
      };

      // Send request
      const response = await firstValueFrom(
        this.httpService.post(webhook.url, payload, {
          headers,
          timeout: webhook.timeout,
        }),
      );

      // Record success
      webhook.recordCall(true, response?.status || 200);
      await this.webhookRepository.save(webhook);

      this.logger.debug(
        `Webhook call successful: ${webhook.name}`,
        { status: response?.status || 200 },
      );
    } catch (error: any) {
      const status = error.response?.status;
      const errorMessage = error.message;

      this.logger.warn(
        `Webhook call failed (attempt ${attempt}/${webhook.retryCount + 1}): ${webhook.name}`,
        { status, error: errorMessage },
      );

      // Check if we should retry
      if (attempt <= webhook.retryCount) {
        // Calculate retry delay with exponential backoff
        const delay = webhook.retryDelay * Math.pow(2, attempt - 1);

        this.logger.log(
          `Retrying webhook in ${delay}ms: ${webhook.name}`,
        );

        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, delay));

        // Retry
        return this.sendWithRetry(webhook, payload, attempt + 1);
      } else {
        // All retries exhausted, record failure
        webhook.recordCall(false, status, errorMessage);
        await this.webhookRepository.save(webhook);

        throw new Error(
          `Webhook failed after ${webhook.retryCount + 1} attempts: ${errorMessage}`,
        );
      }
    }
  }

  /**
   * Create a new webhook
   */
  async create(data: {
    name: string;
    url: string;
    subscribedEvents: PlatformEventType[];
    authType?: WebhookAuthType;
    authConfig?: any;
    customHeaders?: Record<string, string>;
    description?: string;
    retryCount?: number;
    retryDelay?: number;
    timeout?: number;
  }, tenantId: string): Promise<Webhook> {
    const webhook = this.webhookRepository.create({
      ...data,
      isActive: true,
      authType: data.authType || WebhookAuthType.NONE,
      tenantId,
    });

    return this.webhookRepository.save(webhook);
  }

  /**
   * Update webhook
   */
  async update(id: string, data: Partial<Webhook>, tenantId: string): Promise<Webhook> {
    await this.webhookRepository.update({ id, tenantId } as any, data);

    const webhook = await this.webhookRepository.findOne({ where: { id, tenantId } as any });
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    return webhook;
  }

  /**
   * Delete webhook (soft delete)
   */
  async delete(id: string, tenantId: string): Promise<void> {
    await this.webhookRepository.softDelete({ id, tenantId } as any);
  }

  /**
   * Get all webhooks
   */
  async findAll(tenantId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { tenantId } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get active webhooks
   */
  async findActive(tenantId: string): Promise<Webhook[]> {
    return this.webhookRepository.find({
      where: { isActive: true, tenantId } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get webhook by ID
   */
  async findOne(id: string, tenantId: string): Promise<Webhook | null> {
    return this.webhookRepository.findOne({ where: { id, tenantId } as any });
  }

  /**
   * Test webhook connection
   */
  async testWebhook(id: string, tenantId: string): Promise<{
    success: boolean;
    status?: number;
    error?: string;
    duration: number;
  }> {
    const webhook = await this.findOne(id, tenantId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'User-Agent': 'Aluplan-Webhook/1.0',
        ...webhook.getAuthHeaders(),
        ...webhook.customHeaders,
      };

      const testPayload = {
        event: {
          type: 'test',
          timestamp: new Date(),
        },
        data: {
          message: 'This is a test webhook call from Aluplan',
        },
      };

      const response = await firstValueFrom(
        this.httpService.post(webhook.url, testPayload, {
          headers,
          timeout: webhook.timeout,
        }),
      );

      const duration = Date.now() - startTime;

      return {
        success: true,
        status: response?.status || 200,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      return {
        success: false,
        status: error.response?.status,
        error: error.message,
        duration,
      };
    }
  }

  /**
   * Get webhook statistics
   */
  async getWebhookStats(id: string, tenantId: string): Promise<{
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    successRate: number;
    lastCalledAt?: Date;
    lastStatus?: number;
  }> {
    const webhook = await this.findOne(id, tenantId);
    if (!webhook) {
      throw new Error(`Webhook not found: ${id}`);
    }

    return {
      totalCalls: webhook.totalCalls,
      successfulCalls: webhook.successfulCalls,
      failedCalls: webhook.failedCalls,
      successRate: webhook.getSuccessRate(),
      lastCalledAt: webhook.lastCalledAt,
      lastStatus: webhook.lastStatus,
    };
  }

  /**
   * Get overall webhook statistics
   */
  async getOverallStats(tenantId: string): Promise<{
    totalWebhooks: number;
    activeWebhooks: number;
    totalCalls: number;
    successfulCalls: number;
    averageSuccessRate: number;
  }> {
    const webhooks = await this.findAll(tenantId);


    const totalWebhooks = webhooks.length;
    const activeWebhooks = webhooks.filter(w => w.isActive).length;

    const totalCalls = webhooks.reduce((sum, w) => sum + w.totalCalls, 0);
    const successfulCalls = webhooks.reduce((sum, w) => sum + w.successfulCalls, 0);

    const averageSuccessRate =
      webhooks.length > 0
        ? webhooks.reduce((sum, w) => sum + w.getSuccessRate(), 0) / webhooks.length
        : 0;

    return {
      totalWebhooks,
      activeWebhooks,
      totalCalls,
      successfulCalls,
      averageSuccessRate,
    };
  }
}
