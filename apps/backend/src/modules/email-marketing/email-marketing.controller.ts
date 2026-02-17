import { Controller, Post, Body, Get } from '@nestjs/common';
import { EmailMarketingService } from './email-marketing.service';

@Controller('email-marketing')
export class EmailMarketingController {
  constructor(private readonly emailService: EmailMarketingService) {}

  @Post('send')
  async sendEmail(@Body() emailData: { to: string; subject: string; body: string }) {
    await this.emailService.sendEmail(emailData.to, emailData.subject, emailData.body);
    return { message: 'Email queued successfully' };
  }

  @Post('campaign/send')
  async sendCampaignEmail(@Body() campaignData: { to: string; subject: string; body: string; campaignId: string; recipientId: string }) {
    await this.emailService.sendCampaignEmail(
      campaignData.to, 
      campaignData.subject, 
      campaignData.body, 
      campaignData.campaignId, 
      campaignData.recipientId
    );
    return { message: 'Campaign email queued successfully' };
  }

  @Get('queue/status')
  async getQueueStatus() {
    return await this.emailService.getQueueStatus();
  }
}
