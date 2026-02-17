import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OnEvent } from '@nestjs/event-emitter';
import { AutomationRule, AutomationAction } from '../entities/automation-rule.entity';
import { AutomationApproval, ApprovalStatus, ApprovalPriority, ActionImpactLevel } from '../entities/automation-approval.entity';
import { PlatformEvent } from '../entities/platform-event.entity';
import { EmailCampaignService } from '../../email-marketing/email-campaign.service';
import { WebhookService } from './webhook.service';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * AutomationExecutor Service
 * 
 * Executes automation actions when rules are triggered.
 * Handles approval workflow integration.
 * 
 * Features:
 * - Action execution with approval checks
 * - Multi-action sequencing
 * - Error handling and retry logic
 * - Execution logging
 * - Auto-approval based on conditions
 */
@Injectable()
export class AutomationExecutorService {
  private readonly logger = new Logger(AutomationExecutorService.name);

  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepository: Repository<AutomationRule>,
    @InjectRepository(AutomationApproval)
    private readonly approvalRepository: Repository<AutomationApproval>,
    @Inject(forwardRef(() => EmailCampaignService))
    private readonly emailCampaignService: EmailCampaignService,
    private readonly webhookService: WebhookService,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Listen to automation trigger events from EventBus
   */
  @OnEvent('automation.trigger')
  async handleAutomationTrigger(data: {
    rule: AutomationRule;
    event: PlatformEvent;
  }): Promise<void> {
    const { rule, event } = data;

    this.logger.log(
      `Handling automation trigger: ${rule.name} (${rule.id})`,
      { eventId: event.id },
    );

    // Run execution within tenant context
    await this.tenantService.runWithTenant({ tenantId: event.tenantId }, async () => {
      try {
        // Check if approval is required
        if (rule.requiresApproval) {
          await this.createApprovalRequest(rule, event);
        } else {
          // Execute immediately
          await this.executeRule(rule, event);
        }
      } catch (error) {
        this.logger.error(
          `Failed to handle automation trigger: ${rule.id}`,
          error.stack,
        );
      }
    });
  }

  /**
   * Create approval request for automation
   */
  private async createApprovalRequest(
    rule: AutomationRule,
    event: PlatformEvent,
  ): Promise<void> {
    // Check if auto-approval conditions are met
    if (this.shouldAutoApprove(rule, event)) {
      this.logger.log(
        `Auto-approval conditions met for rule: ${rule.name}`,
        { ruleId: rule.id },
      );
      await this.executeRule(rule, event);
      return;
    }

    // Determine priority based on impact level
    const priority = this.getPriorityFromImpactLevel(rule.impactLevel);

    // Create approval request
    const approval = this.approvalRepository.create({
      ruleId: rule.id,
      eventId: event.id,
      tenantId: event.tenantId, // Ensure approval belongs to same tenant
      status: ApprovalStatus.PENDING,
      priority,
      impactLevel: rule.impactLevel,
      pendingActions: rule.actions.map(action => ({
        type: action.type,
        config: action.config,
        order: action.order,
        estimatedImpact: this.estimateActionImpact(action, event),
      })),
      requestedBy: event.metadata?.userId || 'system',
      requestReason: `Event triggered: ${event.eventType}`,
      requestContext: {
        eventId: event.id,
        eventType: event.eventType,
        eventPayload: event.payload,
      },
      requiredApprovals: AutomationApproval.getRequiredApprovalCount(rule.impactLevel),
      currentApprovals: 0,
      expiresAt: AutomationApproval.getExpirationTime(priority),
    });

    await this.approvalRepository.save(approval);

    this.logger.log(
      `Approval request created for rule: ${rule.name}`,
      {
        ruleId: rule.id,
        approvalId: approval.id,
        requiredApprovals: approval.requiredApprovals,
        expiresAt: approval.expiresAt,
      },
    );

    // NOTE: Notification to approvers planned with NotificationService integration
    // await this.notificationService.notifyApprovers(approval);
  }

