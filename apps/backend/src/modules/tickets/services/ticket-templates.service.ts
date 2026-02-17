import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTemplate } from '../entities/ticket-template.entity';
import { TenantService } from '../../../core/tenant/tenant.service';

/**
 * Ticket Templates Service
 * Manages pre-defined ticket templates for common issues
 */
@Injectable()
export class TicketTemplatesService {
  private readonly logger = new Logger(TicketTemplatesService.name);

  constructor(
    @InjectRepository(TicketTemplate)
    private readonly templateRepository: Repository<TicketTemplate>,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getActiveTenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Get all active templates
   */
  async findAll(isPublic?: boolean): Promise<TicketTemplate[]> {
    const tenantId = this.getActiveTenantId();
    const query: any = { isActive: true, tenantId };

    if (isPublic !== undefined) {
      query.isPublic = isPublic;
    }

    return this.templateRepository.find({
      where: query,
      relations: ['category', 'createdBy'],
      order: { usageCount: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Get template by ID
   */
  async findOne(id: string): Promise<TicketTemplate> {
    const tenantId = this.getActiveTenantId();
    const template = await this.templateRepository.findOne({
      where: { id, tenantId },
      relations: ['category', 'createdBy'],
    });

    if (!template) {
      throw new NotFoundException(`Template not found: ${id}`);
    }

    return template;
  }

  /**
   * Create new template
   */
  async create(data: Partial<TicketTemplate>): Promise<TicketTemplate> {
    const tenantId = this.getActiveTenantId();
    const template = this.templateRepository.create({
      ...data,
      tenantId, // Explicitly set tenantId
    });
    const savedTemplate = await this.templateRepository.save(template);

    this.logger.log(`Created template: ${savedTemplate.name} (${savedTemplate.id})`);

    return this.findOne(savedTemplate.id);
  }

  /**
   * Update template
   */
  async update(id: string, data: Partial<TicketTemplate>): Promise<TicketTemplate> {
    const template = await this.findOne(id);

    Object.assign(template, data);
    await this.templateRepository.save(template);

    this.logger.log(`Updated template: ${template.name} (${id})`);

    return this.findOne(id);
  }

  /**
   * Delete template (soft delete by marking inactive)
   */
  async delete(id: string): Promise<void> {
    const template = await this.findOne(id);
    template.isActive = false;
    await this.templateRepository.save(template);

    this.logger.log(`Deleted template: ${template.name} (${id})`);
  }

  /**
   * Toggle template active status
   */
  async toggle(id: string): Promise<TicketTemplate> {
    const template = await this.findOne(id);
    template.isActive = !template.isActive;
    await this.templateRepository.save(template);

    this.logger.log(`Toggled template: ${template.name} (${id}) to ${template.isActive}`);

    return this.findOne(id);
  }

  /**
   * Increment template usage count
   */
  async incrementUsage(id: string): Promise<void> {
    const template = await this.findOne(id);
    template.usageCount += 1;
    await this.templateRepository.save(template);

    this.logger.log(`Incremented usage count for template: ${template.name} (${id})`);
  }

  /**
   * Get templates by category
   */
  async findByCategory(categoryId: string): Promise<TicketTemplate[]> {
    const tenantId = this.getActiveTenantId();
    return this.templateRepository.find({
      where: { categoryId, isActive: true, tenantId },
      relations: ['category', 'createdBy'],
      order: { usageCount: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Get user's private templates
   */
  async findByUser(userId: string): Promise<TicketTemplate[]> {
    const tenantId = this.getActiveTenantId();
    return this.templateRepository.find({
      where: { createdById: userId, isActive: true, tenantId },
      relations: ['category'],
      order: { usageCount: 'DESC', name: 'ASC' },
    });
  }

  /**
   * Get popular templates (top 10 by usage)
   */
  async getPopular(limit: number = 10): Promise<TicketTemplate[]> {
    const tenantId = this.getActiveTenantId();
    return this.templateRepository.find({
      where: { isActive: true, isPublic: true, tenantId },
      relations: ['category', 'createdBy'],
      order: { usageCount: 'DESC' },
      take: limit,
    });
  }

  /**
   * Search templates by name or content
   */
  async search(query: string): Promise<TicketTemplate[]> {
    const tenantId = this.getActiveTenantId();
    return this.templateRepository
      .createQueryBuilder('template')
      .leftJoinAndSelect('template.category', 'category')
      .leftJoinAndSelect('template.createdBy', 'createdBy')
      .where('template.tenantId = :tenantId', { tenantId })
      .andWhere('template.isActive = :isActive', { isActive: true })
      .andWhere(
        '(template.name ILIKE :query OR template.subject ILIKE :query OR template.content ILIKE :query)',
        { query: `%${query}%` },
      )
      .orderBy('template.usageCount', 'DESC')
      .getMany();
  }
}
