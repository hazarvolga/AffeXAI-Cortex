import { Controller, Post, Body, Headers, Logger, BadRequestException } from '@nestjs/common';
import { Webhook } from 'svix';
import { WebhookService } from '../services/webhook.service';
import type {
  ResendWebhookPayload
} from '../interfaces/webhook-event.interface';
import {
  EmailWebhookEvent,
  EmailWebhookEventType,
  BounceReason
} from '../interfaces/webhook-event.interface';

/**
 * Resend webhook controller
 * Receives webhooks from Resend and processes them
 * 
 * Setup in Resend dashboard:
 * 1. Go to Webhooks section
 * 2. Add endpoint: https://yourdomain.com/api/webhooks/resend
 * 3. Select events: email.delivered, email.bounced, email.complained, email.opened, email.clicked
 * 4. Copy signing secret to environment: RESEND_WEBHOOK_SECRET
 */
@Controller('webhooks/resend')
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(private readonly webhookService: WebhookService) { }

  @Post()
  async handleWebhook(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() payload: ResendWebhookPayload,
  ) {
    // Verify webhook signature using Svix
    // Resend uses Svix for webhook delivery and signing
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (!webhookSecret) {
      this.logger.error('RESEND_WEBHOOK_SECRET not configured');
      throw new BadRequestException('Webhook secret not configured');
    }

    // NOTE: [SECURITY] Enable signature verification in production with Resend webhook secret
    // For development, we'll skip verification to test functionality
    if (process.env.NODE_ENV === 'production') {
      try {
        const wh = new Webhook(webhookSecret);

        // Verify signature
        wh.verify(JSON.stringify(payload), {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });

        this.logger.log(`Verified Resend webhook: ${payload.type} for ${payload.data.to[0]}`);
      } catch (err) {
        this.logger.error(`Webhook signature verification failed: ${err.message}`);
        throw new BadRequestException('Invalid signature');
      }
    } else {
      this.logger.warn('Development mode: Skipping webhook signature verification');
    }

    // Convert Resend payload to generic EmailWebhookEvent
    const event = this.mapResendToGenericEvent(payload);

    // Process event
    await this.webhookService.processWebhookEvent(event);

    return { success: true };
  }

  /**
   * Handle inbound emails (email replies)
   * 
   * Setup in Resend dashboard:
   * 1. Go to Domains → your domain → Inbound
   * 2. Add inbound rule to forward emails
   * 3. Set webhook URL: https://yourdomain.com/api/webhooks/resend/inbound
   * 4. Forward emails matching pattern: ticket-*@yourdomain.com
   */
  @Post('inbound')
  async handleInboundEmail(
    @Headers('svix-id') svixId: string,
    @Headers('svix-timestamp') svixTimestamp: string,
    @Headers('svix-signature') svixSignature: string,
    @Body() payload: any,
  ) {
    this.logger.log('📧 Received inbound email webhook');

    // Verify webhook signature in production
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    if (process.env.NODE_ENV === 'production' && webhookSecret) {
      try {
        const wh = new Webhook(webhookSecret);
        wh.verify(JSON.stringify(payload), {
          'svix-id': svixId,
          'svix-timestamp': svixTimestamp,
          'svix-signature': svixSignature,
        });
        this.logger.log('✅ Inbound email signature verified');
      } catch (err) {
        this.logger.error(`❌ Inbound email signature verification failed: ${err.message}`);
        throw new BadRequestException('Invalid signature');
      }
    } else {
      this.logger.warn('⚠️ Development mode: Skipping signature verification');
    }

    // Extract email data from Resend inbound payload
    const inboundData = {
      from: payload.data.from,
      to: payload.data.to,
      subject: payload.data.subject,
      text: payload.data.text,
      html: payload.data.html,
      messageId: payload.data.message_id,
      inReplyTo: payload.data.in_reply_to,
      references: payload.data.references,
      headers: payload.data.headers,
    };

    this.logger.log(`📨 Inbound email from: ${inboundData.from} to: ${inboundData.to}`);

    // Process inbound email (check if it's a ticket reply)
    await this.webhookService.handleInboundEmail(inboundData);

    return { success: true };
  }

  /**
   * Map Resend-specific webhook payload to generic EmailWebhookEvent
   */
  private mapResendToGenericEvent(payload: ResendWebhookPayload): EmailWebhookEvent {
    const eventTypeMap: Record<string, EmailWebhookEventType> = {
      'email.delivered': EmailWebhookEventType.DELIVERED,
      'email.bounced': EmailWebhookEventType.BOUNCED,
      'email.complained': EmailWebhookEventType.COMPLAINED,
      'email.opened': EmailWebhookEventType.OPENED,
      'email.clicked': EmailWebhookEventType.CLICKED,
      'email.delivery_delayed': EmailWebhookEventType.DEFERRED,
    };

    const event: EmailWebhookEvent = {
      provider: 'resend',
      eventType: eventTypeMap[payload.type] || EmailWebhookEventType.DELIVERED,
      email: payload.data.to[0], // Resend sends array, we take first
      messageId: payload.data.email_id,
      timestamp: new Date(payload.created_at),
      rawPayload: payload,
    };

    // Map bounce reason if present
    if (payload.data.bounce) {
      event.reason = this.mapResendBounceReason(payload.data.bounce.message);
      event.metadata = {
        bounceType: payload.data.bounce.type,
        bounceMessage: payload.data.bounce.message,
      };
    }

    // Add click/open metadata
    if (payload.data.click) {
      event.metadata = {
        link: payload.data.click.link,
        ipAddress: payload.data.click.ipAddress,
        userAgent: payload.data.click.userAgent,
      };
    }

    if (payload.data.open) {
      event.metadata = {
        ipAddress: payload.data.open.ipAddress,
        userAgent: payload.data.open.userAgent,
      };
    }

    return event;
  }

  /**
   * Map Resend bounce message to normalized bounce reason
   */
  private mapResendBounceReason(message: string): BounceReason {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('mailbox') && lowerMessage.includes('not found')) {
      return BounceReason.MAILBOX_NOT_FOUND;
    }
    if (lowerMessage.includes('domain') && lowerMessage.includes('not found')) {
      return BounceReason.DOMAIN_NOT_FOUND;
    }
    if (lowerMessage.includes('mailbox full')) {
      return BounceReason.MAILBOX_FULL;
    }
    if (lowerMessage.includes('message too large')) {
      return BounceReason.MESSAGE_TOO_LARGE;
    }
    if (lowerMessage.includes('rejected')) {
      return BounceReason.RECIPIENT_REJECTED;
    }
    if (lowerMessage.includes('blocked')) {
      return BounceReason.BLOCKED;
    }

    return BounceReason.UNKNOWN;
  }
}