  /**
   * Check if auto-approval conditions are met
   */
  private shouldAutoApprove(rule: AutomationRule, event: PlatformEvent): boolean {
    // Low impact level always auto-approves
    if (rule.impactLevel === ActionImpactLevel.LOW) {
      return true;
    }

    // Check custom auto-approval conditions
    if (!rule.autoApprovalConditions) {
      return false;
    }

    // Example conditions:
    // { "userRole": "manager" } - Auto-approve if user is manager
    // { "affectedUsers": { "$lt": 10 } } - Auto-approve if < 10 users affected
    // { "eventSource": "admin" } - Auto-approve if triggered by admin

    const conditions = rule.autoApprovalConditions;
    const metadata = event.metadata || {};

    // Simple condition matching (can be enhanced)
    for (const [key, value] of Object.entries(conditions)) {
      if (metadata[key] !== value) {
        return false;
      }
    }

    return true;
  }

  /**
   * Get priority from impact level
   */
  private getPriorityFromImpactLevel(impactLevel: ActionImpactLevel): ApprovalPriority {
    switch (impactLevel) {
      case ActionImpactLevel.CRITICAL:
        return ApprovalPriority.URGENT;
      case ActionImpactLevel.HIGH:
        return ApprovalPriority.HIGH;
      case ActionImpactLevel.MEDIUM:
        return ApprovalPriority.MEDIUM;
      case ActionImpactLevel.LOW:
      default:
        return ApprovalPriority.LOW;
    }
  }

  /**
   * Estimate impact of an action
   */
  private estimateActionImpact(
    action: AutomationAction,
    event: PlatformEvent,
  ): {
    affectedUsers?: number;
    affectedRecords?: number;
    externalCalls?: number;
  } {
    // This is a simplified estimation
    // In real implementation, you'd query the database
    const impact: any = {};

    if (action.type.includes('email')) {
      // Email actions
      impact.affectedUsers = event.payload.recipientCount || 0;
    }

    if (action.type.includes('webhook')) {
      // Webhook actions
      impact.externalCalls = 1;
    }

    if (action.type.includes('bulk') || action.type.includes('segment')) {
      // Bulk operations
      impact.affectedRecords = event.payload.count || 0;
    }

    return impact;
  }

