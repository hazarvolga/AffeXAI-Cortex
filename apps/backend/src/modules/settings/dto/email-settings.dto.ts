import { IsString, IsEmail, IsOptional, IsBoolean, IsEnum, IsNumber, Min, Max, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export enum EmailProvider {
  RESEND = 'resend',
  SENDGRID = 'sendgrid',
  POSTMARK = 'postmark',
  MAILGUN = 'mailgun',
  SES = 'ses',
  SMTP = 'smtp',
}

export class TransactionalEmailDto {
  @IsString()
  domain: string;

  @IsString()
  fromName: string;

  @IsEmail()
  fromEmail: string;

  @IsEmail()
  @IsOptional()
  replyToEmail?: string;
}

export class MarketingEmailDto {
  @IsString()
  domain: string;

  @IsString()
  fromName: string;

  @IsEmail()
  fromEmail: string;

  @IsEmail()
  @IsOptional()
  replyToEmail?: string;
}

export class TrackingSettingsDto {
  @IsBoolean()
  @IsOptional()
  clickTracking?: boolean;

  @IsBoolean()
  @IsOptional()
  openTracking?: boolean;
}

export class RateLimitDto {
  @IsNumber()
  @Min(1)
  @Max(10000)
  transactional: number;

  @IsNumber()
  @Min(1)
  @Max(10000)
  marketing: number;
}

export class ResendConfigDto {
  @IsString()
  apiKey: string; // Will be encrypted
}

export class SendGridConfigDto {
  @IsString()
  apiKey: string; // Will be encrypted
}

export class PostmarkConfigDto {
  @IsString()
  apiKey: string; // Will be encrypted
}

export class MailgunConfigDto {
  @IsString()
  apiKey: string; // Will be encrypted

  @IsString()
  domain: string;
}

export class SESConfigDto {
  @IsString()
  accessKey: string; // Will be encrypted

  @IsString()
  secretKey: string; // Will be encrypted

  @IsString()
  region: string;
}

export class SMTPConfigDto {
  @IsString()
  host: string;

  @IsNumber()
  port: number;

  @IsString()
  user: string;

  @IsString()
  password: string; // Will be encrypted

  @IsBoolean()
  secure: boolean;
}

export class EmailSettingsDto {
  @IsEnum(EmailProvider)
  provider: EmailProvider;

  @ValidateNested()
  @Type(() => TransactionalEmailDto)
  transactional: TransactionalEmailDto;

  @ValidateNested()
  @Type(() => MarketingEmailDto)
  marketing: MarketingEmailDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TrackingSettingsDto)
  tracking?: TrackingSettingsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => RateLimitDto)
  rateLimit?: RateLimitDto;

  // Provider-specific configs (only one will be used based on provider selection)
  @IsOptional()
  @ValidateNested()
  @Type(() => ResendConfigDto)
  resend?: ResendConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SendGridConfigDto)
  sendgrid?: SendGridConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => PostmarkConfigDto)
  postmark?: PostmarkConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => MailgunConfigDto)
  mailgun?: MailgunConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SESConfigDto)
  ses?: SESConfigDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => SMTPConfigDto)
  smtp?: SMTPConfigDto;
}

/**
 * Masked version for client (API keys hidden)
 */
export class EmailSettingsMaskedDto {
  provider: EmailProvider;
  transactional: TransactionalEmailDto;
  marketing: MarketingEmailDto;
  tracking: TrackingSettingsDto;
  rateLimit: RateLimitDto;
  
  resend?: { apiKey: string }; // Will show "***" instead of real key
  sendgrid?: { apiKey: string };
  postmark?: { apiKey: string };
  mailgun?: { apiKey: string; domain: string };
  ses?: { accessKey: string; secretKey: string; region: string };
  smtp?: { host: string; port: number; user: string; password: string; secure: boolean };

  /**
   * Mask sensitive fields
   */
  static mask(settings: EmailSettingsDto): EmailSettingsMaskedDto {
    const masked = { ...settings } as EmailSettingsMaskedDto;

    if (masked.resend?.apiKey) {
      masked.resend.apiKey = '***' + masked.resend.apiKey.slice(-4);
    }
    if (masked.sendgrid?.apiKey) {
      masked.sendgrid.apiKey = '***' + masked.sendgrid.apiKey.slice(-4);
    }
    if (masked.postmark?.apiKey) {
      masked.postmark.apiKey = '***' + masked.postmark.apiKey.slice(-4);
    }
    if (masked.mailgun?.apiKey) {
      masked.mailgun.apiKey = '***' + masked.mailgun.apiKey.slice(-4);
    }
    if (masked.ses?.accessKey) {
      masked.ses.accessKey = '***' + masked.ses.accessKey.slice(-4);
    }
    if (masked.ses?.secretKey) {
      masked.ses.secretKey = '***';
    }
    if (masked.smtp?.password) {
      masked.smtp.password = '***';
    }

    return masked;
  }
}
