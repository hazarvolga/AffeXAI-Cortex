import { Controller, Get, Post, Put, Delete, Body, Param } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../core/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../core/auth/decorators/current-user.decorator';
import { User } from '../../users/entities/user.entity';
import { AutomationRule } from '../entities/automation-rule.entity';

/**
 * Automation Rules Controller
 * 
 * CRUD operations for automation rules.
 */
@Controller('automation/rules')
@UseGuards(JwtAuthGuard)
export class AutomationRulesController {
  constructor(
    @InjectRepository(AutomationRule)
    private readonly ruleRepository: Repository<AutomationRule>,
  ) { }

  /**
   * Get all automation rules
   */
  @Get()
  async findAll(@CurrentUser() user: User) {
    return this.ruleRepository.find({
      where: { tenantId: user.tenantId } as any,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get active automation rules
   */
  @Get('active')
  async findActive(@CurrentUser() user: User) {
    return this.ruleRepository.find({
      where: { isActive: true, tenantId: user.tenantId } as any,
      order: { priority: 'DESC' },
    });
  }

  /**
   * Get automation rule by ID
   */
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: User) {
    return this.ruleRepository.findOne({ where: { id, tenantId: user.tenantId } as any });
  }

  /**
   * Create new automation rule
   */
  @Post()
  async create(@Body() data: Partial<AutomationRule>, @CurrentUser() user: User) {
    const rule = this.ruleRepository.create({
      ...data,
      tenantId: user.tenantId,
    });
    return this.ruleRepository.save(rule);
  }

  /**
   * Update automation rule
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() data: Partial<AutomationRule>,
    @CurrentUser() user: User,
  ) {
    await this.ruleRepository.update({ id, tenantId: user.tenantId } as any, data);
    return this.ruleRepository.findOne({ where: { id, tenantId: user.tenantId } as any });
  }

  /**
   * Delete automation rule (soft delete)
   */
  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: User) {
    await this.ruleRepository.softDelete({ id, tenantId: user.tenantId } as any);
    return { success: true };
  }

  /**
   * Toggle rule active status
   */
  @Put(':id/toggle')
  async toggle(@Param('id') id: string, @CurrentUser() user: User) {
    const rule = await this.ruleRepository.findOne({ where: { id, tenantId: user.tenantId } as any });
    if (!rule) {
      throw new Error(`Rule not found: ${id}`);
    }

    rule.isActive = !rule.isActive;
    return this.ruleRepository.save(rule);
  }
}
