import { Controller, Post, Body, HttpException, HttpStatus, Get, Param, UseGuards, Request, UseInterceptors, ClassSerializerInterceptor } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../../modules/users/users.service';
import { LoginDto } from './dto/login.dto';
import { CreateUserDto } from '../../modules/users/dto/create-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
@UseInterceptors(ClassSerializerInterceptor)
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) { }

  @Post('register')
  async register(@Body() createUserDto: CreateUserDto) {
    try {
      console.log('📝 Register request received:', {
        email: createUserDto.email,
        firstName: createUserDto.firstName,
        lastName: createUserDto.lastName,
        hasPhone: !!createUserDto.phone,
        hasMetadata: !!createUserDto.metadata,
        roleId: createUserDto.roleId,
      });

      // Create user
      const user = await this.usersService.create(createUserDto);

      console.log('✓ User created, sending verification email...');

      // Send verification email
      await this.authService.sendVerificationEmail(
        user.id,
        user.email,
        user.firstName,
        user.tenantId
      );

      console.log('✓ Verification email sent successfully');

      return {
        success: true,
        message: 'Kayıt başarılı! Email adresinize doğrulama linki gönderildi.',
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        },
      };
    } catch (error) {
      console.error('❌ Register error:', {
        message: error.message,
        status: error.status,
        name: error.name,
        stack: error.stack,
      });

      if (error.status === 409) {
        throw new HttpException(
          'Bu email adresi zaten kayıtlı',
          HttpStatus.CONFLICT
        );
      }
      throw error;
    }
  }

  @Post('login')
  async login(@Body() loginDto: LoginDto) {
    const result = await this.authService.login(loginDto);
    if (!result) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }
    return result;
  }

  @Post('check-email')
  async checkEmail(@Body('email') email: string) {
    const exists = await this.authService.checkEmailExists(email);
    return {
      exists,
      message: exists
        ? 'Bu email adresi zaten kayıtlı'
        : 'Email adresi kullanılabilir',
    };
  }

  @Post('refresh')
  async refresh(@Body('refresh_token') refreshToken: string) {
    if (!refreshToken) {
      throw new HttpException('Refresh token required', HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.authService.refreshAccessToken(refreshToken);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      throw new HttpException(
        error.message || 'Token refresh failed',
        HttpStatus.UNAUTHORIZED
      );
    }
  }

  @Get('verify-email/:token')
  async verifyEmail(@Param('token') token: string) {
    const user = await this.authService.verifyEmail(token);

    if (!user) {
      throw new HttpException(
        'Geçersiz veya süresi dolmuş doğrulama linki',
        HttpStatus.BAD_REQUEST
      );
    }

    // CRITICAL: Auto-login after email verification to prevent security vulnerability
    // User should be redirected to /complete-profile, NOT to /login or /admin
    const loginPayload = {
      sub: user.id,
      email: user.email,
      tokenVersion: user.tokenVersion || 1,
    };

    // Generate access token (60 minutes)
    const accessToken = this.authService['jwtService'].sign(loginPayload, { expiresIn: '60m' });

    // Generate refresh token (7 days)
    const refreshToken = this.authService['jwtService'].sign(
      { sub: user.id, type: 'refresh' },
      { expiresIn: '7d' }
    );

    // Store refresh token in database
    const refreshTokenExpires = new Date();
    refreshTokenExpires.setDate(refreshTokenExpires.getDate() + 7);

    await this.usersService.updateUser(user.id, {
      refreshToken,
      refreshTokenExpires,
    });

    // Fetch full user data with roles for frontend state
    const fullUser = await this.usersService.findOne(user.id);

    return {
      success: true,
      message: 'Email adresiniz başarıyla doğrulandı! Portal kullanıma hazır.',
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
        // Multi-role support
        roles: fullUser.userRoles?.map(ur => ({
          id: ur.role.id,
          name: ur.role.name,
          displayName: ur.role.displayName,
          isPrimary: ur.isPrimary,
        })) || [],
        // Primary role
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
        metadata: fullUser.metadata,
      },
    };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getCurrentUser(@Request() req) {
    const user = await this.usersService.findOne(req.user.userId);

    if (!user) {
      throw new HttpException('User not found', HttpStatus.UNAUTHORIZED);
    }

    return {
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleId: user.roleId,
        phone: user.phone,
        city: user.city,
        country: user.country,
        address: user.address,
        bio: user.bio,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        emailVerifiedAt: user.emailVerifiedAt,
        metadata: user.metadata,
        // ✅ CRITICAL: Include roles with permissions for frontend permission checks
        roles: user.roles || [],           // All user roles with permissions
        primaryRole: user.primaryRole,      // Primary role with permissions
      }
    };
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
    await this.authService.changePassword(req.user.userId, changePasswordDto);
    return {
      success: true,
      message: 'Şifreniz başarıyla güncellendi',
    };
  }
}