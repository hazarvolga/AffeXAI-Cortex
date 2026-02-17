import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { EmailCampaignService } from '../email-campaign.service';
import { MailService } from '../../mail/mail.service';
import { MailChannel, MailPriority } from '../../mail/interfaces/mail-service.interface';
import { TenantService } from '../../../core/tenant/tenant.service';

export interface EmailJobData {
  to: string;
  subject: string;
  body: string;
  campaignId?: string;
  recipientId?: string;
  tenantId?: string;
}

@Processor('email', {
  concurrency: 5, // Process 5 emails at a time
  limiter: {
    max: 100, // Max 100 emails
    duration: 60000, // Per 60 seconds (1 minute)
  },
})
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(
    private readonly campaignService: EmailCampaignService,
    private readonly mailService: MailService,
    private readonly tenantService: TenantService,
  ) {
    super();
  }

  async process(job: Job<EmailJobData, any, string>): Promise<any> {
    this.logger.log(`Processing email job ${job.id} to ${job.data.to}`);

    // Extract tenantId from job data, default to 'default' if not present
    const tenantId = job.data.tenantId || 'default';

    return this.tenantService.runWithTenant({ tenantId }, async () => {
      try {
        // Send real email via MailService with tenant context
        const result = await this.mailService.sendMail({
          to: { email: job.data.to },
          subject: job.data.subject,
          html: job.data.body,
          channel: MailChannel.MARKETING,
          priority: MailPriority.NORMAL,
          tags: job.data.campaignId ? ['campaign', job.data.campaignId] : ['marketing'],
        }, tenantId);

        if (!result.success) {
          throw new Error(result.error || 'Email sending failed');
        }

        // If this is a campaign email, update campaign stats
        if (job.data.campaignId) {
          await this.updateCampaignStats(job.data.campaignId);
        }

        this.logger.log(`Email sent successfully to ${job.data.to} (Tenant: ${tenantId}), messageId: ${result.messageId}`);
        return {
          success: true,
          sentAt: new Date(),
          messageId: result.messageId,
        };
      } catch (error) {
        this.logger.error(`Failed to send email to ${job.data.to}: ${error.message}`);

        // Retry logic: throw error to let BullMQ handle retries
        throw error;
      }
    });
  }

  private async updateCampaignStats(campaignId: string): Promise<void> {
    // In a real implementation, you would update the campaign statistics
    // For now, we'll just log that we would update stats
    this.logger.log(`Would update stats for campaign ${campaignId}`);
    await this.campaignService.incrementSentCount(campaignId);
  }
}