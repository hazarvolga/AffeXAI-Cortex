import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification } from './entities/notification.entity';
import { TenantService } from '../../core/tenant/tenant.service';
import { InstructionException } from '../../core/exceptions/instruction.exception';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private notificationRepository: Repository<Notification>,
    private readonly tenantService: TenantService,
  ) { }

  private getActiveTenantId(providedId?: string): string {
    const activeTenantId = providedId || this.tenantService.getTenantId();
    if (!activeTenantId) {
      throw new InstructionException('No tenant context found for notifications operation');
    }
    return activeTenantId;
  }

  async createNotification(data: { message: string; type: string; userId?: string; metadata?: Record<string, any>; tenantId?: string }): Promise<Notification> {
    const activeTenantId = this.getActiveTenantId(data.tenantId);
    const notification = this.notificationRepository.create({
      ...data,
      tenantId: activeTenantId,
    });
    return await this.notificationRepository.save(notification);
  }

  async findAll(userId: string | undefined, tenantId?: string): Promise<Notification[]> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const queryBuilder = this.notificationRepository.createQueryBuilder('notification')
      .where('notification.tenantId = :tenantId', { tenantId: activeTenantId });

    if (userId) {
      queryBuilder.andWhere('notification.userId = :userId', { userId });
    }

    return await queryBuilder
      .orderBy('notification.createdAt', 'DESC')
      .getMany();
  }

  async findOne(id: string, tenantId?: string): Promise<Notification> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const notification = await this.notificationRepository.findOne({ where: { id, tenantId: activeTenantId } as any });
    if (!notification) {
      throw new Error('Notification not found');
    }
    return notification;
  }

  async markAsRead(id: string, tenantId?: string): Promise<Notification> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    // First verify explicitly with tenantId
    const notification = await this.findOne(id, activeTenantId);

    notification.isRead = true;
    return await this.notificationRepository.save(notification);
  }

  async markAllAsRead(userId: string, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    await this.notificationRepository.update({ userId, tenantId: activeTenantId } as any, { isRead: true });
  }
}
