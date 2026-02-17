import { IsEmail, IsEnum, IsOptional, IsArray, IsString, IsNumber } from 'class-validator';
import { CreateSubscriberDto as ICreateSubscriberDto, SubscriberStatus } from '@affexai/shared-types';

export class CreateSubscriberDto implements ICreateSubscriberDto {
  @IsEmail()
  email: string;

  @IsEnum(SubscriberStatus)
  @IsOptional()
  status?: string;

  @IsArray()
  @IsOptional()
  groups?: string[];

  @IsArray()
  @IsOptional()
  segments?: string[];

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsString()
  @IsOptional()
  company?: string;

  @IsString()
  @IsOptional()
  phone?: string;

  @IsString()
  @IsOptional()
  customerStatus?: string;

  @IsString()
  @IsOptional()
  subscriptionType?: string;

  @IsString()
  @IsOptional()
  mailerCheckResult?: string;

  @IsString()
  @IsOptional()
  location?: string;

  @IsNumber()
  @IsOptional()
  sent?: number;

  @IsNumber()
  @IsOptional()
  opens?: number;

  @IsNumber()
  @IsOptional()
  clicks?: number;
}