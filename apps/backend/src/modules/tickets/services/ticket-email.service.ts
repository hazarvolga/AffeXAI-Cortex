import { Injectable, Logger } from '@nestjs/common';
import { MailService } from '../../mail/mail.service';
import { Ticket } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';
import { MailChannel } from '../../mail/interfaces/mail-service.interface';
import { SettingsService } from '../../settings/settings.service';

/**
 * Ticket Email Service
 * Handles all email notifications for ticket-related events
 */
@Injectable()
export class TicketEmailService {
  private readonly logger = new Logger(TicketEmailService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly mailService: MailService,
    private readonly settingsService: SettingsService,
  ) {
    this.baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:9002';
  }

  /**
   * Send email when a new ticket is created
   * Sends to: Customer, Assigned User (if any), Support Managers
   */
  async sendTicketCreatedEmail(
    ticket: Ticket,
    customer: User,
    assignedUser?: User,
    supportManagers?: User[],
  ): Promise<void> {
    try {
      this.logger.log(`[EMAIL DEBUG] sendTicketCreatedEmail called for ticket ${ticket.id}`);
      this.logger.log(`[EMAIL DEBUG] Customer email: ${customer.email}`);
      this.logger.log(`[EMAIL DEBUG] Assigned user: ${assignedUser ? assignedUser.email : 'none'}`);
      this.logger.log(`[EMAIL DEBUG] Support managers count: ${supportManagers?.length || 0}`);

      const customerTicketUrl = `${this.baseUrl}/portal/support/${ticket.id}`;
      const adminTicketUrl = `${this.baseUrl}/admin/support/${ticket.id}`;

      // Fetch site settings for email branding
      // Need site settings for footers/branding
      // We use ticket.tenantId for proper branding context
      const siteSettings = await this.settingsService.getSiteSettings(ticket.tenantId);

      // Get system domain from settings
      // We use ticket.tenantId for proper branding/domain context
      const domain = await this.settingsService.getDomain(ticket.tenantId);

      // Generate email threading headers for proper conversation threading
      const messageId = `<ticket-${ticket.id}-created-${Date.now()}@${domain}>`;

      // Reply-To address for email threading (support team can reply directly)
      const ticketReplyAddress = `ticket-${ticket.id}@${domain}`;

      // 1. Send to Customer (using customer-specific template)
      this.logger.log(`[EMAIL DEBUG] Sending email to customer: ${customer.email}`);
      await this.mailService.sendMail({
        to: { email: customer.email, name: `${customer.firstName} ${customer.lastName}` },
        subject: `Destek Talebiniz Oluşturuldu: ${ticket.subject}`,
        template: 'ticket-created-customer',
        channel: MailChannel.TRANSACTIONAL,
        headers: {
          'Message-ID': messageId,
          'X-Ticket-ID': ticket.id.toString(),
        },
        context: {
          customerName: `${customer.firstName} ${customer.lastName}` || customer.email,
          displayNumber: ticket.displayNumber,
          subject: ticket.subject,
          priority: ticket.priority,
          ticketUrl: customerTicketUrl,
          siteSettings,
        },
      });
      this.logger.log(`✅ Ticket created email sent to customer: ${customer.email}`);

      // 2. Send to Assigned User (using support-specific template)
      if (assignedUser) {
        this.logger.log(`[EMAIL DEBUG] Sending email to assigned user: ${assignedUser.email}`);
        await this.mailService.sendMail({
          to: { email: assignedUser.email, name: `${assignedUser.firstName} ${assignedUser.lastName}` },
          subject: `Yeni Destek Talebi Atandı: ${ticket.subject}`,
          template: 'ticket-created-support',
          channel: MailChannel.TRANSACTIONAL,
          replyTo: { email: ticketReplyAddress, name: `Ticket ${ticket.displayNumber}` },
          headers: {
            'Message-ID': messageId,
            'X-Ticket-ID': ticket.id.toString(),
            'References': messageId,
          },
          context: {
            supportUserName: `${assignedUser.firstName} ${assignedUser.lastName}`,
            displayNumber: ticket.displayNumber,
            subject: ticket.subject,
            priority: ticket.priority,
            ticketUrl: adminTicketUrl,
            isAssignedUser: true,
            customerName: `${customer.firstName} ${customer.lastName}`,
            customerEmail: customer.email,
            categoryName: ticket.category?.name || '',
            ticketDescription: ticket.description,
            siteSettings,
          },
        });
        this.logger.log(`✅ Ticket created email sent to assigned user: ${assignedUser.email}`);
      }

      // 3. Send to Support Managers
      if (supportManagers && supportManagers.length > 0) {
        this.logger.log(`[EMAIL DEBUG] Sending emails to ${supportManagers.length} support managers`);
        for (const manager of supportManagers) {
          // Skip if manager is also the assigned user (avoid duplicate)
          if (assignedUser && manager.id === assignedUser.id) {
            this.logger.log(`[EMAIL DEBUG] Skipping manager ${manager.email} (already assigned)`);
            continue;
          }

          await this.mailService.sendMail({
            to: { email: manager.email, name: `${manager.firstName} ${manager.lastName}` },
            subject: `Yeni Destek Talebi: ${ticket.subject}`,
            template: 'ticket-created-support',
            channel: MailChannel.TRANSACTIONAL,
            replyTo: { email: ticketReplyAddress, name: `Ticket ${ticket.displayNumber}` },
            headers: {
              'Message-ID': messageId,
              'X-Ticket-ID': ticket.id.toString(),
              'References': messageId,
            },
            context: {
              supportUserName: `${manager.firstName} ${manager.lastName}`,
              displayNumber: ticket.displayNumber,
              subject: ticket.subject,
              priority: ticket.priority,
              ticketUrl: adminTicketUrl,
              isAssignedUser: false,
              customerName: `${customer.firstName} ${customer.lastName}`,
              customerEmail: customer.email,
              categoryName: ticket.category?.name || '',
              ticketDescription: ticket.description,
              siteSettings,
            },
          });
          this.logger.log(`✅ Ticket created email sent to support manager: ${manager.email}`);
        }
      }

      this.logger.log(`✅ All ticket created emails sent successfully for ticket ${ticket.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket created email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email when a ticket is assigned to an agent
   */
  async sendTicketAssignedEmail(
    ticket: Ticket,
    assignedTo: User,
    assignedBy: User,
  ): Promise<void> {
    try {
      const ticketUrl = `${this.baseUrl}/admin/support/${ticket.id}`;

      await this.mailService.sendMail({
        to: { email: assignedTo.email, name: `${assignedTo.firstName} ${assignedTo.lastName}` },
        subject: `Ticket Assigned: ${ticket.subject}`,
        template: 'ticket-assigned',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          agentName: `${assignedTo.firstName} ${assignedTo.lastName}` || assignedTo.email,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          ticketPriority: ticket.priority,
          ticketStatus: ticket.status,
          assignedByName: `${assignedBy.firstName} ${assignedBy.lastName}` || assignedBy.email,
          ticketUrl,
        },
      });

      this.logger.log(`Ticket assigned email sent to ${assignedTo.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket assigned email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email when a new message is added to a ticket
   */
  async sendNewMessageEmail(
    ticket: Ticket,
    message: TicketMessage,
    recipient: User,
    isCustomerMessage: boolean,
  ): Promise<void> {
    try {
      const ticketUrl = isCustomerMessage
        ? `${this.baseUrl}/admin/support/${ticket.id}`
        : `${this.baseUrl}/portal/support/${ticket.id}`;

      const subject = isCustomerMessage
        ? `Yeni Müşteri Mesajı - ${ticket.displayNumber}: ${ticket.subject}`
        : `Yeni Yanıt - ${ticket.displayNumber}: ${ticket.subject}`;

      // Get system domain from settings
      // Using ticket.tenantId for domain context
      const domain = await this.settingsService.getDomain(ticket.tenantId);

      // Generate threading headers for message replies
      const originalMessageId = `<ticket-${ticket.id}-created-${ticket.createdAt.getTime()}@${domain}>`;
      const newMessageId = `<ticket-${ticket.id}-message-${message.id}-${Date.now()}@${domain}>`;

      // Reply-To address for email threading
      const ticketReplyAddress = `ticket-${ticket.id}@${domain}`;

      // Get site settings for email template
      // Using ticket.tenantId for branding
      const siteSettings = await this.settingsService.getSiteSettings(ticket.tenantId);

      await this.mailService.sendMail({
        to: { email: recipient.email, name: `${recipient.firstName} ${recipient.lastName}` },
        subject,
        template: 'ticket-new-message',
        channel: MailChannel.TRANSACTIONAL,
        replyTo: { email: ticketReplyAddress, name: `Ticket ${ticket.displayNumber}` },
        headers: {
          'Message-ID': newMessageId,
          'In-Reply-To': originalMessageId,
          'References': originalMessageId,
          'X-Ticket-ID': ticket.id.toString(),
        },
        context: {
          recipientName: `${recipient.firstName} ${recipient.lastName}` || recipient.email,
          senderName: message.author ? `${message.author.firstName} ${message.author.lastName}` : 'Destek Ekibi',
          displayNumber: ticket.displayNumber,
          subject: ticket.subject,
          messageContent: message.content,
          ticketUrl,
          isCustomer: !isCustomerMessage, // Recipient is customer if message was sent by support
          siteSettings,
        },
      });

      this.logger.log(`New message email sent to ${recipient.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send new message email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email when a ticket is resolved (with CSAT survey)
   */
  async sendTicketResolved(
    ticket: Ticket,
    surveyToken?: string,
  ): Promise<void> {
    try {
      const customer = ticket.user; // ticket.user is the creator (customer)
      const ticketUrl = `${this.baseUrl}/portal/support/${ticket.id}`;
      const surveyUrl = surveyToken
        ? `${this.baseUrl}/survey/${surveyToken}`
        : null;

      await this.mailService.sendMail({
        to: { email: customer.email, name: `${customer.firstName} ${customer.lastName}` },
        subject: `Ticket Resolved: ${ticket.subject}`,
        template: 'csat-survey',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          customerName: `${customer.firstName} ${customer.lastName}` || customer.email,
          ticketTitle: ticket.subject,
          ticketId: ticket.id,
          surveyUrl,
          agentName: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Destek Ekibi',
          siteSettings: {
            siteName: process.env.SITE_NAME || 'Aluplan',
            siteUrl: this.baseUrl,
            supportEmail: process.env.SUPPORT_EMAIL || 'support@example.com',
          },
        },
      });

      this.logger.log(`Ticket resolved email with CSAT survey sent to ${customer.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket resolved email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * DEPRECATED: Use sendTicketResolved instead
   * Send email when a ticket is resolved
   */
  async sendTicketResolvedEmail(
    ticket: Ticket,
    customer: User,
    resolvedBy: User,
  ): Promise<void> {
    try {
      const ticketUrl = `${this.baseUrl}/portal/support/${ticket.id}`;
      const feedbackUrl = `${this.baseUrl}/portal/support/${ticket.id}/feedback`;

      await this.mailService.sendMail({
        to: { email: customer.email, name: `${customer.firstName} ${customer.lastName}` },
        subject: `Ticket Resolved: ${ticket.subject}`,
        template: 'ticket-resolved',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          customerName: `${customer.firstName} ${customer.lastName}` || customer.email,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          resolvedByName: `${resolvedBy.firstName} ${resolvedBy.lastName}` || 'Support Team',
          resolutionTime: ticket.resolutionTimeHours,
          ticketUrl,
          feedbackUrl,
        },
      });

      this.logger.log(`Ticket resolved email sent to ${customer.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket resolved email: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send SLA breach alert to support team
   */
  async sendSLABreachAlert(
    ticket: Ticket,
    breachType: 'first_response' | 'resolution',
  ): Promise<void> {
    try {
      const supportEmail = process.env.SUPPORT_TEAM_EMAIL || 'support@example.com';
      const ticketUrl = `${this.baseUrl}/admin/support/${ticket.id}`;

      await this.mailService.sendMail({
        to: { email: supportEmail, name: 'Support Team' },
        subject: `⚠️ SLA Breach Alert: ${ticket.subject}`,
        template: 'sla-breach-alert',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          ticketPriority: ticket.priority,
          breachType,
          ticketUrl,
          assignedTo: ticket.assignedTo ? `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` : 'Unassigned',
        },
      });

      this.logger.log(`SLA breach alert sent for ticket ${ticket.id}`);
    } catch (error) {
      this.logger.error(
        `Failed to send SLA breach alert: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send SLA approaching alert (proactive notification)
   */
  async sendSLAApproachingAlert(
    ticket: Ticket,
    remainingHours: number,
  ): Promise<void> {
    try {
      if (!ticket.assignedTo) {
        this.logger.warn(
          `Ticket ${ticket.id} has no assigned agent for SLA alert`,
        );
        return;
      }

      const ticketUrl = `${this.baseUrl}/admin/support/${ticket.id}`;

      await this.mailService.sendMail({
        to: { email: ticket.assignedTo.email, name: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` },
        subject: `⏰ SLA Alert: ${ticket.subject} - ${remainingHours}h remaining`,
        template: 'sla-approaching-alert',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          agentName: `${ticket.assignedTo.firstName} ${ticket.assignedTo.lastName}` || ticket.assignedTo.email,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          ticketPriority: ticket.priority,
          remainingHours,
          ticketUrl,
        },
      });

      this.logger.log(
        `SLA approaching alert sent to ${ticket.assignedTo.email}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to send SLA approaching alert: ${error.message}`,
        error.stack,
      );
    }
  }

  /**
   * Send email when ticket is escalated
   */
  async sendTicketEscalatedEmail(
    ticket: Ticket,
    escalatedTo: User,
    escalationLevel: number,
    reason: string,
  ): Promise<void> {
    try {
      const ticketUrl = `${this.baseUrl}/admin/support/${ticket.id}`;

      await this.mailService.sendMail({
        to: { email: escalatedTo.email, name: `${escalatedTo.firstName} ${escalatedTo.lastName}` },
        subject: `🚨 Escalated Ticket (Level ${escalationLevel}): ${ticket.subject}`,
        template: 'ticket-escalated',
        channel: MailChannel.TRANSACTIONAL,
        context: {
          agentName: `${escalatedTo.firstName} ${escalatedTo.lastName}` || escalatedTo.email,
          ticketId: ticket.id,
          ticketSubject: ticket.subject,
          ticketPriority: ticket.priority,
          escalationLevel,
          reason,
          ticketUrl,
        },
      });

      this.logger.log(`Ticket escalation email sent to ${escalatedTo.email}`);
    } catch (error) {
      this.logger.error(
        `Failed to send ticket escalation email: ${error.message}`,
        error.stack,
      );
    }
  }
}
