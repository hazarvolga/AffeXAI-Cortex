import { WebSocketGateway, WebSocketServer, OnGatewayConnection, OnGatewayDisconnect, SubscribeMessage, MessageBody, ConnectedSocket } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: '*', // Configure this appropriately for production
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private connectedUsers = new Map<string, string>(); // userId -> socketId

  handleConnection(client: Socket) {
    this.logger.log(`Client connected: ${client.id}`);

    // In a real implementation, you would authenticate the user here
    // For now, we'll just log the connection
    client.emit('connected', { message: 'Connected to notification service' });
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove user from connected users map
    for (const [userId, socketId] of this.connectedUsers.entries()) {
      if (socketId === client.id) {
        this.connectedUsers.delete(userId);
        break;
      }
    }
  }

  @SubscribeMessage('join')
  handleJoin(@MessageBody() data: { userId: string; tenantId: string }, @ConnectedSocket() client: Socket) {
    if (!data.tenantId) {
      this.logger.warn(`Client ${client.id} tried to join room without tenantId`);
      return { error: 'tenantId is required' };
    }

    this.connectedUsers.set(data.userId, client.id);

    // Join user-specific room (scoped by tenant to be extra safe)
    const userRoom = `tenant-${data.tenantId}-user-${data.userId}`;
    client.join(userRoom);

    // Join tenant broadcase channel
    const tenantRoom = `tenant-${data.tenantId}`;
    client.join(tenantRoom);

    this.logger.log(`User ${data.userId} joined room ${userRoom} and ${tenantRoom}`);

    client.emit('joined', { message: `Joined rooms for user ${data.userId} in tenant ${data.tenantId}` });
    return { success: true };
  }

  @SubscribeMessage('leave')
  handleLeave(@MessageBody() data: { userId: string; tenantId: string }, @ConnectedSocket() client: Socket) {
    this.connectedUsers.delete(data.userId);

    if (data.tenantId) {
      client.leave(`tenant-${data.tenantId}-user-${data.userId}`);
      client.leave(`tenant-${data.tenantId}`);
      this.logger.log(`User ${data.userId} left tenant ${data.tenantId} rooms`);
    }

    client.emit('left', { message: `Left rooms for user ${data.userId}` });
  }

  // Method to send notification to a specific user
  async sendNotificationToUser(tenantId: string, userId: string, notification: any) {
    const userRoom = `tenant-${tenantId}-user-${userId}`;
    this.server.to(userRoom).emit('notification', notification);
    this.logger.log(`Notification sent to user ${userId} in tenant ${tenantId}`);
  }

  // Method to send notification to all users in a tenant
  async sendNotificationToTenant(tenantId: string, notification: any) {
    this.server.to(`tenant-${tenantId}`).emit('notification', notification);
    this.logger.log(`Notification sent to all users in tenant ${tenantId}`);
  }

  // DEPRECATED: Global broadcast is dangerous in multi-tenant env
  // Replacing with tenant-aware broadcast
  async sendNotificationToAll(notification: any) {
    this.logger.warn('Use sendNotificationToTenant instead of sendNotificationToAll');
    // this.server.emit('notification', notification); 
  }

  // Method to send notification to admins of a tenant
  async sendNotificationToTenantAdmins(tenantId: string, notification: any) {
    this.server.to(`admins-${tenantId}`).emit('admin-notification', notification);
    this.logger.log(`Notification sent to admins of tenant ${tenantId}`);
  }

  // DEPRECATED: Global admin broadcast
  async sendNotificationToAdmins(notification: any) {
    this.logger.warn('Use sendNotificationToTenantAdmins instead');
    // this.server.to('admins').emit('admin-notification', notification);
  }

  @SubscribeMessage('join-admins')
  handleJoinAdmins(@MessageBody() data: { tenantId: string }, @ConnectedSocket() client: Socket) {
    if (data && data.tenantId) {
      client.join(`admins-${data.tenantId}`);
      this.logger.log(`Client ${client.id} joined admins-${data.tenantId} room`);
      client.emit('joined-admins', { message: `Joined admins-${data.tenantId} room` });
    } else {
      // Fallback for legacy calls (should be updated on client)
      // client.join('admins'); 
      this.logger.warn(`Client ${client.id} tried to join admins room without tenantId`);
    }
  }

  @SubscribeMessage('send-notification')
  async handleSendNotification(@MessageBody() data: { userId?: string, tenantId: string, message: string, type: string }) {
    if (!data.tenantId) {
      this.logger.warn('Client tried to send notification without tenantId');
      return { success: false, error: 'tenantId is required' };
    }

    const notification = {
      id: Date.now().toString(),
      message: data.message,
      type: data.type,
      tenantId: data.tenantId, // Store tenantId in notification object
      timestamp: new Date(),
    };

    if (data.userId) {
      await this.sendNotificationToUser(data.tenantId, data.userId, notification);
    } else {
      // Send to the entire tenant broadcase room
      await this.sendNotificationToTenant(data.tenantId, notification);
    }

    return { success: true, notification };
  }
}
