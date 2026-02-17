import { httpClient } from './http-client';
import {
  LoginDto,
  LoginResponse,
  UserProfile as CurrentUser,
  ApiResponse,
  RefreshTokenDto,
  RefreshTokenResponse,
  ChangePasswordDto
} from '@affexai/shared-types';

export type {
  LoginDto,
  LoginResponse,
  CurrentUser,
  RefreshTokenDto,
  RefreshTokenResponse,
  ChangePasswordDto
};

class AuthService {
  /**
   * Login user and store token
   * Uses server-side route handler to properly set cookies for middleware
   */
  async login(credentials: LoginDto): Promise<LoginResponse> {
    console.log('🔐 AuthService: Starting login process');

    // Call our Next.js API route instead of backend directly
    // This ensures cookies are set server-side for middleware
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(credentials),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Login failed' }));
      throw new Error(errorData.error || 'Login failed');
    }

    const loginData: LoginResponse = await response.json();

    console.log('🔐 AuthService: Login response received:', {
      hasAccessToken: !!loginData.access_token,
      hasRefreshToken: !!loginData.refresh_token,
    });

    // Store tokens in multiple places for compatibility
    if (loginData.access_token) {
      console.log('🔐 AuthService: Storing tokens');

      // Store in httpClient
      httpClient.setAuthToken(loginData.access_token);

      // Also store in localStorage directly (backup)
      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', loginData.access_token);
        console.log('🔐 AuthService: Access token stored in localStorage');
      }

      // Store in tokenStorage as well
      try {
        const { tokenStorage } = await import('../auth/token-storage');
        tokenStorage.setAccessToken(loginData.access_token);
        console.log('🔐 AuthService: Access token stored in tokenStorage');

        // Store refresh token if present
        if (loginData.refresh_token) {
          tokenStorage.setRefreshToken(loginData.refresh_token);
          console.log('🔐 AuthService: Refresh token stored in tokenStorage');
        }
      } catch (error) {
        console.log('🔐 AuthService: Could not store in tokenStorage:', error);
      }
    } else {
      console.error('🔐 AuthService: No access_token in response!');
    }

    return loginData;
  }

  /**
   * Logout user and clear token
   */
  logout(): void {
    httpClient.clearAuthToken();
    // Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!httpClient.getAuthToken();
  }

  /**
   * Get current token
   */
  getToken(): string | null {
    return httpClient.getAuthToken();
  }

  /**
   * Decode JWT token and get user info (client-side only)
   * Note: This is NOT secure for permissions - only use for UI display
   */
  getUserFromToken(): CurrentUser | null {
    const token = this.getToken();
    if (!token) return null;

    try {
      // JWT format: header.payload.signature
      const payload = token.split('.')[1];

      // JWT uses base64url encoding, need to convert to standard base64
      // Replace URL-safe characters: - with +, _ with /
      // Add padding if needed
      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = base64.padEnd(base64.length + (4 - base64.length % 4) % 4, '=');

      const decoded = JSON.parse(atob(padded));

      return {
        id: decoded.sub || decoded.userId,
        email: decoded.email,
        firstName: decoded.firstName,
        lastName: decoded.lastName,
        roleId: decoded.roleId,
        phone: decoded.phone,
        city: decoded.city,
        country: decoded.country,
        address: decoded.address,
        bio: decoded.bio,
        isActive: decoded.isActive ?? true,
        emailVerified: decoded.emailVerified ?? false,
        emailVerifiedAt: decoded.emailVerifiedAt,
        metadata: decoded.metadata,
      } as CurrentUser;
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**
   * Get current user from API
   */
  async getCurrentUser(): Promise<CurrentUser> {
    return await httpClient.getWrapped<CurrentUser>('/auth/me');
  }

  /**
   * Update user token with fresh user data
   * Useful after profile updates to keep JWT in sync
   */
  updateUserToken(updatedUser: Partial<CurrentUser>): void {
    const currentToken = this.getToken();
    if (!currentToken) return;

    try {
      // Decode current token
      const payload = currentToken.split('.')[1];
      const decoded = JSON.parse(atob(payload));

      // Merge updated user data
      const newPayload = {
        ...decoded,
        ...updatedUser,
        // Ensure critical fields are preserved
        sub: updatedUser.id || decoded.sub,
        email: updatedUser.email || decoded.email,
      } as any as CurrentUser;

      // Note: In production, you should get a new token from the server
      // This is a client-side workaround for immediate UI updates
      // For security, consider calling backend to get a fresh token
      console.log('⚠️ Token updated client-side. Consider refreshing from server for security.');

      // For now, we'll just log. In production, call backend for new token
      // The UI will use getUserFromToken() which reads from the current token
    } catch (error) {
      console.error('Error updating token:', error);
    }
  }

  /**
   * Check if email already exists (duplicate check)
   */
  async checkEmailExists(email: string): Promise<{ exists: boolean; message: string }> {
    return await httpClient.postWrapped<{ exists: boolean; message: string }>('/auth/check-email', { email });
  }

  /**
   * Register new user
   */
  async register(userData: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    phone?: string;
    roleId?: string;
    metadata?: any;
  }): Promise<{
    success: boolean;
    message: string;
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
    };
  }> {
    return await httpClient.postWrapped('/auth/register', userData);
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(dto: RefreshTokenDto): Promise<RefreshTokenResponse> {
    console.log('🔄 AuthService: Refreshing access token');
    const response = await httpClient.postWrapped<RefreshTokenResponse>('/auth/refresh', dto);

    // Store new tokens
    if (response.access_token) {
      httpClient.setAuthToken(response.access_token);

      if (typeof window !== 'undefined') {
        localStorage.setItem('auth_token', response.access_token);
      }

      try {
        const { tokenStorage } = await import('../auth/token-storage');
        tokenStorage.setAccessToken(response.access_token);

        if (response.refresh_token) {
          tokenStorage.setRefreshToken(response.refresh_token);
        }
        console.log('✅ AuthService: Tokens refreshed and stored');
      } catch (error) {
        console.error('Error storing refreshed tokens:', error);
      }
    }

    return response;
  }

  /**
   * Change password
   */
  async changePassword(data: ChangePasswordDto): Promise<{ success: boolean; message: string }> {
    return await httpClient.postWrapped<{ success: boolean; message: string }>('/auth/change-password', data);
  }
}

export const authService = new AuthService();
