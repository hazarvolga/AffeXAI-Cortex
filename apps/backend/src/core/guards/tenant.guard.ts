
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantService } from '../tenant/tenant.service';

/**
 * Tenant Guard
 * Ensures that the tenantId in the request (header or context) 
 * matches the authorized tenantId in the user's JWT.
 */
@Injectable()
export class TenantGuard implements CanActivate {
    constructor(
        private tenantService: TenantService,
        private reflector: Reflector,
    ) { }

    canActivate(context: ExecutionContext): boolean {
        const request = context.switchToHttp().getRequest();
        const user = request.user;

        // 1. If not authenticated, skip (let JwtAuthGuard handle authentication)
        // If it's a public route, user might be undefined.
        if (!user) {
            return true;
        }

        // 2. SuperAdmin bypass
        if (user.roles?.some(r => r.name === 'super_admin' || r.name === 'admin')) {
            return true;
        }

        // 3. Verify consistency
        const contextTenantId = this.tenantService.getTenantId();
        const userTenantId = user.tenantId;

        if (!userTenantId) {
            throw new ForbiddenException('User has no assigned tenant context');
        }

        if (contextTenantId && contextTenantId !== 'default' && contextTenantId !== userTenantId) {
            console.warn(`🚨 TENANT MISMATCH DETECTED: User ${user.id} (Tenant ${userTenantId}) attempted to access Tenant ${contextTenantId}`);
            throw new ForbiddenException('You do not have access to this tenant resource');
        }

        return true;
    }
}
