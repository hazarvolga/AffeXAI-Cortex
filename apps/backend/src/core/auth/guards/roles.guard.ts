import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

/**
 * Roles Guard
 * Checks if user has required roles (supports multi-role)
 * User roles are already attached to request by JwtAuthGuard
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) { }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // No roles required
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user) {
      throw new ForbiddenException('User not authenticated');
    }

    // User roles are already fetched fresh from DB by JwtAuthGuard
    const userRoleNames = user.roleNames || [];

    if (!userRoleNames || userRoleNames.length === 0) {
      throw new ForbiddenException('User has no roles assigned');
    }

    // SUPER ADMIN BYPASS: Give full access to super_admin and superadmin roles
    const isSuperAdmin = userRoleNames.some(
      (role: string) => role.toLowerCase() === 'super_admin' || role.toLowerCase() === 'superadmin'
    );

    if (isSuperAdmin) {
      console.log('✅ RolesGuard: Super Admin bypass granted');
      return true;
    }

    // Check if user has ANY of the required roles (multi-role support)
    const hasRole = requiredRoles.some((requiredRole) =>
      userRoleNames.some(
        (userRole: string) => userRole.toLowerCase() === requiredRole.toLowerCase()
      )
    );

    if (!hasRole) {
      throw new ForbiddenException(
        `Access denied. Required roles: ${requiredRoles.join(', ')}. User roles: ${userRoleNames.join(', ')}`
      );
    }

    console.log('✅ RolesGuard: Access granted for user with roles:', userRoleNames);
    return true;
  }
}
