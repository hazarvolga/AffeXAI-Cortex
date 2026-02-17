import { httpClient } from './http-client';
import { BaseApiService } from './base-service';
import type { ApiResponse } from '@affexai/shared-types';

import { Role } from '@affexai/shared-types';

export interface Resource {
  id: string;
  name: string;
  category: string;
  description: string;
}

export interface RoleWithPermissions extends Role {
  permissions: string[]; // List of resource IDs
}

/**
 * Roles and Permissions Service
 * Handles RBAC operations.
 */
class RolesService extends BaseApiService<Role> {
  constructor() {
    super({ endpoint: '/roles', useWrappedResponses: true });
  }

  /**
   * Get all roles for the tenant
   */
  async getRoles(): Promise<Role[]> {
    return httpClient.getWrapped<Role[]>(this.endpoint);
  }

  /**
   * Get role details with permissions
   */
  async getRoleWithPermissions(id: string): Promise<RoleWithPermissions> {
    const [role, permissions] = await Promise.all([
      this.getById(id),
      this.getRolePermissions(id)
    ]);

    return {
      ...role,
      permissions
    };
  }

  /**
   * Get raw permissions for a role
   */
  async getRolePermissions(id: string): Promise<string[]> {
    return httpClient.getWrapped<string[]>(`${this.endpoint}/${id}/permissions`);
  }

  /**
   * Update permissions for a role
   */
  async updateRolePermissions(id: string, permissions: string[]): Promise<void> {
    return httpClient.patchWrapped<void>(`${this.endpoint}/${id}/permissions`, {
      permissions
    });
  }

  /**
   * Get all available resources/permissions in the system
   */
  async getAllResources(): Promise<Resource[]> {
    // Note: If backend doesn't have a dedicated /resources endpoint, 
    // we might need to fetch this from a system config or a hardcoded list for now,
    // but typically a good RBAC system has a discovery endpoint.
    return httpClient.getWrapped<Resource[]>('/system/resources');
  }
}

export const rolesService = new RolesService();
export default rolesService;
