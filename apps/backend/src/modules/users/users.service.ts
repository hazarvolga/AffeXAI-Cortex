import { Injectable, NotFoundException, ConflictException, BadRequestException, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, FindOptionsWhere, ILike } from 'typeorm';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { FilterUsersDto } from './dto/filter-users.dto';
import { ChangeUserRoleDto } from './dto/change-user-role.dto';
import { CompleteProfileDto } from './dto/complete-profile.dto';
import { User } from './entities/user.entity';
import { AuthUtilsService } from '../../core/shared/auth-utils.service';
import { CacheService } from '../../core/shared/services/cache.service';
import { RolesService } from '../roles/roles.service';
import { UserRolesService } from './user-roles.service';
import { CrmService } from '../crm/crm.service';
import { UserEmailService } from './services/user-email.service';
import { TenantService } from '../../core/tenant/tenant.service';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private authUtilsService: AuthUtilsService,
    private cacheService: CacheService,
    private rolesService: RolesService,
    @Inject(forwardRef(() => UserRolesService))
    private userRolesService: UserRolesService,
    private crmService: CrmService,
    private userEmailService: UserEmailService,
    private tenantService: TenantService,
    private eventEmitter: EventEmitter2,
  ) { }

  async create(createUserDto: CreateUserDto, tenantId?: string): Promise<User> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    if (!activeTenantId) throw new BadRequestException('Tenant context required');

    try {
      // Check if email already exists (scoped to tenant)
      const existingUser = await this.findByEmail(createUserDto.email, activeTenantId, true);
      if (existingUser) {
        throw new ConflictException('User with this email already exists');
      }

      // If no roleId provided, assign default viewer role
      if (!createUserDto.roleId) {
        try {
          // Multi-Tenancy: Use activeTenantId (already validated on line 37)
          const roles = await this.rolesService.findAll(activeTenantId);
          const viewerRole = roles.find(r => r.name === 'viewer');
          if (viewerRole) {
            createUserDto.roleId = viewerRole.id;
          } else {
            console.error('❌ Viewer role not found in database');
            throw new BadRequestException('Default viewer role not found. Please contact administrator.');
          }
        } catch (roleError) {
          console.error('❌ Error fetching roles:', roleError);
          throw new BadRequestException('Unable to assign default role. Please try again later.');
        }
      }


      // Hash the password before saving
      const hashedPassword = await this.authUtilsService.hashPassword(createUserDto.password);
      const user = this.usersRepository.create({
        ...createUserDto,
        password: hashedPassword,
        tenantId: activeTenantId, // Assign tenantId
      });

      console.log('✓ Creating user with data:', {
        email: user.email,
        roleId: user.roleId,
        firstName: user.firstName,
        lastName: user.lastName,
        hasMetadata: !!user.metadata,
      });

      const savedUser = await this.usersRepository.save(user);

      console.log('✓ User created successfully:', savedUser.id);

      // Determine primary role and additional roles
      // Priority: 1. Explicit primaryRoleId from DTO, 2. CRM check, 3. savedUser.roleId
      let primaryRoleId = createUserDto.primaryRoleId || savedUser.roleId;
      let additionalRoles: string[] = createUserDto.additionalRoleIds || [];

      // CRM check only if no explicit primaryRoleId was provided
      if (!createUserDto.primaryRoleId) {
        try {
          const isCustomer = await this.crmService.isCustomerEmail(savedUser.email);

          if (isCustomer) {
            console.log('🎯 CRM Check: Email found in CRM database - auto-assigning customer role');

            // Get customer role ID
            const roles = await this.rolesService.findAll(savedUser.tenantId);
            const customerRole = roles.find(r => r.name === 'customer');

            if (customerRole) {
              // Set customer as primary role (not viewer)
              primaryRoleId = customerRole.id;
              console.log('✅ Customer role will be set as primary:', customerRole.name);
            } else {
              console.warn('⚠️ Customer role not found in database, using viewer role');
            }
          } else {
            console.log('ℹ️ CRM Check: Email not found in CRM - assigning viewer role');
          }
        } catch (crmError) {
          console.error('❌ CRM check failed:', crmError.message);
          // Continue with default viewer role if CRM check fails
        }
      } else {
        console.log('ℹ️ Explicit primaryRoleId provided - skipping CRM check');
      }

      // CRITICAL: Create user_roles junction table entry
      // This is required for multi-role support and proper role loading
      try {
        await this.userRolesService.assignRoles(
          savedUser.id,
          primaryRoleId, // Will be customer if in CRM, viewer otherwise
          additionalRoles,
          false, // Don't replace (there are no existing roles)
          undefined, // No assignedBy for self-registration
          activeTenantId,
        );
        console.log('✓ User role assigned in user_roles table');

        // Update user's roleId to match primary role
        if (primaryRoleId !== savedUser.roleId) {
          await this.usersRepository.update(savedUser.id, { roleId: primaryRoleId });
          savedUser.roleId = primaryRoleId;
          console.log('✓ User roleId updated to match primary role');
        }
      } catch (roleError) {
        console.error('❌ Error assigning user role:', roleError);
        // Don't fail user creation, but log the error
        // The user still has roleId in users table (legacy field)
      }

      // Clear cache
      await this.cacheService.del('users:all');

      // NOTE: Email sending is implemented below via EventEmitter
      // Send account creation email with password reset link
      try {
        // Generate password reset token (32 random bytes as hex string)
        const crypto = require('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date();
        resetExpires.setHours(resetExpires.getHours() + 24); // 24 hours expiry

        // Save reset token to database for password reset
        await this.usersRepository.update(savedUser.id, {
          emailVerificationToken: resetToken,
          emailVerificationExpires: resetExpires,
        });

        // Construct reset URL for manual sharing
        const baseUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:9003';
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

        console.log('✅ User created successfully:', savedUser.email);
        console.log('📧 Emitting user.created event...');

        // Emit event for email notification (decoupled from business logic)
        this.eventEmitter.emit('user.created', {
          userId: savedUser.id,
          email: savedUser.email,
          firstName: savedUser.firstName,
          lastName: savedUser.lastName,
          resetToken,
          tenantId: savedUser.tenantId,
        });
      } catch (emailError) {
        console.error('❌ Error sending account creation email:', emailError);
        // Don't fail user creation if email sending fails
      }
      return savedUser;
    } catch (error) {
      console.error('❌ Error in UsersService.create:', error);

      // Re-throw known errors
      if (error instanceof ConflictException || error instanceof BadRequestException) {
        throw error;
      }

      // Handle database constraint violations (duplicate key)
      if (error.code === '23505') { // PostgreSQL unique violation code
        if (error.constraint?.includes('email') || error.detail?.includes('email')) {
          throw new ConflictException('User with this email already exists');
        }
        throw new ConflictException('A user with this information already exists');
      }

      // Log and throw unexpected errors
      console.error('❌ Unexpected error details:', {
        message: error.message,
        code: error.code,
        constraint: error.constraint,
        detail: error.detail,
        stack: error.stack,
        name: error.name,
      });
      throw error;
    }
  }

  async findAll(filterDto: FilterUsersDto, tenantId?: string): Promise<{ data: User[]; total: number; page: number; limit: number }> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    if (!activeTenantId) throw new BadRequestException('Tenant context required');

    const page = filterDto?.page || 1;
    const limit = filterDto?.limit || 10;
    const skip = (page - 1) * limit;

    const where: FindOptionsWhere<User> = { tenantId: activeTenantId } as any;

    // Search filter (email or name)
    if (filterDto?.search) {
      // This is simplified - for production, use query builder for OR conditions
      where.email = ILike(`%${filterDto.search}%`);
    }

    // Role filter
    if (filterDto?.roleId) {
      where.roleId = filterDto.roleId;
    }

    // Status filters
    if (filterDto?.isActive !== undefined) {
      where.isActive = filterDto.isActive;
    }

    if (filterDto?.emailVerified !== undefined) {
      where.emailVerified = filterDto.emailVerified;
    }

    // Sorting
    const sortBy = filterDto?.sortBy || 'createdAt';
    const sortOrder = filterDto?.sortOrder || 'DESC';

    const [users, total] = await this.usersRepository.findAndCount({
      where,
      relations: ['roleEntity', 'userRoles', 'userRoles.role'], // Include multi-role data
      take: limit,
      skip,
      order: {
        [sortBy]: sortOrder,
      },
      withDeleted: false, // Exclude soft-deleted users from list
    });

    return {
      data: users,
      total,
      page,
      limit,
    };
  }

  async findOne(id: string, tenantId?: string, isGlobal = false): Promise<User> {
    const activeTenantId = isGlobal ? undefined : (tenantId || this.tenantService.getTenantId());
    const where: FindOptionsWhere<User> = { id } as any;
    // CRITICAL: Strict tenant enforcement
    if (activeTenantId) {
      (where as any).tenantId = activeTenantId;
    }

    const user = await this.usersRepository.findOne({
      where,
      relations: ['roleEntity', 'userRoles', 'userRoles.role', 'organization'], // Include both legacy and new role relations + organization
      withDeleted: false, // Exclude soft-deleted users
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Double check tenantId if provided (in case TypeORM query didn't filter correctly for some reason)
    if (activeTenantId && user.tenantId !== activeTenantId) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // DEBUG: Log user roles
    console.log('🔍 UsersService.findOne - user roles:', {
      email: user.email,
      roleId: user.roleId,
      userRolesCount: user.userRoles?.length || 0,
      userRoles: user.userRoles?.map(ur => ({
        roleName: ur.role?.name,
        isPrimary: ur.isPrimary,
      })),
      rolesGetter: user.roles?.map(r => r.name),
    });

    return user;
  }

  async findByEmail(email: string, tenantId?: string, skipCache = false, isGlobal = false): Promise<User | null> {
    const activeTenantId = isGlobal ? undefined : (tenantId || this.tenantService.getTenantId());

    // Skip cache for critical operations like user registration
    if (!skipCache) {
      const cached = await this.cacheService.get<User>(`users:email:${email}`);
      if (cached) {
        // If we need strict tenant check, validate cached user's tenantId
        if (activeTenantId && cached.tenantId !== activeTenantId) {
          return null;
        }
        return cached;
      }
    }

    const where: FindOptionsWhere<User> = { email } as any;
    if (activeTenantId) (where as any).tenantId = activeTenantId;

    // Important: Only find users that are NOT soft-deleted
    // TypeORM automatically excludes soft-deleted records when using findOne
    // But we need to be explicit for clarity
    const user = await this.usersRepository.findOne({
      where,
      relations: ['roleEntity', 'userRoles', 'userRoles.role'], // Include role information for permission checks
      withDeleted: false, // Explicitly exclude soft-deleted users
    });

    // Validated tenant match if tenantId provided
    if (activeTenantId && user && user.tenantId !== activeTenantId) {
      return null;
    }

    if (user && !skipCache) {
      await this.cacheService.set(`users:email:${email}`, user, 60); // 60 seconds TTL
    }
    return user;
  }

  async findByVerificationToken(token: string): Promise<User | null> {
    return await this.usersRepository.findOne({
      where: { emailVerificationToken: token },
      withDeleted: false, // Don't allow verifying deleted accounts
    });
  }

  async update(id: string, updateUserDto: UpdateUserDto, tenantId?: string): Promise<User> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    const user = await this.findOne(id, activeTenantId);

    // Check if email is being changed and if it's already taken
    if (updateUserDto.email && updateUserDto.email !== user.email) {
      // Check for email collision, scoping to tenant if available (though user might be updating self)
      // We use user.tenantId to keep it consistent
      const existingUser = await this.findByEmail(updateUserDto.email, user.tenantId);
      if (existingUser) {
        throw new ConflictException('Email already in use');
      }
    }

    // NEW: Role handling - Update roles if primaryRoleId is provided
    if (updateUserDto.primaryRoleId) {
      console.log(`🔄 Updating roles for user ${id}:`, {
        primaryRoleId: updateUserDto.primaryRoleId,
        additionalRoleIds: updateUserDto.additionalRoleIds || [],
      });

      try {
        await this.userRolesService.assignRoles(
          id,
          updateUserDto.primaryRoleId,
          updateUserDto.additionalRoleIds || [],
          true, // Replace existing roles
          undefined, // NOTE: Admin user ID can be passed from request context when audit logging is needed
          activeTenantId, // Ensure roles are assigned within tenant
        );

        // SMOOTH TRANSITION: Just clear cache - user will get updated role on next request
        // No token invalidation = seamless role change without logout
        await this.cacheService.del(`users:${id}`);
        await this.cacheService.del('users:all');

        // Remove from DTO to prevent duplicate update
        delete updateUserDto.primaryRoleId;
        delete updateUserDto.additionalRoleIds;
      } catch (error) {
        console.error('❌ Error updating user roles:', error);
        throw error;
      }
    }

    // DEPRECATED: Backward compatibility for single roleId
    if (updateUserDto.roleId && updateUserDto.roleId !== user.roleId) {
      console.log(`⚠️ Using deprecated roleId field. Consider using primaryRoleId instead.`);

      // Validate role exists
      const roleExists = await this.rolesService.findOne(updateUserDto.roleId, user.tenantId);
      if (!roleExists) {
        throw new NotFoundException(`Role with ID "${updateUserDto.roleId}" not found`);
      }

      // Assign as primary role using new system
      await this.userRolesService.assignRoles(
        id,
        updateUserDto.roleId,
        [],
        true,
        undefined,
        activeTenantId,
      );
    }

    // If password is being updated, hash it
    if (updateUserDto.password) {
      updateUserDto.password = await this.authUtilsService.hashPassword(updateUserDto.password);
    }

    // IMPORTANT: Use update() instead of save() to avoid eager loading issues
    // save() tries to persist eager loaded relations which causes userId to become null
    await this.usersRepository.update(id, updateUserDto);

    // Clear cache
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del(`users:email:${user.email}`);
    await this.cacheService.del('users:all');

    // Reload user with updated roles
    return this.findOne(id);
  }

  // Alias for update method (for compatibility)
  async updateUser(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    return this.update(id, updateUserDto);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    // Need to use withDeleted to find user even if already soft-deleted
    const where: FindOptionsWhere<User> = { id } as any;
    if (activeTenantId) (where as any).tenantId = activeTenantId;

    const user = await this.usersRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    // Soft delete by setting deletedAt
    await this.usersRepository.softDelete(id);

    // Clear cache
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del(`users:email:${user.email}`);
    await this.cacheService.del('users:all');
  }

  /**
   * Hard delete - permanently remove user from database
   * Use with caution! This action cannot be undone.
   * Consider using soft delete (remove) instead.
   */
  async hardDelete(id: string, tenantId?: string): Promise<void> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    const where: FindOptionsWhere<User> = { id } as any;
    if (activeTenantId) (where as any).tenantId = activeTenantId;

    const user = await this.usersRepository.findOne({
      where,
      withDeleted: true, // Find even soft-deleted users
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    console.warn(`⚠️  HARD DELETE: Permanently removing user ${user.email} (${id})`);

    // Permanently delete from database
    await this.usersRepository.remove(user);

    // Clear cache
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del(`users:email:${user.email}`);
    await this.cacheService.del('users:all');
  }

  /**
   * Restore a soft-deleted user
   */
  async restore(id: string, tenantId?: string): Promise<User> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    // Find soft-deleted user
    const where: FindOptionsWhere<User> = { id } as any;
    if (activeTenantId) (where as any).tenantId = activeTenantId;

    const user = await this.usersRepository.findOne({
      where,
      withDeleted: true,
    });

    if (!user) {
      throw new NotFoundException(`User with ID "${id}" not found`);
    }

    if (!user.deletedAt) {
      throw new BadRequestException('User is not deleted');
    }

    // Restore the user
    await this.usersRepository.restore(id);

    // Clear cache and return updated user
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del(`users:email:${user.email}`);
    await this.cacheService.del('users:all');

    return this.findOne(id, activeTenantId);
  }

  async changeRole(id: string, changeRoleDto: ChangeUserRoleDto, tenantId?: string): Promise<User> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    console.log(`⚠️ changeRole is deprecated. Use update with primaryRoleId instead.`);

    const user = await this.findOne(id, activeTenantId);

    // Use new multi-role system
    await this.userRolesService.assignRoles(
      id,
      changeRoleDto.roleId,
      [], // No additional roles
      true, // Replace existing
      undefined,
      activeTenantId,
    );

    // SMOOTH TRANSITION: Just clear cache - user will get updated role on next request
    // No token invalidation = seamless role change without logout
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del('users:all');

    // Reload user with new role relation
    return this.findOne(id, activeTenantId);
  }

  async toggleActive(id: string, tenantId?: string): Promise<User> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    const user = await this.findOne(id, activeTenantId);

    user.isActive = !user.isActive;
    const updatedUser = await this.usersRepository.save(user);

    // Clear cache
    await this.cacheService.del(`users:${id}`);
    await this.cacheService.del('users:all');

    return updatedUser;
  }

  async getStats(tenantId?: string): Promise<{
    total: number;
    active: number;
    inactive: number;
    verified: number;
    unverified: number;
    byRole: { role: string; count: number }[];
  }> {
    const activeTenantId = tenantId || this.tenantService.getTenantId();
    if (!activeTenantId) throw new BadRequestException('Tenant context required');

    const total = await this.usersRepository.count({ where: { tenantId: activeTenantId } as any });
    const active = await this.usersRepository.count({ where: { isActive: true, tenantId: activeTenantId } as any });
    const inactive = await this.usersRepository.count({ where: { isActive: false, tenantId: activeTenantId } as any });
    const verified = await this.usersRepository.count({ where: { emailVerified: true, tenantId: activeTenantId } as any });
    const unverified = await this.usersRepository.count({ where: { emailVerified: false, tenantId: activeTenantId } as any });

    // Get count by role
    const byRoleQuery = await this.usersRepository
      .createQueryBuilder('user')
      .leftJoin('user.roleEntity', 'role')
      .where('user.tenantId = :tenantId', { tenantId: activeTenantId })
      .select('role.displayName', 'role')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('role.displayName')
      .getRawMany();

    const byRole = byRoleQuery.map(item => ({
      role: item.role || 'No Role',
      count: parseInt(item.count),
    }));

    return {
      total,
      active,
      inactive,
      verified,
      unverified,
      byRole,
    };
  }

  /**
   * Complete user profile after registration
   * This method handles automatic role assignment based on profile data:
   * - Customer role: if customerData is provided
   * - Student role: if studentData is provided
   * - Subscriber role: if newsletter preferences are enabled
   */
  async completeProfile(userId: string, completeProfileDto: CompleteProfileDto): Promise<User> {
    const user = await this.findOne(userId);

    // Update basic profile fields
    if (completeProfileDto.firstName) user.firstName = completeProfileDto.firstName;
    if (completeProfileDto.lastName) user.lastName = completeProfileDto.lastName;
    if (completeProfileDto.phone) user.phone = completeProfileDto.phone;

    // Update metadata
    if (!user.metadata) {
      user.metadata = {};
    }

    // Handle customer data and role assignment
    if (completeProfileDto.customerData &&
      (completeProfileDto.customerData.customerNumber || completeProfileDto.customerData.companyName)) {
      user.metadata.customerData = completeProfileDto.customerData;

      // Update direct customer fields for easier querying in frontend
      if (completeProfileDto.customerData.customerNumber) {
        user.customerNumber = completeProfileDto.customerData.customerNumber;
      }

      // CRITICAL FIX: Also save to flat metadata fields because frontend checks these
      user.metadata.customerNumber = completeProfileDto.customerData.customerNumber;
      user.metadata.companyName = completeProfileDto.customerData.companyName;
      user.metadata.taxNumber = completeProfileDto.customerData.taxNumber;
      user.metadata.companyPhone = completeProfileDto.customerData.companyPhone;
      user.metadata.companyAddress = completeProfileDto.customerData.companyAddress;
      user.metadata.companyCity = completeProfileDto.customerData.companyCity;

      // Assign Customer role
      await this.assignRoleByName(user, 'customer');
    }

    // Handle student data and role assignment
    if (completeProfileDto.studentData &&
      (completeProfileDto.studentData.schoolName || completeProfileDto.studentData.studentId)) {
      user.metadata.studentData = completeProfileDto.studentData;

      // Update direct student fields for easier querying
      if (completeProfileDto.studentData.schoolName) {
        user.schoolName = completeProfileDto.studentData.schoolName;
      }
      if (completeProfileDto.studentData.studentId) {
        user.studentId = completeProfileDto.studentData.studentId;
      }

      // CRITICAL FIX: Also save to flat metadata fields because frontend checks these
      user.metadata.schoolName = completeProfileDto.studentData.schoolName;
      user.metadata.studentId = completeProfileDto.studentData.studentId;

      // Assign Student role (if exists, otherwise log warning)
      await this.assignRoleByName(user, 'student');
    }

    // Handle newsletter preferences and subscriber role
    if (completeProfileDto.newsletterPreferences) {
      user.metadata.newsletterPreferences = completeProfileDto.newsletterPreferences;

      // If any newsletter option is enabled, assign Subscriber role
      const hasNewsletterSubscription = Object.values(completeProfileDto.newsletterPreferences).some(v => v === true);
      if (hasNewsletterSubscription) {
        // Update direct subscription flag
        user.isSubscribedToNewsletter = true;

        await this.assignRoleByName(user, 'subscriber');

        // NOTE: Email marketing integration planned - emit event for SubscriberService integration
        this.eventEmitter.emit('user.subscribed', { userId: user.id, email: user.email });
        console.log(`📧 User ${user.email} subscribed to newsletter - event emitted for email marketing.`);
      }
    }

    // Merge additional metadata
    if (completeProfileDto.metadata) {
      user.metadata = { ...user.metadata, ...completeProfileDto.metadata };
    }

    // Mark profile as completed
    user.metadata.profileCompleted = true;
    user.metadata.profileCompletedAt = new Date().toISOString();

    const updatedUser = await this.usersRepository.save(user);

    // Clear cache
    await this.cacheService.del(`users:${userId}`);
    await this.cacheService.del(`users:email:${user.email}`);
    await this.cacheService.del('users:all');

    return updatedUser;
  }

  /**
   * Assign a role to user by role name
   * CRITICAL: Uses UserRolesService to create proper user_roles junction table entries
   * This is required for roles to appear in user.roles array on login
   */
  private async assignRoleByName(user: User, roleName: string): Promise<void> {
    try {
      const roles = await this.rolesService.findAll(user.tenantId);
      const role = roles.find(r => r.name.toLowerCase() === roleName.toLowerCase());

      if (!role) {
        console.warn(`⚠️ Role "${roleName}" not found in database. Skipping role assignment.`);
        return;
      }

      // Check if user already has this role in user_roles table
      const existingUserRoles = await this.userRolesService.getUserRoles(user.id, user.tenantId);
      const hasRole = existingUserRoles.some(ur => ur.roleId === role.id);

      if (hasRole) {
        console.log(`ℹ️ User ${user.email} already has role "${roleName}" in user_roles`);
        return;
      }

      // CRITICAL: Use UserRolesService to create user_roles entry
      // This creates the many-to-many relationship in the junction table
      // Get current roles to preserve them
      const currentRoleIds = existingUserRoles
        .filter(ur => !ur.isPrimary) // Only additional roles
        .map(ur => ur.roleId);

      // Get primary role (if any)
      const primaryRole = existingUserRoles.find(ur => ur.isPrimary);
      const primaryRoleId = primaryRole?.roleId || user.roleId;

      if (!primaryRoleId) {
        console.error(`❌ User ${user.email} has no primary role. Cannot assign additional role.`);
        return;
      }

      // Add new role to additional roles
      const newAdditionalRoles = [...currentRoleIds, role.id];

      // Assign roles using UserRolesService
      await this.userRolesService.assignRoles(
        user.id,
        primaryRoleId,
        newAdditionalRoles,
        true, // Replace existing
        undefined, // No assignedBy for profile completion
        user.tenantId, // Ensure tenant isolation
      );

      console.log(`✅ Assigned role "${roleName}" to user ${user.email} via user_roles table`);
    } catch (error) {
      console.error(`❌ Error assigning role "${roleName}":`, error);
    }
  }

  /**
   * Invalidate all active tokens for a user
   * This forces the user to login again to get a new token
   * Used when: user role changes, password changes, security breach
   */
  async invalidateAllTokens(userId: string): Promise<void> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException(`User with ID "${userId}" not found`);
    }

    // Increment tokenVersion - this will invalidate all existing JWTs
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await this.usersRepository.save(user);

    // Clear user cache so next request gets updated tokenVersion
    await this.cacheService.del(`users:${userId}`);
    await this.cacheService.del(`users:email:${user.email}`);

    console.log(`🔒 All tokens invalidated for user ${user.email} (tokenVersion: ${user.tokenVersion})`);
  }
}