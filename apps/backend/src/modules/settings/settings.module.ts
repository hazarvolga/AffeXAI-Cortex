import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SettingsService } from './settings.service';
import { SettingsController } from './settings.controller';
import { Setting } from './entities/setting.entity';
import { DNSVerificationService } from './dns-verification.service';
import { KeyManagementService } from '../../core/shared/services/key-management.service';
import { TenantModule } from '../../core/tenant/tenant.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Setting]),
    TenantModule,
  ],
  controllers: [SettingsController],
  providers: [SettingsService, DNSVerificationService, KeyManagementService],
  exports: [SettingsService, DNSVerificationService, KeyManagementService],
})
export class SettingsModule { }