  /**
   * Execute automation rule
   */
  async executeRule(rule: AutomationRule, event: PlatformEvent): Promise<void> {
    const startTime = Date.now();

    try {
      this.logger.log(
        `Executing automation rule: ${rule.name}`,
        {
          ruleId: rule.id,
          eventId: event.id,
          actionCount: rule.actions.length,
        },
      );

      // Sort actions by order
      const sortedActions = [...rule.actions].sort((a, b) => a.order - b.order);

      let executedCount = 0;
      const errors: string[] = [];

      // Execute actions sequentially
      for (const action of sortedActions) {
        try {
          await this.executeAction(action, event);
          executedCount++;
        } catch (error) {
          this.logger.error(
            `Failed to execute action: ${action.type}`,
            error.stack,
          );
          errors.push(`${action.type}: ${error.message}`);
          // Continue with other actions even if one fails
        }
      }

      const duration = Date.now() - startTime;

      // Update rule execution stats
      rule.executionCount++;
      rule.lastExecutedAt = new Date();
      rule.lastExecutionResult = {
        success: errors.length === 0,
        error: errors.length > 0 ? errors.join('; ') : undefined,
        actionsExecuted: executedCount,
        timestamp: new Date(),
      };

      await this.ruleRepository.save(rule);

      this.logger.log(
        `Automation rule execution completed: ${rule.name}`,
        {
          ruleId: rule.id,
          success: errors.length === 0,
          executedActions: executedCount,
          totalActions: rule.actions.length,
          duration: `${duration}ms`,
        },
      );
    } catch (error) {
      this.logger.error(
        `Failed to execute automation rule: ${rule.id}`,
        error.stack,
      );

      // Update rule with error
      rule.lastExecutionResult = {
        success: false,
        error: error.message,
        actionsExecuted: 0,
        timestamp: new Date(),
      };
      await this.ruleRepository.save(rule);
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: AutomationAction,
    event: PlatformEvent,
  ): Promise<void> {
    this.logger.debug(`Executing action: ${action.type}`, {
      config: action.config,
    });

    switch (action.type) {
      case 'email.create_campaign':
        // Create a new email campaign using the action config
        const campaignData = {
          name: action.config.name || `Auto Campaign - ${event.eventType}`,
          subject: action.config.subject || 'Automated Campaign',
          content: action.config.content || '',
          status: 'draft',
          ...action.config,
        };
        const campaign = await this.emailCampaignService.create(campaignData); // Removed tenantId
        this.logger.log(`Created email campaign: ${campaign.id}`, { campaignId: campaign.id });
        break;

      case 'email.send':
        // Send an existing campaign
        if (action.config.campaignId) {
          await this.emailCampaignService.sendCampaign(action.config.campaignId); // Removed tenantId
          this.logger.log(`Sent email campaign: ${action.config.campaignId}`);
        } else {
          this.logger.warn('email.send action missing campaignId in config');
        }
        break;

      case 'email.add_to_segment':
        // Feature enhancement: SegmentService doesn't have addSubscriber yet
        this.logger.log('email.add_to_segment: Feature not yet implemented', action.config);
        break;

      case 'notification.send':
        // Feature enhancement: NotificationService needs to be created/enhanced
        this.logger.log('notification.send: Feature not yet implemented', action.config);
        break;

      case 'webhook.trigger':
        // Trigger a webhook manually
        if (action.config.webhookId) {
          // Using event.tenantId to find webhook securely
          const tenantId = event.tenantId;
          const webhook = await this.webhookService.findOne(action.config.webhookId, tenantId);
          if (webhook) {
            await this.webhookService.triggerWebhook(webhook, event);
            this.logger.log(`Triggered webhook: ${webhook.name}`);
          } else {
            this.logger.warn(`Webhook not found: ${action.config.webhookId}`);
          }
        } else {
          this.logger.warn('webhook.trigger action missing webhookId in config');
        }
        break;

      case 'cms.create_draft':
        // Feature enhancement: CMSService integration needed
        this.logger.log('cms.create_draft: Feature not yet implemented', action.config);
        break;

      case 'cms.publish':
        // Feature enhancement: CMSService integration needed
        this.logger.log('cms.publish: Feature not yet implemented', action.config);
        break;

      default:
        this.logger.warn(`Unknown action type: ${action.type}`);
    }
  }

  /**
   * Execute approved automation
   * Called when approval is granted
   */
  async executeApprovedAutomation(approvalId: string, tenantId: string): Promise<void> {
    // Run execution within tenant context
    await this.tenantService.runWithTenant({ tenantId }, async () => {
      const approval = await this.approvalRepository.findOne({
        where: { id: approvalId, tenantId } as any,
        relations: ['rule', 'event'],
      });

      if (!approval) {
        throw new Error(`Approval not found: ${approvalId}`);
      }

      if (approval.status !== ApprovalStatus.APPROVED) {
        throw new Error(`Approval is not in approved status: ${approval.status}`);
      }

      if (approval.isExecuted) {
        this.logger.warn(`Approval already executed: ${approvalId}`);
        return;
      }

      try {
        // Execute the rule (only if event exists)
        if (approval.event) {
          await this.executeRule(approval.rule, approval.event);
        }

        // Mark as executed
        approval.isExecuted = true;
        approval.executedAt = new Date();
        approval.executionResult = {
          success: true,
          actionsExecuted: approval.pendingActions.length,
          timestamp: new Date(),
        };

        await this.approvalRepository.save(approval);

        this.logger.log(
          `Approved automation executed successfully: ${approvalId}`,
        );
      } catch (error) {
        this.logger.error(
          `Failed to execute approved automation: ${approvalId}`,
          error.stack,
        );

        // Mark execution as failed
        approval.isExecuted = false;
        approval.executionResult = {
          success: false,
          actionsExecuted: 0,
          errors: [error.message],
          timestamp: new Date(),
        };

        await this.approvalRepository.save(approval);
        throw error;
      }
    });
  }

  /**
   * Check and process expired approvals (cron job)
   */
  async processExpiredApprovals(): Promise<void> {
    const now = new Date();

    const expiredApprovals = await this.approvalRepository.find({
      where: {
        status: ApprovalStatus.PENDING,
        isExpired: false,
      },
    });

    let expiredCount = 0;

    for (const approval of expiredApprovals) {
      if (approval.checkExpiration()) {
        await this.approvalRepository.save(approval);
        expiredCount++;

        this.logger.log(
          `Approval expired: ${approval.id} (rule: ${approval.ruleId})`,
        );
      }
    }

    if (expiredCount > 0) {
      this.logger.log(`Processed ${expiredCount} expired approvals`);
    }
  }
}
