import { httpClient } from '@/lib/api/http-client';

export interface User {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    avatarUrl?: string; // Mapped from 'avatar'
    role: string;
    status: 'active' | 'invited' | 'disabled';
    isActive: boolean; // Backend field
    lastActive?: Date; // Mapped from lastLoginAt
    joinedAt: Date;
    primaryRole?: Role; // Backend computed
    roleEntity?: Role; // Backend legacy
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    bio?: string;
}

export interface UserStats {
    total: number;
    active: number;
    inactive: number;
    verified: number;
}

export interface CreateUserDto {
    firstName: string;
    lastName: string;
    email: string;
    password?: string; // Optional if using invite flow
    roleId?: string; // Maps to primaryRoleId
    roleIds?: string[]; // Maps to additionalRoleIds
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
    bio?: string;
    isActive?: boolean;
}

export interface CreateRoleDto {
    name: string;
    description: string;
    permissions: string[];
    displayName?: string;
}

export interface Role {
    id: string;
    name: string;
    description: string;
    permissions: string[];
    isSystem: boolean;
    userCount: number;
    createdAt: Date;
}

export class UserManagementService {
    private static readonly BASE_URL = '/users';
    private static readonly ROLES_URL = '/roles';

    // --- Users ---
    static async getUsers(params?: { page?: number; limit?: number; search?: string }): Promise<{
        items: User[];
        total: number;
    }> {
        const response = await httpClient.get<any>(`${this.BASE_URL}`, { params });
        const data = response.data || response;

        // Handle both array/paginated responses
        const rawItems = Array.isArray(data) ? data : (data.items || data.data || []);
        const total = data.meta?.total || data.total || rawItems.length;

        return {
            items: rawItems.map((u: any) => ({
                ...u,
                avatarUrl: u.avatar,
                status: u.isActive ? 'active' : 'disabled',
                lastActive: u.lastLoginAt ? new Date(u.lastLoginAt) : undefined,
                joinedAt: new Date(u.createdAt)
            })),
            total
        };
    }

    static async getStats(): Promise<UserStats> {
        const response = await httpClient.get<UserStats>(`${this.BASE_URL}/stats`);
        return response || { total: 0, active: 0, inactive: 0, verified: 0 };
    }

    static async createUser(data: CreateUserDto): Promise<User> {
        // Map frontend DTO to backend expected DTO
        const payload = {
            ...data,
            primaryRoleId: data.roleId,
            additionalRoleIds: data.roleIds,
            // Remove frontend-specific fields that might cause issues if backend is strict (though typically ignored)
            roleId: undefined,
            roleIds: undefined
        };
        const response = await httpClient.post<any>(`${this.BASE_URL}`, payload);
        return response.data || response;
    }

    static async inviteUser(email: string, roleId: string): Promise<void> {
        await httpClient.post(`${this.BASE_URL}/invite`, { email, roleId });
    }

    static async updateUserRole(userId: string, roleId: string): Promise<void> {
        await httpClient.patch(`${this.BASE_URL}/${userId}/role`, { roleId });
    }

    static async deactivateUser(userId: string): Promise<void> {
        await httpClient.post(`${this.BASE_URL}/${userId}/deactivate`);
    }

    // --- Roles ---
    static async getRoles(): Promise<Role[]> {
        const response = await httpClient.get<any>(`${this.ROLES_URL}`);
        const data = response.data || response;
        return (Array.isArray(data) ? data : data.items || []).map((r: any) => ({
            ...r,
            createdAt: new Date(r.createdAt)
        }));
    }

    static async createRole(data: CreateRoleDto): Promise<Role> {
        return await httpClient.postWrapped<Role>(`${this.ROLES_URL}`, data);
    }

    static async deleteRole(roleId: string): Promise<void> {
        await httpClient.delete(`${this.ROLES_URL}/${roleId}`);
    }
}
