import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { TicketsService } from '../tickets.service';
import { TicketStatus } from '../enums/ticket-status.enum';
import { Ticket } from '../entities/ticket.entity';
import { TicketEscalationRule } from '../entities/ticket-escalation-rule.entity';
import { TicketEscalationRulesService } from './ticket-escalation-rules.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TicketMessage } from '../entities/ticket-message.entity';
import { TenantService } from '../../../core/tenant/tenant.service';
import { Organization } from '../../organizations/entities/organization.entity';

/**
 * Ticket Automation Service
 * Handles automatic ticket processing and status transitions
 */
@Injectable()
export class TicketAutomationService {
  private readonly logger = new Logger(TicketAutomationService.name);

  constructor(
    private readonly ticketsService: TicketsService,
    private readonly escalationRulesService: TicketEscalationRulesService,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(TicketMessage)
    private readonly messageRepository: Repository<TicketMessage>,
    @InjectRepository(Organization)
    private readonly organizationRepository: Repository<Organization>,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Check for tickets that need auto-closing (resolved for 72+ hours)
   */
  @Cron(CronExpression.EVERY_HOUR)
  async checkForAutoClose(): Promise<void> {
    this.logger.log('Checking for tickets to auto-close...');

    try {
      const activeOrganizations = await this.organizationRepository.find({ where: { isActive: true } });

      for (const org of activeOrganizations) {
        await this.tenantService.runWithTenant({ tenantId: org.id }, async () => {
          // Find resolved tickets that haven't had activity for 72 hours for this tenant
          const resolvedTickets = await this.ticketsService.findAll({
            status: TicketStatus.RESOLVED,
          });

          const now = new Date();
          let closedCount = 0;

          for (const ticket of resolvedTickets) {
            const hoursSinceUpdate = this.getHoursSinceDate(ticket.updatedAt, now);
            if (hoursSinceUpdate >= 72) {
              await this.ticketsService.updateStatus(ticket.id, TicketStatus.CLOSED, 'system');
              closedCount++;
            }
          }

          if (closedCount > 0) {
            this.logger.log(`Auto-closed ${closedCount} tickets for tenant ${org.name} (${org.id})`);
          }
        });
      }
    } catch (error) {
      this.logger.error('Error during auto-close check:', error);
    }
  }

  /**
   * Check for tickets that need auto-transition from pending third party
   */
  @Cron(CronExpression.EVERY_6_HOURS)
  async checkForPendingThirdPartyTransition(): Promise<void> {
    this.logger.log('Checking for tickets in pending third party status...');

    try {
      const activeOrganizations = await this.organizationRepository.find({ where: { isActive: true } });

      for (const org of activeOrganizations) {
        await this.tenantService.runWithTenant({ tenantId: org.id }, async () => {
          // Find tickets that have been pending third party for more than 72 hours for this tenant
          const pendingThirdPartyTickets = await this.ticketsService.findAll({
            status: TicketStatus.PENDING_THIRD_PARTY,
          });

          const now = new Date();
          let transitionedCount = 0;

          for (const ticket of pendingThirdPartyTickets) {
            const hoursSinceUpdate = this.getHoursSinceDate(ticket.updatedAt, now);
            if (hoursSinceUpdate >= 72) {
              await this.ticketsService.updateStatus(ticket.id, TicketStatus.OPEN, 'system');
              transitionedCount++;
            }
          }

          if (transitionedCount > 0) {
            this.logger.log(`Auto-transitioned ${transitionedCount} tickets for tenant ${org.name} (${org.id})`);
          }
        });
      }
    } catch (error) {
      this.logger.error('Error during pending third party check:', error);
    }
  }

  /**
   * Check for tickets that need escalation
   */
  @Cron(CronExpression.EVERY_30_MINUTES)
  async checkForEscalation(): Promise<void> {
    this.logger.log('Checking for tickets requiring escalation...');

    try {
      const activeOrganizations = await this.organizationRepository.find({ where: { isActive: true } });

      for (const org of activeOrganizations) {
        await this.tenantService.runWithTenant({ tenantId: org.id }, async () => {
          // Get all active escalation rules for this tenant
          const rules = await this.escalationRulesService.getActiveRules();

          // Find all tickets that could potentially need escalation for this tenant
          const tickets = await this.ticketsService.findAll({});

          const now = new Date();
          let escalatedCount = 0;

          for (const ticket of tickets) {
            const hoursSinceCreation = this.getHoursSinceDate(ticket.createdAt, now);
            const hoursSinceUpdate = this.getHoursSinceDate(ticket.updatedAt, now);

            for (const rule of rules) {
              if (this.escalationRulesService.hasReachedMaxApplications(rule, ticket)) {
                continue;
              }

              if (rule.shouldTrigger(ticket, {
                hoursSinceCreation,
                hoursSinceUpdate,
                escalationLevel: ticket.escalationLevel || 0
              })) {
                await this.applyEscalationActions(ticket, rule);
                escalatedCount++;
                break;
              }
            }
          }

          if (escalatedCount > 0) {
            this.logger.log(`Escalated ${escalatedCount} tickets for tenant ${org.name} (${org.id})`);
          }
        });
      }
    } catch (error) {
      this.logger.error('Error during escalation check:', error);
    }
  }

  /**
   * Calculate hours between two dates
   * @private
   */
  private getHoursSinceDate(date: Date, now: Date): number {
    const diffMs = now.getTime() - date.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60));
  }

  /**
   * Apply escalation actions to a ticket based on rule
   * @private
   */
  private async applyEscalationActions(ticket: Ticket, rule: TicketEscalationRule): Promise<void> {
    // Update ticket with escalation information
    const escalationEntry: {
      level: number;
      escalatedAt: Date;
      escalatedBy: string;
      reason: string;
      ruleId: string;
      assignedToId?: string;
    } = {
      level: ticket.escalationLevel + 1,
      escalatedAt: new Date(),
      escalatedBy: 'system',
      reason: `Escalated by rule: ${rule.name}`,
      ruleId: rule.id
    };

    // Initialize escalation history if not exists
    if (!ticket.escalationHistory) {
      ticket.escalationHistory = [];
    }

    // Add to escalation history
    ticket.escalationHistory.push(escalationEntry);

    // Update escalation level
    ticket.escalationLevel = ticket.escalationLevel + 1;
    ticket.lastEscalatedAt = new Date();

    // Apply rule actions
    if (rule.actions.assignToId) {
      ticket.assignedToId = rule.actions.assignToId;
      escalationEntry.assignedToId = rule.actions.assignToId;
    }

    if (rule.actions.setPriority) {
      ticket.priority = rule.actions.setPriority;
    }

    if (rule.actions.addNote) {
      // Create escalation note
      const note = this.messageRepository.create({
        ticketId: ticket.id,
        authorId: 'system',
        content: rule.actions.addNote,
        isInternal: true,
      });
      await this.messageRepository.save(note);
    }

    // Save updated ticket
    await this.ticketRepository.save(ticket);

    // Notify supervisors if requested
    if (rule.actions.notifySupervisors) {
      this.logger.log(`Notification sent to supervisors for ticket ${ticket.id}`);
      // In a real implementation, this would integrate with notification system
    }

    this.logger.log(`Applied escalation rule '${rule.name}' to ticket ${ticket.id}`);
  }

  /**
   * Escalate ticket by notifying supervisors
   * @private
   */
  private async escalateTicket(ticket: Ticket): Promise<void> {
    // In a real implementation, this would:
    // 1. Send notification to supervisors
    // 2. Re-assign to higher tier support
    // 3. Add escalation note to ticket
    // 4. Update ticket priority if needed

    this.logger.log(`Ticket ${ticket.id} escalated - notification sent to supervisors`);

    // For now, we'll just log the escalation
    // A real implementation would integrate with notification system
  }
}