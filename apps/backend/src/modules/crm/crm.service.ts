import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CrmCustomer } from './entities/crm-customer.entity';
import { CreateCrmCustomerDto } from './dto/create-crm-customer.dto';
import { TenantService } from '../../core/tenant/tenant.service';

@Injectable()
export class CrmService {
  constructor(
    @InjectRepository(CrmCustomer)
    private crmCustomerRepository: Repository<CrmCustomer>,
    private readonly tenantService: TenantService,
  ) { }

  private get tenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Check if email exists in CRM database within a tenant
   * Used during signup to auto-assign customer role
   */
  async isCustomerEmail(email: string): Promise<boolean> {
    const customer = await this.crmCustomerRepository.findOne({
      where: { email: email.toLowerCase(), isActive: true, tenantId: this.tenantId },
    });
    return !!customer;
  }

  /**
   * Get CRM customer by email within a tenant
   */
  async findByEmail(email: string): Promise<CrmCustomer | null> {
    return this.crmCustomerRepository.findOne({
      where: { email: email.toLowerCase(), tenantId: this.tenantId },
    });
  }

  /**
   * Get all CRM customers for a tenant
   */
  async findAll(): Promise<CrmCustomer[]> {
    return this.crmCustomerRepository.find({
      where: { tenantId: this.tenantId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get CRM customer by ID and tenant
   */
  async findOne(id: string): Promise<CrmCustomer> {
    const customer = await this.crmCustomerRepository.findOne({
      where: { id, tenantId: this.tenantId },
    });

    if (!customer) {
      throw new NotFoundException(`CRM customer with ID ${id} not found`);
    }

    return customer;
  }

  /**
   * Create a single CRM customer for a tenant
   */
  async create(createDto: CreateCrmCustomerDto): Promise<CrmCustomer> {
    // Check for duplicate email within tenant
    const existing = await this.findByEmail(createDto.email);
    if (existing) {
      throw new ConflictException(`Email ${createDto.email} already exists in CRM`);
    }

    const customer = this.crmCustomerRepository.create({
      ...createDto,
      email: createDto.email.toLowerCase(),
      tenantId: this.tenantId,
    });

    return this.crmCustomerRepository.save(customer);
  }

  /**
   * Bulk import CRM customers for a tenant
   * Skips duplicates and returns stats
   */
  async bulkImport(customers: CreateCrmCustomerDto[]): Promise<{
    imported: number;
    skipped: number;
    errors: string[];
  }> {
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    // Use a transaction or just loop for simplicity, ensuring tenant context
    // This runs within the request context so this.tenantId is valid.
    for (const customerDto of customers) {
      try {
        // Check if already exists in tenant
        const existing = await this.findByEmail(customerDto.email);
        if (existing) {
          skipped++;
          continue;
        }

        // Create new customer
        await this.create(customerDto);
        imported++;
      } catch (error) {
        errors.push(`${customerDto.email}: ${error.message}`);
        skipped++;
      }
    }

    return { imported, skipped, errors };
  }

  /**
   * Update CRM customer
   */
  async update(id: string, updateDto: Partial<CreateCrmCustomerDto>): Promise<CrmCustomer> {
    const customer = await this.findOne(id);

    // Check email uniqueness if email is being updated
    if (updateDto.email && updateDto.email !== customer.email) {
      const existing = await this.findByEmail(updateDto.email);
      if (existing) {
        throw new ConflictException(`Email ${updateDto.email} already exists in CRM`);
      }
    }

    Object.assign(customer, updateDto);

    if (updateDto.email) {
      customer.email = updateDto.email.toLowerCase();
    }

    return this.crmCustomerRepository.save(customer);
  }

  /**
   * Delete CRM customer (soft delete - set isActive = false)
   */
  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    customer.isActive = false;
    await this.crmCustomerRepository.save(customer);
  }

  /**
   * Hard delete CRM customer
   */
  async hardDelete(id: string): Promise<void> {
    const customer = await this.findOne(id);
    await this.crmCustomerRepository.remove(customer);
  }

  /**
   * Get CRM statistics for a tenant
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
  }> {
    const total = await this.crmCustomerRepository.count({ where: { tenantId: this.tenantId } });
    const active = await this.crmCustomerRepository.count({ where: { isActive: true, tenantId: this.tenantId } });
    const inactive = total - active;

    return { total, active, inactive };
  }
}
