import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Permissions Guard
 * Checks if user has required permissions (granular permission control)
 * User roles and permissions are already attached to request by JwtAuthGuard
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuard)
 * @RequirePermissions('users.view', 'users.create')
 * async getUsers() {}
 */
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // No permissions required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Collect all permissions from all user roles
    const userPermissions = new Set<string>();

    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach(role => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(permission => {
            userPermissions.add(permission);
          });
        }
      });
    }

    if (userPermissions.size === 0) {
      throw new ForbiddenException('User has no permissions assigned');
    }

    // SUPER ADMIN BYPASS: Full access for system.admin permission or super_admin role
    const isSuperAdmin = userPermissions.has('system.admin') ||
      user.roleNames?.some((r: string) => r.toLowerCase() === 'super_admin' || r.toLowerCase() === 'superadmin');

    if (isSuperAdmin) {
      console.log('✅ PermissionsGuard: Super Admin bypass granted');
      return true;
    }

    // Check if user has ALL required permissions (AND logic)
    const missingPermissions = requiredPermissions.filter(
      permission => !userPermissions.has(permission)
    );

    if (missingPermissions.length > 0) {
      console.log('❌ PermissionsGuard: Access denied', {
        userId: user.id,
        email: user.email,
        requiredPermissions,
        userPermissions: Array.from(userPermissions),
        missingPermissions,
      });

      throw new ForbiddenException(
        `Access denied. Missing permissions: ${missingPermissions.join(', ')}`
      );
    }

    console.log('✅ PermissionsGuard: Access granted', {
      userId: user.id,
      email: user.email,
      requiredPermissions,
    });

    return true;
  }
}

/**
 * Permissions Guard (OR Logic)
 * Checks if user has ANY of the required permissions
 * Useful when multiple permissions can grant access
 * 
 * Usage:
 * @UseGuards(JwtAuthGuard, PermissionsGuardOr)
 * @RequirePermissions('users.view', 'users.create')
 * async getUsers() {}
 */
@Injectable()
export class PermissionsGuardOr implements CanActivate {
  constructor(private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>('permissions', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // Collect all permissions from all user roles
    const userPermissions = new Set<string>();

    if (user.roles && Array.isArray(user.roles)) {
      user.roles.forEach(role => {
        if (role.permissions && Array.isArray(role.permissions)) {
          role.permissions.forEach(permission => {
            userPermissions.add(permission);
          });
        }
      });
    }

    if (userPermissions.size === 0) {
      throw new ForbiddenException('User has no permissions assigned');
    }

    // SUPER ADMIN BYPASS: Full access for system.admin permission or super_admin role
    const isSuperAdmin = userPermissions.has('system.admin') ||
      user.roleNames?.some((r: string) => r.toLowerCase() === 'super_admin' || r.toLowerCase() === 'superadmin');

    if (isSuperAdmin) {
      console.log('✅ PermissionsGuardOr: Super Admin bypass granted');
      return true;
    }

    // Check if user has ANY of the required permissions (OR logic)
    const hasAnyPermission = requiredPermissions.some(
      permission => userPermissions.has(permission)
    );

    if (!hasAnyPermission) {
      console.log('❌ PermissionsGuardOr: Access denied', {
        userId: user.id,
        email: user.email,
        requiredPermissions,
        userPermissions: Array.from(userPermissions),
      });

      throw new ForbiddenException(
        `Access denied. Required one of: ${requiredPermissions.join(', ')}`
      );
    }

    console.log('✅ PermissionsGuardOr: Access granted', {
      userId: user.id,
      email: user.email,
      matchedPermissions: requiredPermissions.filter(p => userPermissions.has(p)),
    });

    return true;
  }
}
