import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from './entities/role.entity';
import { RoleTemplate } from './entities/role-template.entity';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { TenantService } from '../../core/tenant/tenant.service';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role)
    private rolesRepository: Repository<Role>,
    @InjectRepository(RoleTemplate)
    private roleTemplateRepository: Repository<RoleTemplate>,
    private tenantService: TenantService,
  ) { }

  private getActiveTenantId(tenantId?: string): string {
    const id = tenantId || this.tenantService.getTenantId();
    if (!id) {
      throw new BadRequestException('Tenant context required');
    }
    return id;
  }

  async create(createRoleDto: CreateRoleDto, tenantId?: string): Promise<Role> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    // Check if role name already exists in this tenant
    const existingRole = await this.rolesRepository.findOne({
      where: { name: createRoleDto.name, tenantId: activeTenantId },
    });

    if (existingRole) {
      throw new ConflictException(`Role with name "${createRoleDto.name}" already exists in this tenant`);
    }

    const role = this.rolesRepository.create({
      ...createRoleDto,
      tenantId: activeTenantId,
      isCustom: true, // Custom roles created by tenant
    });

    return await this.rolesRepository.save(role);
  }

  async findAll(tenantId?: string): Promise<Role[]> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    return await this.rolesRepository.find({
      where: { tenantId: activeTenantId },
      relations: ['template'],
      order: {
        createdAt: 'DESC',
      },
    });
  }

  async findOne(id: string, tenantId?: string): Promise<Role> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.rolesRepository.findOne({
      where: { id, tenantId: activeTenantId },
      relations: ['template'],
    });

    if (!role) {
      throw new NotFoundException(`Role with ID "${id}" not found in this tenant`);
    }

    return role;
  }

  async findByName(name: string, tenantId?: string): Promise<Role | null> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    return await this.rolesRepository.findOne({
      where: { name, tenantId: activeTenantId },
    });
  }

  async update(id: string, updateRoleDto: UpdateRoleDto, tenantId?: string): Promise<Role> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.findOne(id, activeTenantId);

    // Prevent updating template-based roles' name (only custom roles can be renamed)
    if (!role.isCustom && updateRoleDto.name && updateRoleDto.name !== role.name) {
      throw new BadRequestException('Cannot change name of template-based roles');
    }

    // Check for name conflict if name is being updated
    if (updateRoleDto.name && updateRoleDto.name !== role.name) {
      const existingRole = await this.rolesRepository.findOne({
        where: { name: updateRoleDto.name, tenantId: activeTenantId },
      });

      if (existingRole) {
        throw new ConflictException(`Role with name "${updateRoleDto.name}" already exists in this tenant`);
      }
    }

    Object.assign(role, updateRoleDto);
    return await this.rolesRepository.save(role);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.findOne(id, activeTenantId);

    // Prevent deleting template-based roles (only custom roles can be deleted)
    if (!role.isCustom) {
      throw new BadRequestException('Cannot delete template-based roles');
    }

    // Check if role has users (would need to load userRoles relation)
    const roleWithUsers = await this.rolesRepository.findOne({
      where: { id, tenantId: activeTenantId },
      relations: ['userRoles'],
    });

    if (roleWithUsers?.userRoles && roleWithUsers.userRoles.length > 0) {
      throw new BadRequestException(
        `Cannot delete role "${role.displayName}" because it has ${roleWithUsers.userRoles.length} assigned user(s)`,
      );
    }

    await this.rolesRepository.remove(role);
  }

  async getPermissions(id: string, tenantId?: string): Promise<string[]> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.findOne(id, activeTenantId);
    return role.permissions || [];
  }

  async updatePermissions(id: string, permissions: string[], tenantId?: string): Promise<Role> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.findOne(id, activeTenantId);
    role.permissions = permissions;
    return await this.rolesRepository.save(role);
  }

  async getUserCount(id: string, tenantId?: string): Promise<number> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const role = await this.rolesRepository.findOne({
      where: { id, tenantId: activeTenantId },
      relations: ['userRoles'],
    });
    return role?.userRoles ? role.userRoles.length : 0;
  }

  /**
   * Find multiple roles by their IDs within a tenant
   * NEW: Added for multi-role support
   */
  async findByIds(ids: string[], tenantId: string): Promise<Role[]> {
    if (!ids || ids.length === 0) {
      return [];
    }

    return this.rolesRepository.find({
      where: ids.map(id => ({ id, tenantId })),
    });
  }
}
