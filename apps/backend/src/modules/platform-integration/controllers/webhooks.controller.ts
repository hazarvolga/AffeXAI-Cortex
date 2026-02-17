import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { WebhookService } from '../services/webhook.service';
import { Webhook } from '../entities/webhook.entity';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

/**
 * Webhooks Controller
 * 
 * CRUD operations for webhooks and webhook testing.
 */
@Controller('automation/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) { }

  /**
   * Get all webhooks
   */
  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.webhookService.findAll(user.tenantId);
  }

  /**
   * Get active webhooks
   */
  @Get('active')
  async findActive(@CurrentUser() user: User) {
    return this.webhookService.findActive(user.tenantId);
  }

  /**
   * Get webhook by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.webhookService.findOne(id, user.tenantId);
  }

  /**
   * Create new webhook
   */
  @Post()
  async create(@Body() data: any, @CurrentUser() user: User) {
    return this.webhookService.create(data, user.tenantId);
  }

  /**
   * Update webhook
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Partial<Webhook>,
    @CurrentUser() user: User,
  ) {
    return this.webhookService.update(id, data, user.tenantId);
  }

  /**
   * Delete webhook (soft delete)
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.webhookService.delete(id, user.tenantId);
    return { success: true };
  }

  /**
   * Test webhook connection
   */
  @Post(':id/test')
  async test(@Param('id') id: string, @CurrentUser() user: User) {
    return this.webhookService.testWebhook(id, user.tenantId);
  }

  /**
   * Get webhook statistics
   */
  @Get(':id/stats')
  async getStats(@Param('id') id: string, @CurrentUser() user: User) {
    return this.webhookService.getWebhookStats(id, user.tenantId);
  }

  /**
   * Get overall webhook statistics
   */
  @Get('stats/overall')
  async getOverallStats(@CurrentUser() user: User) {
    return this.webhookService.getOverallStats(user.tenantId);
  }
}
