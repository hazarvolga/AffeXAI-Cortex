import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { Notification } from './entities/notification.entity';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) { }

  @Get()
  async findAll(@CurrentUser() user: User, @Query('userId') userId?: string): Promise<Notification[]> {
    return await this.notificationsService.findAll(userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Notification> {
    return await this.notificationsService.findOne(id);
  }

  @Post(':id/read')
  async markAsRead(@Param('id') id: string): Promise<Notification> {
    return await this.notificationsService.markAsRead(id);
  }

  @Post('read-all')
  async markAllAsRead(@Body() body: { userId: string }): Promise<{ message: string }> {
    await this.notificationsService.markAllAsRead(body.userId);
    return { message: 'All notifications marked as read' };
  }

  // Endpoint for creating a notification
  @Post('create')
  async createNotification(
    @Body() body: { message: string; type: string; userId?: string; metadata?: Record<string, any> },
  ): Promise<Notification> {
    return await this.notificationsService.createNotification(body);
  }
}
