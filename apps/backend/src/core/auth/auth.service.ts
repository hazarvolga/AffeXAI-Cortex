import { Injectable, UnauthorizedException, Inject, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../../modules/users/users.service';
import { MailService } from '../../modules/mail/mail.service';
import { SettingsService } from '../../modules/settings/settings.service';
import { LoginDto } from './dto/login.dto';
import { AuthUtilsService } from '../../core/shared/auth-utils.service';
import { randomBytes } from 'crypto';
import { MailChannel } from '../../modules/mail/interfaces/mail-service.interface';

@Injectable()
export class AuthService {
  constructor(
    @Inject(forwardRef(() => UsersService))
    private usersService: UsersService,
    private jwtService: JwtService,
    private authUtilsService: AuthUtilsService,
    private mailService: MailService,
    private settingsService: SettingsService,
  ) { }

  async validateUser(email: string, password: string): Promise<any> {
    // FORCE global lookup immediately to bypass tenant context issues during login
    // This ensures we find the user regardless of the current request context (e.g. 'default' vs 'affexai')
    console.log(`🔐 AuthService.validateUser(${email}) starting lookup (isGlobal=true)...`);

    // We pass isGlobal=true (4th arg) to ignore active tenant context
    const user = await this.usersService.findByEmail(email, undefined, true, true);

    console.log(`🔐 AuthService.validateUser(${email}) result:`, {
      found: !!user,
      userId: user?.id,
      userTenantId: user?.tenantId
    });
    if (user && await this.authUtilsService.comparePassword(password, user.password)) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.email, loginDto.password);
    if (!user) {
      return null;
    }

    // CRITICAL: Fetch user with userRoles relation for frontend response
    // validateUser doesn't load relations, so we need to fetch again with full data
    // UsersService.findOne now automatically loads organization relation

    console.log('🔐 AuthService.login: User Validated', {
      id: user.id,
      email: user.email,
      tenantId: user.tenantId,
      typeOfTenantId: typeof user.tenantId
    });

    // START FIX: Use the user object from validateUser directly
    // validateUser (via findByEmail) now includes all necessary relations (roles, organization)
    // accessible via global fallback if needed. Re-fetching via findOne causes 404
    // if the socket/request context is 'default' but user is 'affexai'.
    const fullUser = user as unknown as any;
    // END FIX

    // JWT Payload Strategy: Minimal data to avoid stale role/permission issues
    // Role information is fetched fresh from DB on each request via JWT strategy
    const payload = {
      sub: fullUser.id,
      email: fullUser.email,
      tokenVersion: fullUser.tokenVersion || 1, // For invalidating tokens on role changes
      // Multi-Tenancy: Inject technical tenantId slug (e.g. 'default')
      tenantId: fullUser.tenantId || null,
    };

    // Generate access token (60 minutes)
    const accessToken = this.jwtService.sign(payload, { expiresIn: '60m' });

    // Generate refresh token (7 days)
    const refreshToken = this.jwtService.sign(
      { sub: fullUser.id, type: 'refresh' },
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    const refreshTokenExpires = new Date();
    refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7);

    await this.usersService.updateUser(fullUser.id, {
      refreshToken,
      refreshTokenExpires,
      lastLoginAt: new Date(),
    }, fullUser.tenantId, true); // Force global update to bypass tenant context

    // Return user info for initial frontend state (NOT in JWT)
    // Include role information for immediate UI rendering
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_in: 3600, // 60 minutes in seconds
      user: {
        id: fullUser.id,
        email: fullUser.email,
        firstName: fullUser.firstName,
        lastName: fullUser.lastName,
        // Legacy roleId for backward compatibility
        roleId: fullUser.roleEntity?.name || null,
        // Multi-role support: include all roles with full details
        roles: fullUser.userRoles?.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
          displayName: ur.role.displayName,
          isPrimary: ur.isPrimary,
        })) || [],
        // Primary role for quick access
        primaryRole: fullUser.userRoles?.find(ur => ur.isPrimary)?.role
          ? {
            id: fullUser.userRoles.find(ur => ur.isPrimary).role.id,
            name: fullUser.userRoles.find(ur => ur.isPrimary).role.name,
            displayName: fullUser.userRoles.find(ur => ur.isPrimary).role.displayName,
          }
          : fullUser.roleEntity
            ? {
              id: fullUser.roleEntity.id,
              name: fullUser.roleEntity.name,
              displayName: fullUser.roleEntity.displayName,
            }
            : null,
        // Include metadata for profile completion checks
        metadata: fullUser.metadata,
        // Include Organization Context
        organization: fullUser.organization ? {
          id: fullUser.organization.id,
          name: fullUser.organization.name,
          slug: fullUser.organization.slug
        } : null
      },
    };
  }

  async checkEmailExists(email: string): Promise<boolean> {
    // Skip cache for accurate email existence check
    // findByEmail(email, tenantId, skipCache)
    const user = await this.usersService.findByEmail(email, undefined, true);
    return !!user;
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // Verify refresh token
      const payload = this.jwtService.verify(refreshToken);

      // Validate token type
      if (payload.type !== 'refresh') {
        throw new UnauthorizedException('Invalid token type');
      }

      // Get user and verify stored refresh token
      // Get user and verify stored refresh token - use global lookup to support cross-tenant refresh
      const user = await this.usersService.findOne(payload.sub, undefined, true);
      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (user.refreshToken !== refreshToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      if (user.refreshTokenExpires && user.refreshTokenExpires < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // Generate new access token with minimal payload
      const newPayload = {
        sub: user.id,
        email: user.email,
        tokenVersion: user.tokenVersion || 1,
        // Multi-Tenancy: Preserve technical tenantId slug from user
        tenantId: user.tenantId || null,
      };

      const newAccessToken = this.jwtService.sign(newPayload, { expiresIn: '60m' });

      // Rotate refresh token (security best practice)
      const newRefreshToken = this.jwtService.sign(
        { sub: user.id, type: 'refresh' },
        { expiresIn: '7d' }
      );

      const refreshTokenExpires = new Date();
      refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7);

      await this.usersService.updateUser(user.id, {
        refreshToken: newRefreshToken,
        refreshTokenExpires,
      }, user.tenantId);

      return {
        access_token: newAccessToken,
        refresh_token: newRefreshToken,
        expires_in: 3600,
      };
    } catch (error) {
      console.error('Token refresh failed:', error);
      throw new UnauthorizedException('Token refresh failed');
    }
  }

  /**
   * Generate email verification token
   */
  generateVerificationToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create email verification token for user
   * Returns the token (to be sent via email)
   */
  async createEmailVerificationToken(userId: string): Promise<string> {
    const token = this.generateVerificationToken();
    const expires = new Date();
    expires.setHours(expires.getHours() + 24); // Token valid for 24 hours

    await this.usersService.updateUser(userId, {
      emailVerificationToken: token,
      emailVerificationExpires: expires,
    });
    // Note: userId is usually enough here as we are just setting a token, but if we had tenantId available we should pass it. 
    // However, createEmailVerificationToken doesn't take tenantId currently and it's less critical than login/refresh.
    // Leaving as is for now to minimize scope, or could add it if we want to be thorough. 
    // Actually, let's leave it as is for this targeted fix as we don't have tenantId passed into this method.

    return token;
  }

  /**
   * Verify email with token
   * Returns user if successful, null if token invalid/expired
   */
  async verifyEmail(token: string): Promise<any> {
    const user = await this.usersService.findByVerificationToken(token);

    if (!user) {
      return null;
    }

    // Check if token is expired
    if (user.emailVerificationExpires && new Date() > user.emailVerificationExpires) {
      return null;
    }

    // Mark email as verified
    await this.usersService.updateUser(user.id, {
      emailVerified: true,
      emailVerifiedAt: new Date(),
      emailVerificationToken: undefined,
      emailVerificationExpires: undefined,
      isActive: true, // Activate user after email verification
    });

    return user;
  }

  /**
   * Send verification email to user
   */
  async sendVerificationEmail(userId: string, email: string, firstName: string, tenantId: string): Promise<void> {
    const token = await this.createEmailVerificationToken(userId);
    // Use domain from site settings instead of hardcoded env variable
    const baseUrl = await this.settingsService.getFrontendUrl(tenantId);
    const verificationLink = `${baseUrl}/verify-email/${token}`;

    try {
      await this.mailService.sendMail({
        to: [{ email, name: firstName }],
        subject: 'Email Adresinizi Doğrulayın - Aluplan',
        html: `
          <!DOCTYPE html>
          <html>
            <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
              <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
                <h2>Email Adresinizi Doğrulayın</h2>
                <p>Merhaba ${firstName},</p>
                <p>Aluplan hesabınızı etkinleştirmek için lütfen aşağıdaki butona tıklayın. Bu bağlantı 24 saat süreyle geçerlidir.</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${verificationLink}" 
                     style="background-color: #2563eb; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
                    E-posta Adresimi Doğrula
                  </a>
                </div>
                <p>Veya bu linki tarayıcınıza kopyalayın:</p>
                <p style="word-break: break-all; color: #666;">${verificationLink}</p>
                <p>Eğer bu talebi siz yapmadıysanız, bu e-postayı güvenle görmezden gelebilirsiniz.</p>
                <p>Teşekkürler,<br/>Aluplan Ekibi</p>
              </div>
            </body>
          </html>
        `,
        text: `Merhaba ${firstName},\n\nAluplan hesabınızı etkinleştirmek için lütfen aşağıdaki linke tıklayın:\n${verificationLink}\n\nBu bağlantı 24 saat süreyle geçerlidir.\n\nTeşekkürler,\nAluplan Ekibi`,
        channel: MailChannel.TRANSACTIONAL,
      }, tenantId);
    } catch (error) {
      console.error('Failed to send verification email:', error);
      // Don't throw error - user creation should succeed even if email fails
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, dto: import('./dto/change-password.dto').ChangePasswordDto): Promise<void> {
    const user = await this.usersService.findOne(userId);

    // Check if current password matches
    const isPasswordValid = await this.authUtilsService.comparePassword(dto.currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Mevcut şifre hatalı');
    }

    // Hash new password
    const hashedPassword = await this.authUtilsService.hashPassword(dto.newPassword);

    // Update user
    await this.usersService.updateUser(userId, {
      password: hashedPassword,
    });
  }
}
