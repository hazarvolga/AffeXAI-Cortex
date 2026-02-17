import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

/**
 * Ticket Notifications Gateway
 * Handles real-time notifications for ticket updates via WebSocket
 */
@WebSocketGateway({
  cors: {
    origin: '*',
    credentials: true,
  },
  namespace: 'tickets',
})
export class TicketNotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TicketNotificationsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socket IDs

  constructor(private readonly jwtService: JwtService) {}

  /**
   * Handle client connection
   */
  async handleConnection(client: Socket) {
    try {
      // Extract token from handshake
      const token = client.handshake.auth.token || client.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connected without token`);
        client.disconnect();
        return;
      }

      // Verify JWT token
      const payload = await this.jwtService.verifyAsync(token);
      const userId = payload.sub || payload.userId;

      if (!userId) {
        this.logger.warn(`Client ${client.id} has invalid token payload`);
        client.disconnect();
        return;
      }

      // Store user-socket mapping
      if (!this.userSockets.has(userId)) {
        this.userSockets.set(userId, new Set());
      }
      this.userSockets.get(userId)!.add(client.id);

      // Store userId in socket data for later use
      client.data.userId = userId;

      // Join user-specific room
      client.join(`user:${userId}`);

      this.logger.log(`Client ${client.id} connected for user ${userId}`);
    } catch (error) {
      this.logger.error(`Connection error for client ${client.id}: ${error.message}`);
      client.disconnect();
    }
  }

  /**
   * Handle client disconnection
   */
  handleDisconnect(client: Socket) {
    const userId = client.data.userId;

    if (userId) {
      const sockets = this.userSockets.get(userId);
      if (sockets) {
        sockets.delete(client.id);
        if (sockets.size === 0) {
          this.userSockets.delete(userId);
        }
      }
      this.logger.log(`Client ${client.id} disconnected for user ${userId}`);
    }
  }

  /**
   * Subscribe to ticket updates
   */
  @SubscribeMessage('subscribe:ticket')
  handleSubscribeToTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    client.join(`ticket:${ticketId}`);
    this.logger.log(`Client ${client.id} subscribed to ticket ${ticketId}`);
    return { success: true, ticketId };
  }

  /**
   * Unsubscribe from ticket updates
   */
  @SubscribeMessage('unsubscribe:ticket')
  handleUnsubscribeFromTicket(
    @ConnectedSocket() client: Socket,
    @MessageBody() ticketId: string,
  ) {
    client.leave(`ticket:${ticketId}`);
    this.logger.log(`Client ${client.id} unsubscribed from ticket ${ticketId}`);
    return { success: true, ticketId };
  }

  /**
   * Emit ticket created notification
   */
  emitTicketCreated(ticketId: string, userId: string, ticket: any) {
    this.server.to(`user:${userId}`).emit('ticket:created', {
      ticketId,
      ticket,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted ticket:created for ticket ${ticketId} to user ${userId}`);
  }

  /**
   * Emit ticket assigned notification
   */
  emitTicketAssigned(ticketId: string, assignedToId: string, ticket: any) {
    this.server.to(`user:${assignedToId}`).emit('ticket:assigned', {
      ticketId,
      ticket,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted ticket:assigned for ticket ${ticketId} to user ${assignedToId}`);
  }

  /**
   * Emit new message notification
   */
  emitNewMessage(ticketId: string, message: any, recipientUserIds: string[]) {
    // Emit to ticket room
    this.server.to(`ticket:${ticketId}`).emit('ticket:message', {
      ticketId,
      message,
      timestamp: new Date(),
    });

    // Emit to specific users
    recipientUserIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:message', {
        ticketId,
        message,
        timestamp: new Date(),
      });
    });

    this.logger.log(`Emitted ticket:message for ticket ${ticketId}`);
  }

  /**
   * Emit ticket status changed notification
   */
  emitStatusChanged(ticketId: string, oldStatus: string, newStatus: string, userIds: string[]) {
    const payload = {
      ticketId,
      oldStatus,
      newStatus,
      timestamp: new Date(),
    };

    // Emit to ticket room
    this.server.to(`ticket:${ticketId}`).emit('ticket:status_changed', payload);

    // Emit to specific users
    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:status_changed', payload);
    });

    this.logger.log(`Emitted ticket:status_changed for ticket ${ticketId}`);
  }

  /**
   * Emit SLA breach warning
   */
  emitSLABreachWarning(ticketId: string, assignedToId: string, ticket: any) {
    this.server.to(`user:${assignedToId}`).emit('ticket:sla_warning', {
      ticketId,
      ticket,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted ticket:sla_warning for ticket ${ticketId} to user ${assignedToId}`);
  }

  /**
   * Emit SLA breach alert
   */
  emitSLABreach(ticketId: string, userIds: string[], ticket: any) {
    const payload = {
      ticketId,
      ticket,
      timestamp: new Date(),
    };

    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:sla_breach', payload);
    });

    this.logger.log(`Emitted ticket:sla_breach for ticket ${ticketId}`);
  }

  /**
   * Emit ticket escalated notification
   */
  emitTicketEscalated(ticketId: string, escalatedToIds: string[], ticket: any) {
    const payload = {
      ticketId,
      ticket,
      timestamp: new Date(),
    };

    escalatedToIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:escalated', payload);
    });

    this.logger.log(`Emitted ticket:escalated for ticket ${ticketId}`);
  }

  /**
   * Emit message edited notification
   */
  emitMessageEdited(ticketId: string, messageId: string, userIds: string[]) {
    const payload = {
      ticketId,
      messageId,
      timestamp: new Date(),
    };

    // Emit to ticket room
    this.server.to(`ticket:${ticketId}`).emit('ticket:message_edited', payload);

    // Emit to specific users
    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:message_edited', payload);
    });

    this.logger.log(`Emitted ticket:message_edited for message ${messageId}`);
  }

  /**
   * Emit message deleted notification
   */
  emitMessageDeleted(ticketId: string, messageId: string, userIds: string[]) {
    const payload = {
      ticketId,
      messageId,
      timestamp: new Date(),
    };

    // Emit to ticket room
    this.server.to(`ticket:${ticketId}`).emit('ticket:message_deleted', payload);

    // Emit to specific users
    userIds.forEach((userId) => {
      this.server.to(`user:${userId}`).emit('ticket:message_deleted', payload);
    });

    this.logger.log(`Emitted ticket:message_deleted for message ${messageId}`);
  }

  /**
   * Get online users count
   */
  getOnlineUsersCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is online
   */
  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get user's active socket count
   */
  getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }
}
