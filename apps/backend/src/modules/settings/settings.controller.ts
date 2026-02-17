import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Put,
  Delete,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { TenantService } from '../../core/tenant/tenant.service';
import { SettingsService } from './settings.service';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SiteSettingsDto } from './dto/site-settings.dto';
import { EmailSettingsDto, EmailSettingsMaskedDto } from './dto/email-settings.dto';
import { StorageSettingsDto, StorageSettingsMaskedDto } from './dto/storage-settings.dto';
import { AiSettingsDto, AiSettingsMaskedDto, AiConnectionTestDto } from './dto/ai-settings.dto';
import { DNSVerificationService, DomainVerificationResult } from './dns-verification.service';
import { ApiKeyDetector } from './utils/api-key-detector';

@Controller('settings')
export class SettingsController {
  constructor(
    private readonly settingsService: SettingsService,
    private readonly dnsVerificationService: DNSVerificationService,
    private readonly tenantService: TenantService,
  ) { }

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createSettingDto: CreateSettingDto, @CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.create(createSettingDto, tenantId);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.findAll(tenantId);
  }

  @Get('individual/:id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.findOne(id, tenantId);
  }

  @Put('individual/:id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateSettingDto: UpdateSettingDto, @CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.update(id, updateSettingDto, tenantId);
  }

  @Delete('individual/:id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.remove(id, tenantId);
  }

  // Site settings specific endpoints - Public read, Authenticated write
  @Get('site')
  getSiteSettings(@CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.getSiteSettings(tenantId);
  }

  @Put('site')
  @UseGuards(JwtAuthGuard)
  updateSiteSettings(@Body() siteSettingsDto: SiteSettingsDto, @CurrentUser() user: any) {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.updateSiteSettings(siteSettingsDto, tenantId);
  }

  // Email settings endpoints - Protected
  @Get('email')
  @UseGuards(JwtAuthGuard)
  async getEmailSettings(@CurrentUser() user: any): Promise<EmailSettingsDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.getEmailSettings(tenantId);
  }

  @Get('email/masked')
  @UseGuards(JwtAuthGuard)
  async getEmailSettingsMasked(@CurrentUser() user: any): Promise<EmailSettingsMaskedDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.getEmailSettingsMasked(tenantId);
  }

  @Put('email')
  @UseGuards(JwtAuthGuard)
  async updateEmailSettings(@Body() emailSettingsDto: EmailSettingsDto, @CurrentUser() user: any): Promise<EmailSettingsDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.updateEmailSettings(emailSettingsDto, tenantId);
  }

  // Storage settings endpoints - Protected
  @Get('storage')
  @UseGuards(JwtAuthGuard)
  async getStorageSettings(@CurrentUser() user: any): Promise<StorageSettingsMaskedDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.getStorageSettingsMasked(tenantId);
  }

  @Put('storage')
  @UseGuards(JwtAuthGuard)
  async updateStorageSettings(@Body() storageSettingsDto: StorageSettingsDto, @CurrentUser() user: any): Promise<Object> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    await this.settingsService.updateStorageSettings(storageSettingsDto, tenantId);
    return { message: 'Storage settings updated successfully' };
  }

  // AI settings endpoints - Protected
  @Get('ai')
  @UseGuards(JwtAuthGuard)
  async getAiSettings(@CurrentUser() user: any): Promise<AiSettingsMaskedDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    return this.settingsService.getAiSettingsMasked(tenantId);
  }

  @Patch('ai')
  @UseGuards(JwtAuthGuard)
  async updateAiSettings(@Body() aiSettingsDto: AiSettingsDto, @CurrentUser() user: any): Promise<{ message: string }> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    await this.settingsService.updateAiSettings(aiSettingsDto, tenantId);
    return { message: 'AI settings updated successfully' };
  }

  @Post('ai/test/:module')
  @UseGuards(JwtAuthGuard)
  async testAiConnection(
    @Param('module') module: 'emailMarketing' | 'social' | 'support' | 'analytics',
    @CurrentUser() user: any,
  ): Promise<AiConnectionTestDto> {
    const tenantId = user?.tenantId || user?.organizationId || this.tenantService.getTenantId() || 'default';
    const apiKey = await this.settingsService.getAiApiKeyForModule(module, tenantId);
    const model = await this.settingsService.getAiModelForModule(module, tenantId);

    if (!apiKey) {
      return {
        success: false,
        message: `No API key configured for ${module}`,
      };
    }

    return {
      success: true,
      message: 'API key configured (connection test not yet implemented)',
      model,
    };
  }

  @Post('ai/detect-provider')
  async detectProvider(@Body() body: { apiKey: string }) {
    const detection = ApiKeyDetector.detect(body.apiKey);
    const availableModels = ApiKeyDetector.getAvailableModels(detection.provider);

    return {
      provider: detection.provider,
      providerName: ApiKeyDetector.getProviderDisplayName(detection.provider),
      defaultModel: detection.defaultModel,
      isValid: detection.isValid,
      detectionMethod: detection.detectionMethod,
      availableModels,
    };
  }

  // DNS Verification endpoints
  @Get('email/verify-dns')
  async verifyDNS(
    @Query('domain') domain: string,
    @Query('provider') provider: string,
  ): Promise<DomainVerificationResult> {
    if (!domain || !provider) {
      throw new Error('Domain and provider parameters are required');
    }

    return this.dnsVerificationService.verifyDomain(domain, provider);
  }

  @Get('email/quick-check-dns')
  async quickCheckDNS(@Query('domain') domain: string) {
    if (!domain) {
      throw new Error('Domain parameter is required');
    }

    return this.dnsVerificationService.quickCheck(domain);
  }
}