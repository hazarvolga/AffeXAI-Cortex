import { PartialType } from '@nestjs/mapped-types';
import { CreateUserDto } from './create-user.dto';
import { IsOptional, IsBoolean, IsString, IsDate, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateUserDto extends PartialType(CreateUserDto) {
  // NEW: Primary role support
  @ApiProperty({
    description: 'Primary role ID (UUID)',
    example: 'a1b2c3d4-e5f6-4789-abcd-000000000001',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  primaryRoleId?: string;

  // NEW: Additional roles support
  @ApiProperty({
    description: 'Additional role IDs (UUIDs)',
    example: ['a1b2c3d4-e5f6-4789-abcd-000000000002'],
    required: false,
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  additionalRoleIds?: string[];

  // DEPRECATED: Keep for backward compatibility
  @ApiProperty({
    description: 'Role ID (deprecated - use primaryRoleId instead)',
    required: false,
  })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  emailVerified?: boolean;

  @IsOptional()
  @IsDate()
  emailVerifiedAt?: Date;

  @IsOptional()
  @IsString()
  emailVerificationToken?: string;

  @IsOptional()
  @IsDate()
  emailVerificationExpires?: Date;

  @IsOptional()
  metadata?: any; // JSONB field

  @IsOptional()
  @IsString()
  customerNumber?: string;

  @IsOptional()
  @IsString()
  schoolName?: string;

  @IsOptional()
  @IsString()
  studentId?: string;

  @IsOptional()
  @IsBoolean()
  isSubscribedToNewsletter?: boolean;

  @IsOptional()
  @IsString()
  refreshToken?: string;

  @IsOptional()
  @IsDate()
  refreshTokenExpires?: Date;

  @IsOptional()
  @IsDate()
  lastLoginAt?: Date;
}
