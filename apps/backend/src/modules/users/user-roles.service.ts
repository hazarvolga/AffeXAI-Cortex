import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole } from './entities/user-role.entity';
import { User } from './entities/user.entity';
import { Role } from '../roles/entities/role.entity';
import { RolesService } from '../roles/roles.service';

/**
 * UserRolesService
 *
 * Handles multi-role assignment and management for users.
 * Supports primary role designation and audit trail.
 */
@Injectable()
export class UserRolesService {
  constructor(
    @InjectRepository(UserRole)
    private userRolesRepository: Repository<UserRole>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private rolesService: RolesService,
  ) { }

  /**
   * Assign roles to a user
   * @param userId User ID
   * @param primaryRoleId Primary role ID
   * @param additionalRoleIds Additional role IDs (optional)
   * @param replaceExisting Replace all existing roles (default: true)
   * @param assignedBy User ID who is assigning roles (for audit trail)
   */
  async assignRoles(
    userId: string,
    primaryRoleId: string,
    additionalRoleIds: string[] = [],
    replaceExisting: boolean = true,
    assignedBy?: string,
    tenantId?: string,
  ): Promise<UserRole[]> {
    console.log(`🔄 Assigning roles to user ${userId}:`, {
      primaryRoleId,
      additionalRoleIds,
      replaceExisting,
      assignedBy,
    });

    // Validate user exists
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Resolve tenantId if not provided
    // Multi-Tenancy: Fail-fast if tenantId missing (no 'default' fallback)
    const resolvedTenantId = tenantId || user.tenantId;
    if (!resolvedTenantId) {
      throw new BadRequestException('Tenant context required for role assignment');
    }

    // Validate all role IDs exist
    const allRoleIds = [primaryRoleId, ...additionalRoleIds];
    const roles = await this.rolesService.findByIds(allRoleIds, resolvedTenantId);

    if (roles.length !== allRoleIds.length) {
      const foundIds = roles.map(r => r.id);
      const missingIds = allRoleIds.filter(id => !foundIds.includes(id));
      throw new NotFoundException(`Roles not found: ${missingIds.join(', ')}`);
    }

    // Validate primary role exists in the list
    if (!roles.find(r => r.id === primaryRoleId)) {
      throw new BadRequestException(`Primary role "${primaryRoleId}" not found`);
    }

    // Remove existing roles if replaceExisting is true
    if (replaceExisting) {
      await this.userRolesRepository.delete({ userId, tenantId } as any);
      console.log(`🗑️  Removed existing roles for user ${userId}`);
    }

    // Prepare user roles
    const userRolesToCreate: Partial<UserRole>[] = [];

    // Add primary role
    userRolesToCreate.push({
      userId,
      roleId: primaryRoleId,
      isPrimary: true,
      assignedBy,
      tenantId,
    });

    // Add additional roles
    for (const roleId of additionalRoleIds) {
      userRolesToCreate.push({
        userId,
        roleId,
        isPrimary: false,
        assignedBy,
        tenantId,
      });
    }

    // Save all user roles
    const savedUserRoles = await this.userRolesRepository.save(userRolesToCreate);

    // Update legacy roleId field for backward compatibility
    // AND increment tokenVersion to invalidate old JWT tokens
    await this.usersRepository.update(userId, {
      roleId: primaryRoleId,
      tokenVersion: () => 'tokenVersion + 1'
    });

    console.log(`✅ Assigned ${savedUserRoles.length} role(s) to user ${userId}, tokenVersion incremented`);

    return savedUserRoles;
  }

  /**
   * Get all roles for a user
   */
  async getUserRoles(userId: string, tenantId?: string): Promise<UserRole[]> {
    return this.userRolesRepository.find({
      where: { userId, tenantId } as any,
      relations: ['role'],
      order: { isPrimary: 'DESC', assignedAt: 'ASC' },
    });
  }

  /**
   * Get primary role for a user
   */
  async getPrimaryRole(userId: string, tenantId?: string): Promise<UserRole | null> {
    return this.userRolesRepository.findOne({
      where: { userId, isPrimary: true, tenantId } as any,
      relations: ['role'],
    });
  }

  /**
   * Remove a specific role from a user
   */
  async removeRole(userId: string, roleId: string, tenantId?: string): Promise<void> {
    const userRole = await this.userRolesRepository.findOne({
      where: { userId, roleId, tenantId } as any,
    });

    if (!userRole) {
      throw new NotFoundException(`Role assignment not found`);
    }

    if (userRole.isPrimary) {
      throw new BadRequestException('Cannot remove primary role. Assign a new primary role first.');
    }

    await this.userRolesRepository.delete({ id: userRole.id });

    // Increment tokenVersion to invalidate old JWT tokens
    await this.usersRepository.update(userId, {
      tokenVersion: () => 'tokenVersion + 1'
    });

    console.log(`✅ Removed role ${roleId} from user ${userId}, tokenVersion incremented`);
  }

  /**
   * Check if user has a specific role
   */
  async userHasRole(userId: string, roleName: string): Promise<boolean> {
    const count = await this.userRolesRepository
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'role')
      .where('ur.userId = :userId', { userId })
      .andWhere('role.name = :roleName', { roleName })
      .getCount();

    return count > 0;
  }

  /**
   * Check if user has any of the specified roles
   */
  async userHasAnyRole(userId: string, roleNames: string[]): Promise<boolean> {
    const count = await this.userRolesRepository
      .createQueryBuilder('ur')
      .innerJoin('ur.role', 'role')
      .where('ur.userId = :userId', { userId })
      .andWhere('role.name IN (:...roleNames)', { roleNames })
      .getCount();

    return count > 0;
  }

  /**
   * Get all users with a specific role
   */
  async getUsersByRole(roleId: string, tenantId?: string): Promise<User[]> {
    const where: any = { roleId };
    if (tenantId) where.tenantId = tenantId;

    const userRoles = await this.userRolesRepository.find({
      where,
      relations: ['user'],
    });

    return userRoles.map(ur => ur.user);
  }

  /**
   * Count users with a specific role
   */
  async countUsersByRole(roleId: string, tenantId?: string): Promise<number> {
    const where: any = { roleId };
    if (tenantId) where.tenantId = tenantId;

    return this.userRolesRepository.count({
      where,
    });
  }
}
