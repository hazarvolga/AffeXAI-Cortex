import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationApproval, ApprovalStatus } from '../entities/automation-approval.entity';
import { AutomationExecutorService } from '../services/automation-executor.service';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';

/**
 * Approvals Controller
 * 
 * Manage automation approval requests.
 */
@Controller('automation/approvals')
@UseGuards(JwtAuthGuard)
export class ApprovalsController {
  constructor(
    @InjectRepository(AutomationApproval)
    private readonly approvalRepository: Repository<AutomationApproval>,
    private readonly executorService: AutomationExecutorService,
  ) { }

  /**
   * Get all approval requests
   */
  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.approvalRepository.find({
      where: { tenantId: user.tenantId } as any,
      order: { createdAt: 'DESC' },
      relations: ['rule'],
    });
  }

  /**
   * Get pending approval requests
   */
  @Get('pending')
  async findPending(@CurrentUser() user: User) {
    return this.approvalRepository.find({
      where: { status: ApprovalStatus.PENDING, tenantId: user.tenantId } as any,
      order: { priority: 'ASC', createdAt: 'ASC' }, // Urgent first, then oldest
      relations: ['rule'],
    });
  }

  /**
   * Get approval request by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.approvalRepository.findOne({
      where: { id, tenantId: user.tenantId } as any,
      relations: ['rule', 'event'],
    });
  }

  /**
   * Approve automation request
   */
  @Post(':id/approve')
  async approve(
    @Param('id') id: string,
    @Body() body: { userId: string; userName: string; comment?: string },
    @CurrentUser() user: User,
  ) {
    const approval = await this.approvalRepository.findOne({
      where: { id, tenantId: user.tenantId } as any,
      relations: ['rule', 'event'],
    });

    if (!approval) {
      throw new Error(`Approval not found: ${id}`);
    }

    if (!approval.canApprove()) {
      throw new Error(`Approval cannot be granted: ${approval.status}`);
    }

    // Add approval to chain
    approval.addApproval(
      body.userId,
      body.userName,
      'approved',
      body.comment,
      // In real app, get IP from request
      undefined,
    );

    await this.approvalRepository.save(approval);

    // If fully approved, execute the automation
    if (approval.status === ApprovalStatus.APPROVED) {
      await this.executorService.executeApprovedAutomation(id, user.tenantId);
    }

    return approval;
  }

  /**
   * Reject automation request
   */
  @Post(':id/reject')
  async reject(
    @Param('id') id: string,
    @Body() body: { userId: string; userName: string; comment?: string },
    @CurrentUser() user: User,
  ) {
    const approval = await this.approvalRepository.findOne({
      where: { id, tenantId: user.tenantId } as any,
      relations: ['rule'],
    });

    if (!approval) {
      throw new Error(`Approval not found: ${id}`);
    }

    if (!approval.canApprove()) {
      throw new Error(`Approval cannot be rejected: ${approval.status}`);
    }

    // Add rejection to chain
    approval.addApproval(
      body.userId,
      body.userName,
      'rejected',
      body.comment,
      undefined,
    );

    await this.approvalRepository.save(approval);

    return approval;
  }

  /**
   * Get approval statistics
   */
  @Get('stats/overview')
  async getStats(@CurrentUser() user: User) {
    const all = await this.approvalRepository.find({ where: { tenantId: user.tenantId } as any });

    const pending = all.filter(a => a.status === ApprovalStatus.PENDING).length;
    const approved = all.filter(a => a.status === ApprovalStatus.APPROVED).length;
    const rejected = all.filter(a => a.status === ApprovalStatus.REJECTED).length;
    const expired = all.filter(a => a.status === ApprovalStatus.EXPIRED).length;

    return {
      total: all.length,
      pending,
      approved,
      rejected,
      expired,
    };
  }
}
