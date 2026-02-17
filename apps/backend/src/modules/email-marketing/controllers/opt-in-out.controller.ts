import {
  Controller,
  Post,
  Get,
  Put,
  Body,
  Param,
  Query,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { OptInOutService } from '../services/opt-in-out.service';
import type { Request } from 'express';

@Controller('email-marketing/subscription')
export class OptInOutController {
  constructor(private readonly optInOutService: OptInOutService) {}

  /**
   * Subscribe with double opt-in
   */
  @Post('subscribe')
  @HttpCode(HttpStatus.OK)
  async subscribe(
    @Body() body: {
      email: string;
      firstName?: string;
      lastName?: string;
      company?: string;
      marketingEmails?: boolean;
    },
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] as string || 'unknown';

    return this.optInOutService.subscribeWithDoubleOptIn(
      body.email,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        company: body.company,
        marketingEmails: body.marketingEmails,
      },
      ipAddress,
    );
  }

  /**
   * Confirm opt-in via email token
   */
  @Get('confirm/:token')
  async confirmOptIn(
    @Param('token') token: string,
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] as string || 'unknown';
    return this.optInOutService.confirmOptIn(token, ipAddress);
  }

  /**
   * Unsubscribe via token (one-click)
   */
  @Get('unsubscribe/:token')
  async unsubscribeWithToken(
    @Param('token') token: string,
    @Query('reason') reason?: string,
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] as string || 'unknown';
    return this.optInOutService.unsubscribeWithToken(token, reason, ipAddress);
  }

  /**
   * Re-subscribe
   */
  @Post('resubscribe')
  @HttpCode(HttpStatus.OK)
  async resubscribe(
    @Body('email') email: string,
    @Req() req?: Request,
  ) {
    const ipAddress = req?.ip || req?.headers['x-forwarded-for'] as string || 'unknown';
    return this.optInOutService.resubscribe(email, ipAddress);
  }

  /**
   * Update preferences
   */
  @Put('preferences')
  async updatePreferences(
    @Body() body: {
      email: string;
      marketingEmails?: boolean;
      emailNotifications?: boolean;
    },
  ) {
    return this.optInOutService.updatePreferences(body.email, {
      marketingEmails: body.marketingEmails,
      emailNotifications: body.emailNotifications,
    });
  }

  /**
   * Get preferences
   */
  @Get('preferences/:email')
  async getPreferences(@Param('email') email: string) {
    return this.optInOutService.getPreferences(email);
  }

  /**
   * Check if can receive marketing emails
   */
  @Get('can-receive-marketing/:email')
  async canReceiveMarketingEmails(@Param('email') email: string) {
    const canReceive = await this.optInOutService.canReceiveMarketingEmails(email);
    return { email, canReceive };
  }

  /**
   * Check if can receive transactional emails
   */
  @Get('can-receive-transactional/:email')
  async canReceiveTransactionalEmails(@Param('email') email: string) {
    const canReceive = await this.optInOutService.canReceiveTransactionalEmails(email);
    return { email, canReceive };
  }
}