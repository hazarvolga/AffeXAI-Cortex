import { Controller, Post, Body, Get, UseGuards, Request } from '@nestjs/common';
import { IsEmail, IsString, IsNotEmpty } from 'class-validator';
import { MailService } from './mail.service';
import { MailChannel, MailPriority } from './interfaces/mail-service.interface';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

/**
 * Test Email DTO
 */
class SendTestEmailDto {
  @IsEmail()
  @IsNotEmpty()
  to: string;

  @IsString()
  @IsNotEmpty()
  subject: string;

  @IsString()
  @IsNotEmpty()
  message: string;
}

/**
 * Mail Controller
 * For testing and debugging email functionality
 */
@Controller('mail')
@UseGuards(JwtAuthGuard)
export class MailController {
  constructor(private readonly mailService: MailService) { }

  /**
   * Test connection to email provider
   */
  @Get('test-connection')
  async testConnection(@Request() req) {
    const tenantId = req.user.tenantId || 'default';
    const isConnected = await this.mailService.testConnection(tenantId);
    return {
      success: isConnected,
      message: isConnected
        ? 'Connection to email provider successful'
        : 'Failed to connect to email provider',
      tenantId,
    };
  }

  /**
   * Send a test email
   */
  @Post('send-test')
  async sendTestEmail(@Request() req, @Body() dto: SendTestEmailDto) {
    const tenantId = req.user.tenantId || 'default';

    const result = await this.mailService.sendMail({
      to: { email: dto.to },
      subject: dto.subject,
      html: `
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
              .content { background: #f9fafb; padding: 20px; border-radius: 0 0 8px 8px; }
              .footer { margin-top: 20px; font-size: 12px; color: #6b7280; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Test Email from Aluplan</h1>
              </div>
              <div class="content">
                <p>Hello!</p>
                <p>${dto.message}</p>
                <p>This is a test email sent from the Aluplan email infrastructure.</p>
                <p><strong>Tenant ID:</strong> ${tenantId}</p>
                <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
              </div>
              <div class="footer">
                <p>This is a test email. Please do not reply.</p>
                <p>&copy; 2025 Aluplan. All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      channel: MailChannel.SYSTEM,
      priority: MailPriority.NORMAL,
      tags: ['test', 'system', `tenant:${tenantId}`],
    }, tenantId);

    return {
      success: result.success,
      messageId: result.messageId,
      error: result.error,
      timestamp: result.timestamp,
      tenantId,
    };
  }
}
