import { IsString, IsEmail, IsUrl, IsObject, IsOptional, ValidateNested, IsNotEmpty } from 'class-validator';
import { Type } from 'class-transformer';

export class ContactDto {
  @IsString()
  address: string;

  @IsString()
  phone: string;

  @IsEmail()
  email: string;
}

export class SocialMediaDto {
  @IsOptional()
  @IsString()
  facebook?: string;

  @IsOptional()
  @IsString()
  linkedin?: string;

  @IsOptional()
  @IsString()
  twitter?: string;

  @IsOptional()
  @IsString()
  youtube?: string;

  @IsOptional()
  @IsString()
  instagram?: string;

  @IsOptional()
  @IsString()
  pinterest?: string;

  @IsOptional()
  @IsString()
  tiktok?: string;

  // Remove the index signature that was causing issues
  [key: string]: string | undefined;
}

export class SeoDto {
  @IsString()
  defaultTitle: string;

  @IsString()
  defaultDescription: string;
}

export class SiteSettingsDto {
  @IsString()
  companyName: string;

  @IsString()
  @IsNotEmpty()
  domain: string;

  @IsOptional()
  @IsString()
  logoUrl: string;

  @IsOptional()
  @IsString()
  logoDarkUrl: string;

  @ValidateNested()
  @Type(() => ContactDto)
  contact: ContactDto;

  @ValidateNested()
  @Type(() => SocialMediaDto)
  socialMedia: SocialMediaDto;

  @ValidateNested()
  @Type(() => SeoDto)
  seo: SeoDto;
}