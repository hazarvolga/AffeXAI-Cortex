import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Setting, SettingCategory } from './entities/setting.entity';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { SiteSettingsDto } from './dto/site-settings.dto';
import {
  EmailSettingsDto,
  EmailSettingsMaskedDto,
  EmailProvider,
} from './dto/email-settings.dto';
import {
  AiSettingsDto,
  AiSettingsMaskedDto,
  AiModel,
  AiProvider,
  AiConnectionTestDto,
} from './dto/ai-settings.dto';
import { ApiKeyDetector } from './utils/api-key-detector';
import {
  StorageSettingsDto,
  StorageSettingsMaskedDto,
  StorageProvider,
} from './dto/storage-settings.dto';
import { KeyManagementService, AiProviderType } from '../../core/shared/services/key-management.service';
import { CommerceService } from '../commerce/commerce.service';

@Injectable()
export class SettingsService {
  private readonly logger = new Logger(SettingsService.name);

  constructor(
    @InjectRepository(Setting)
    private settingsRepository: Repository<Setting>,
    private keyManagementService: KeyManagementService,
    private tenantService: TenantService,
    @Inject(forwardRef(() => CommerceService))
    private commerceService: CommerceService,
  ) { }

  /**
   * Helper: Get active tenant ID or current context tenant ID
   * Ensures 100% tenant isolation and fail-fast behavior
   */
  private getActiveTenantId(providedId?: string): string {
    const tenantId = providedId || this.tenantService.getTenantId();
    if (!tenantId) {
      throw new Error('Tenant context is missing for Settings operation');
    }
    return tenantId;
  }

  async create(createSettingDto: CreateSettingDto, tenantId?: string): Promise<Setting> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = this.settingsRepository.create({ ...createSettingDto, tenantId: activeTenantId });
    return this.settingsRepository.save(setting);
  }

  async findAll(tenantId?: string): Promise<Setting[]> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    return this.settingsRepository.find({ where: { tenantId: activeTenantId } });
  }

  async findOne(id: string, tenantId?: string): Promise<Setting> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = await this.settingsRepository.findOne({ where: { id, tenantId: activeTenantId } });
    if (!setting) {
      throw new NotFoundException(`Setting with ID ${id} not found`);
    }
    return setting;
  }

  async findByCategory(category: SettingCategory, tenantId?: string): Promise<Setting[]> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    return this.settingsRepository.find({ where: { category, tenantId: activeTenantId } });
  }

  async findByKeyAndCategory(key: string, category: SettingCategory, tenantId?: string): Promise<Setting | null> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    return this.settingsRepository.findOne({ where: { key, category, tenantId: activeTenantId } });
  }

  async update(id: string, updateSettingDto: UpdateSettingDto, tenantId?: string): Promise<Setting> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = await this.findOne(id, activeTenantId);
    Object.assign(setting, updateSettingDto);
    return this.settingsRepository.save(setting);
  }

  async remove(id: string, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = await this.findOne(id, activeTenantId);
    await this.settingsRepository.remove(setting);
  }

  // Site settings specific methods
  async getSiteSettings(tenantId?: string): Promise<SiteSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.settingsRepository.find({ where: { tenantId: activeTenantId } });

    // Convert flat settings to nested structure
    const siteSettings: SiteSettingsDto = {
      companyName: this.getSettingValue(settings, SettingCategory.COMPANY, 'companyName', 'Aluplan Program Sistemleri'),
      showPoweredBy: this.getSettingValue(settings, SettingCategory.COMPANY, 'showPoweredBy', 'true'),
      domain: this.getSettingValue(settings, SettingCategory.COMPANY, 'domain', 'affexai.com'),
      logoUrl: this.getSettingValue(settings, SettingCategory.COMPANY, 'logoUrl', 'https://placehold.co/140x40/f7f7f7/1a1a1a?text=Aluplan'),
      logoDarkUrl: this.getSettingValue(settings, SettingCategory.COMPANY, 'logoDarkUrl', 'https://placehold.co/140x40/171717/f0f0f0?text=Aluplan'),
      contact: {
        address: this.getSettingValue(settings, SettingCategory.COMPANY, 'contact.address', 'Örnek Mah. Teknoloji Cad. No:123, Ataşehir/İstanbul'),
        phone: this.getSettingValue(settings, SettingCategory.COMPANY, 'contact.phone', '+90 216 123 45 67'),
        email: this.getSettingValue(settings, SettingCategory.COMPANY, 'contact.email', 'info@aluplan.com.tr'),
      },
      socialMedia: {
        facebook: this.getSettingValue(settings, SettingCategory.SOCIAL_MEDIA, 'facebook', 'https://www.facebook.com/aluplan'),
        linkedin: this.getSettingValue(settings, SettingCategory.SOCIAL_MEDIA, 'linkedin', 'https://www.linkedin.com/company/aluplan'),
        twitter: this.getSettingValue(settings, SettingCategory.SOCIAL_MEDIA, 'twitter', ''),
        youtube: this.getSettingValue(settings, SettingCategory.SOCIAL_MEDIA, 'youtube', 'https://www.youtube.com/aluplan'),
        instagram: this.getSettingValue(settings, SettingCategory.SOCIAL_MEDIA, 'instagram', 'https://www.instagram.com/aluplan'),
      },
      seo: {
        defaultTitle: this.getSettingValue(settings, SettingCategory.COMPANY, 'seo.defaultTitle', 'Aluplan Digital - AEC Çözümleri'),
        defaultDescription: this.getSettingValue(settings, SettingCategory.COMPANY, 'seo.defaultDescription', 'AEC profesyonelleri için en gelişmiş dijital çözümler ve uzman desteği.'),
      },
      strategicRadar: {
        competitors: {
          enabled: this.getSettingValue(settings, SettingCategory.STRATEGIC_RADAR, 'competitors.enabled', 'false') === 'true',
          urls: JSON.parse(this.getSettingValue(settings, SettingCategory.STRATEGIC_RADAR, 'competitors.urls', '[]')),
        },
        focusPulse: {
          enabled: this.getSettingValue(settings, SettingCategory.STRATEGIC_RADAR, 'focusPulse.enabled', 'false') === 'true',
          keywords: JSON.parse(this.getSettingValue(settings, SettingCategory.STRATEGIC_RADAR, 'focusPulse.keywords', '[]')),
        },
        reportingCycle: this.getSettingValue(settings, SettingCategory.STRATEGIC_RADAR, 'reportingCycle', 'weekly') as any,
      },
    };

    return siteSettings;
  }

  async updateSiteSettings(settingsDto: SiteSettingsDto, tenantId?: string): Promise<SiteSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    // Update company settings
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'companyName', settingsDto.companyName, activeTenantId);
    if (settingsDto.showPoweredBy !== undefined) {
      await this.updateOrCreateSetting(SettingCategory.COMPANY, 'showPoweredBy', String(settingsDto.showPoweredBy), activeTenantId);
    }
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'domain', settingsDto.domain, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'logoUrl', settingsDto.logoUrl, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'logoDarkUrl', settingsDto.logoDarkUrl, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'contact.address', settingsDto.contact.address, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'contact.phone', settingsDto.contact.phone, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'contact.email', settingsDto.contact.email, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'seo.defaultTitle', settingsDto.seo.defaultTitle, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.COMPANY, 'seo.defaultDescription', settingsDto.seo.defaultDescription, activeTenantId);

    // Update Strategic Radar settings
    if (settingsDto.strategicRadar) {
      if (settingsDto.strategicRadar.competitors) {
        await this.updateOrCreateSetting(SettingCategory.STRATEGIC_RADAR, 'competitors.enabled', String(settingsDto.strategicRadar.competitors.enabled), activeTenantId);
        await this.updateOrCreateSetting(SettingCategory.STRATEGIC_RADAR, 'competitors.urls', JSON.stringify(settingsDto.strategicRadar.competitors.urls), activeTenantId);
      }
      if (settingsDto.strategicRadar.focusPulse) {
        await this.updateOrCreateSetting(SettingCategory.STRATEGIC_RADAR, 'focusPulse.enabled', String(settingsDto.strategicRadar.focusPulse.enabled), activeTenantId);
        await this.updateOrCreateSetting(SettingCategory.STRATEGIC_RADAR, 'focusPulse.keywords', JSON.stringify(settingsDto.strategicRadar.focusPulse.keywords), activeTenantId);
      }
      if (settingsDto.strategicRadar.reportingCycle) {
        let cycle = settingsDto.strategicRadar.reportingCycle;
        if (cycle === 'daily') {
          const hasDailyAccess = await this.commerceService.checkFeatureAccess(activeTenantId, 'radar_daily_enabled');
          if (!hasDailyAccess) {
            this.logger.warn(`Tenant ${activeTenantId} attempted to set daily reporting cycle without premium access. Falling back to weekly.`);
            cycle = 'weekly';
          }
        }
        await this.updateOrCreateSetting(SettingCategory.STRATEGIC_RADAR, 'reportingCycle', cycle, activeTenantId);
      }
    }

    return settingsDto;
  }

  // ============ EMAIL SETTINGS METHODS ============

  /**
   * Get email settings from database
   * Returns decrypted values for API keys
   */
  async getEmailSettings(tenantId?: string): Promise<EmailSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.findByCategory(SettingCategory.EMAIL, activeTenantId);

    const emailSettings: EmailSettingsDto = {
      provider: this.getSettingValue(settings, SettingCategory.EMAIL, 'provider', 'resend') as EmailProvider,
      transactional: {
        domain: this.getSettingValue(settings, SettingCategory.EMAIL, 'transactional.domain', 'tx.aluplan.tr'),
        fromName: this.getSettingValue(settings, SettingCategory.EMAIL, 'transactional.fromName', 'Aluplan'),
        fromEmail: this.getSettingValue(settings, SettingCategory.EMAIL, 'transactional.fromEmail', 'noreply@tx.aluplan.tr'),
        replyToEmail: this.getSettingValue(settings, SettingCategory.EMAIL, 'transactional.replyToEmail', 'destek@aluplan.tr'),
      },
      marketing: {
        domain: this.getSettingValue(settings, SettingCategory.EMAIL, 'marketing.domain', 'news.aluplan.tr'),
        fromName: this.getSettingValue(settings, SettingCategory.EMAIL, 'marketing.fromName', 'Aluplan Newsletter'),
        fromEmail: this.getSettingValue(settings, SettingCategory.EMAIL, 'marketing.fromEmail', 'newsletter@news.aluplan.tr'),
        replyToEmail: this.getSettingValue(settings, SettingCategory.EMAIL, 'marketing.replyToEmail', 'iletisim@aluplan.tr'),
      },
      tracking: {
        clickTracking: this.getSettingValue(settings, SettingCategory.EMAIL, 'tracking.clickTracking', 'false') === 'true',
        openTracking: this.getSettingValue(settings, SettingCategory.EMAIL, 'tracking.openTracking', 'true') === 'true',
      },
      rateLimit: {
        transactional: parseInt(this.getSettingValue(settings, SettingCategory.EMAIL, 'rateLimit.transactional', '1000')),
        marketing: parseInt(this.getSettingValue(settings, SettingCategory.EMAIL, 'rateLimit.marketing', '500')),
      },
    };

    // Add provider-specific config (decrypted)
    switch (emailSettings.provider) {
      case EmailProvider.RESEND:
        const resendApiKey = await this.getDecryptedValue('resend.apiKey', SettingCategory.EMAIL, activeTenantId);
        if (resendApiKey) {
          emailSettings.resend = { apiKey: resendApiKey };
        }
        break;

      case EmailProvider.SENDGRID:
        const sendgridApiKey = await this.getDecryptedValue('sendgrid.apiKey', SettingCategory.EMAIL, activeTenantId);
        if (sendgridApiKey) {
          emailSettings.sendgrid = { apiKey: sendgridApiKey };
        }
        break;

      // Add other providers as needed
    }

    return emailSettings;
  }

  /**
   * Get masked email settings (for frontend)
   */
  async getEmailSettingsMasked(tenantId?: string): Promise<EmailSettingsMaskedDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getEmailSettings(activeTenantId);
    return EmailSettingsMaskedDto.mask(settings);
  }

  /**
   * Update email settings
   * Automatically encrypts API keys
   */
  async updateEmailSettings(settingsDto: EmailSettingsDto, tenantId?: string): Promise<EmailSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    // Update basic settings
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'provider', settingsDto.provider, activeTenantId);

    // Transactional settings
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'transactional.domain', settingsDto.transactional.domain, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'transactional.fromName', settingsDto.transactional.fromName, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'transactional.fromEmail', settingsDto.transactional.fromEmail, activeTenantId);
    if (settingsDto.transactional.replyToEmail) {
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'transactional.replyToEmail', settingsDto.transactional.replyToEmail, activeTenantId);
    }

    // Marketing settings
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'marketing.domain', settingsDto.marketing.domain, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'marketing.fromName', settingsDto.marketing.fromName, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.EMAIL, 'marketing.fromEmail', settingsDto.marketing.fromEmail, activeTenantId);
    if (settingsDto.marketing.replyToEmail) {
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'marketing.replyToEmail', settingsDto.marketing.replyToEmail, activeTenantId);
    }

    // Tracking settings
    if (settingsDto.tracking) {
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'tracking.clickTracking', String(settingsDto.tracking.clickTracking), activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'tracking.openTracking', String(settingsDto.tracking.openTracking), activeTenantId);
    }

    // Rate limit settings
    if (settingsDto.rateLimit) {
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'rateLimit.transactional', String(settingsDto.rateLimit.transactional), activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'rateLimit.marketing', String(settingsDto.rateLimit.marketing), activeTenantId);
    }

    // Provider-specific config (will be encrypted automatically)
    if (settingsDto.resend?.apiKey) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'resend.apiKey', settingsDto.resend.apiKey, activeTenantId);
    }
    if (settingsDto.sendgrid?.apiKey) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'sendgrid.apiKey', settingsDto.sendgrid.apiKey, activeTenantId);
    }
    if (settingsDto.postmark?.apiKey) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'postmark.apiKey', settingsDto.postmark.apiKey, activeTenantId);
    }
    if (settingsDto.mailgun?.apiKey) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'mailgun.apiKey', settingsDto.mailgun.apiKey, activeTenantId);
      if (settingsDto.mailgun.domain) {
        await this.updateOrCreateSetting(SettingCategory.EMAIL, 'mailgun.domain', settingsDto.mailgun.domain, activeTenantId);
      }
    }
    if (settingsDto.ses?.accessKey && settingsDto.ses?.secretKey) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'ses.accessKey', settingsDto.ses.accessKey, activeTenantId);
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'ses.secretKey', settingsDto.ses.secretKey, activeTenantId);
      if (settingsDto.ses.region) {
        await this.updateOrCreateSetting(SettingCategory.EMAIL, 'ses.region', settingsDto.ses.region, activeTenantId);
      }
    }
    if (settingsDto.smtp) {
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'smtp.host', settingsDto.smtp.host, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'smtp.port', String(settingsDto.smtp.port), activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'smtp.user', settingsDto.smtp.user, activeTenantId);
      await this.updateOrCreateSettingEncrypted(SettingCategory.EMAIL, 'smtp.password', settingsDto.smtp.password, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.EMAIL, 'smtp.secure', String(settingsDto.smtp.secure), activeTenantId);
    }

    this.logger.log('Email settings updated successfully');
    return settingsDto;
  }

  /**
   * Helper: Get decrypted value for a key
   */
  private async getDecryptedValue(key: string, category: SettingCategory, tenantId?: string): Promise<string | null> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = await this.findByKeyAndCategory(key, category, activeTenantId);
    return setting ? setting.getDecryptedValue() : null;
  }

  /**
   * Helper: Update or create setting with automatic encryption
   */
  private async updateOrCreateSettingEncrypted(category: SettingCategory, key: string, plainValue: string, tenantId?: string, providerName?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const existingSetting = await this.findByKeyAndCategory(key, category, activeTenantId);

    if (existingSetting) {
      // Update with encryption
      existingSetting.setEncryptedValue(plainValue);
      if (providerName) {
        existingSetting.provider = providerName;
      }
      await this.settingsRepository.save(existingSetting);
    } else {
      // Create new with encryption
      const newSetting = this.settingsRepository.create({
        category,
        key,
        value: '',
        provider: providerName || null,
        tenantId: activeTenantId,
      });
      newSetting.setEncryptedValue(plainValue);
      await this.settingsRepository.save(newSetting);
    }
  }

  private getSettingValue(settings: Setting[], category: SettingCategory, key: string, defaultValue: string): string {
    const setting = settings.find(s => s.category === category && s.key === key);
    if (!setting) return defaultValue;

    // Return decrypted value if encrypted
    return setting.isEncrypted ? setting.getDecryptedValue() : setting.value;
  }

  private async updateOrCreateSetting(category: SettingCategory, key: string, value: string, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const existingSetting = await this.findByKeyAndCategory(key, category, activeTenantId);

    if (existingSetting) {
      await this.update(existingSetting.id, { value }, activeTenantId);
    } else {
      await this.create({ category, key, value }, activeTenantId);
    }
  }

  // ============ AI SETTINGS METHODS ============

  /**
   * Get AI settings from database
   * Returns decrypted API keys
   */
  async getAiSettings(tenantId?: string): Promise<AiSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.findByCategory(SettingCategory.AI, activeTenantId);

    const aiSettings: AiSettingsDto = {
      useSingleApiKey: this.getSettingValue(settings, SettingCategory.AI, 'global.useSingleKey', 'false') === 'true',

      emailMarketing: {
        apiKey: (await this.getDecryptedValue('emailMarketing.apiKey', SettingCategory.AI, activeTenantId)) || undefined,
        model: this.getSettingValue(settings, SettingCategory.AI, 'emailMarketing.model', AiModel.GPT_4_TURBO) as AiModel,
        enabled: this.getSettingValue(settings, SettingCategory.AI, 'emailMarketing.enabled', 'true') === 'true',
        provider: this.getProviderFromModel(this.getSettingValue(settings, SettingCategory.AI, 'emailMarketing.model', AiModel.GPT_4_TURBO) as AiModel),
      },

      social: {
        apiKey: (await this.getDecryptedValue('social.apiKey', SettingCategory.AI, activeTenantId)) || undefined,
        model: this.getSettingValue(settings, SettingCategory.AI, 'social.model', AiModel.GPT_4_TURBO) as AiModel,
        enabled: this.getSettingValue(settings, SettingCategory.AI, 'social.enabled', 'false') === 'true',
        provider: this.getProviderFromModel(this.getSettingValue(settings, SettingCategory.AI, 'social.model', AiModel.GPT_4_TURBO) as AiModel),
      },

      support: {
        apiKey: (await this.getDecryptedValue('support.apiKey', SettingCategory.AI, activeTenantId)) || undefined,
        model: this.getSettingValue(settings, SettingCategory.AI, 'support.model', AiModel.GPT_4_TURBO) as AiModel,
        enabled: this.getSettingValue(settings, SettingCategory.AI, 'support.enabled', 'false') === 'true',
        provider: this.getProviderFromModel(this.getSettingValue(settings, SettingCategory.AI, 'support.model', AiModel.GPT_4_TURBO) as AiModel),
      },

      analytics: {
        apiKey: (await this.getDecryptedValue('analytics.apiKey', SettingCategory.AI, activeTenantId)) || undefined,
        model: this.getSettingValue(settings, SettingCategory.AI, 'analytics.model', AiModel.GPT_4_TURBO) as AiModel,
        enabled: this.getSettingValue(settings, SettingCategory.AI, 'analytics.enabled', 'false') === 'true',
        provider: this.getProviderFromModel(this.getSettingValue(settings, SettingCategory.AI, 'analytics.model', AiModel.GPT_4_TURBO) as AiModel),
      },
    };

    // Add global settings if using single API key
    if (aiSettings.useSingleApiKey) {
      aiSettings.global = {
        apiKey: (await this.getDecryptedValue('global.apiKey', SettingCategory.AI, activeTenantId)) || undefined,
        model: this.getSettingValue(settings, SettingCategory.AI, 'global.model', AiModel.GPT_4_TURBO) as AiModel,
        enabled: true,
        provider: this.getProviderFromModel(this.getSettingValue(settings, SettingCategory.AI, 'global.model', AiModel.GPT_4_TURBO) as AiModel),
      };
    }

    return aiSettings;
  }

  /**
   * Get masked AI settings (for frontend)
   */
  async getAiSettingsMasked(tenantId?: string): Promise<AiSettingsMaskedDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getAiSettings(activeTenantId);
    return AiSettingsMaskedDto.mask(settings);
  }

  /**
   * Update AI settings
   * Automatically encrypts API keys and detects provider from key format
   */
  async updateAiSettings(settingsDto: AiSettingsDto, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    this.logger.log(`🔧 updateAiSettings called with: ${JSON.stringify({
      useSingleApiKey: settingsDto.useSingleApiKey,
      hasGlobalApiKey: !!settingsDto.global?.apiKey,
      globalProvider: settingsDto.global?.provider,
      globalModel: settingsDto.global?.model,
    })}`);

    // Update global settings
    await this.updateOrCreateSetting(SettingCategory.AI, 'global.useSingleKey', String(settingsDto.useSingleApiKey), activeTenantId);

    if (settingsDto.useSingleApiKey && settingsDto.global) {
      // Save provider if explicitly provided (even without API key)
      if (settingsDto.global.provider) {
        await this.updateOrCreateSetting(SettingCategory.AI, 'global.provider', settingsDto.global.provider, activeTenantId);
      }

      // Only update API key if it's not masked (doesn't start with ***)
      if (settingsDto.global.apiKey && !settingsDto.global.apiKey.startsWith('***')) {
        this.logger.log(`💾 Saving global API key: length=${settingsDto.global.apiKey.length}, preview=${settingsDto.global.apiKey.substring(0, 10)}...`);

        // Auto-detect provider from API key
        const detection = ApiKeyDetector.detect(settingsDto.global.apiKey);
        this.logger.log(`🔍 Auto-detected provider: ${detection.provider}, model: ${detection.defaultModel}`);

        // Save encrypted API key WITH provider name for KEK/DEK
        await this.updateOrCreateSettingEncrypted(SettingCategory.AI, 'global.apiKey', settingsDto.global.apiKey, activeTenantId, 'global');

        // IMPORTANT: Respect manual provider selection for DeepSeek/undetectable providers
        // Only override if user didn't explicitly select a provider OR if manual selection matches detection
        const manualProvider = settingsDto.global.provider;
        const shouldUseManual = manualProvider && (manualProvider === 'deepseek' || manualProvider === 'openrouter' || manualProvider === 'local');

        if (shouldUseManual) {
          // Keep manual selection for DeepSeek, OpenRouter, and Local models
          this.logger.log(`⚠️  Manual provider "${manualProvider}" preserved (not overridden by auto-detection)`);
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.provider', manualProvider, activeTenantId);
        } else {
          // Use auto-detected provider (OpenAI, Anthropic, Google)
          this.logger.log(`✅ Auto-detected provider "${detection.provider}" applied`);
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.provider', detection.provider, activeTenantId);
        }

        // Use detected default model if no model specified or if model doesn't match provider
        if (!settingsDto.global.model) {
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', detection.defaultModel, activeTenantId);
          this.logger.log(`Auto-detected provider: ${detection.provider}, default model: ${detection.defaultModel}`);
        } else {
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', settingsDto.global.model, activeTenantId);
        }
      } else if (settingsDto.global.model) {
        // Update model even if API key is masked
        await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', settingsDto.global.model, activeTenantId);
      }
    }

    // Update Email Marketing settings
    if (settingsDto.emailMarketing.provider) {
      await this.updateOrCreateSetting(SettingCategory.AI, 'emailMarketing.provider', settingsDto.emailMarketing.provider, activeTenantId);
    }
    if (settingsDto.emailMarketing.apiKey && !settingsDto.emailMarketing.apiKey.startsWith('***')) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.AI, 'emailMarketing.apiKey', settingsDto.emailMarketing.apiKey, activeTenantId);
    }
    await this.updateOrCreateSetting(SettingCategory.AI, 'emailMarketing.model', settingsDto.emailMarketing.model, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.AI, 'emailMarketing.enabled', String(settingsDto.emailMarketing.enabled), activeTenantId);

    // Update Social Media settings
    if (settingsDto.social.provider) {
      await this.updateOrCreateSetting(SettingCategory.AI, 'social.provider', settingsDto.social.provider, activeTenantId);
    }
    if (settingsDto.social.apiKey && !settingsDto.social.apiKey.startsWith('***')) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.AI, 'social.apiKey', settingsDto.social.apiKey, activeTenantId);
    }
    await this.updateOrCreateSetting(SettingCategory.AI, 'social.model', settingsDto.social.model, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.AI, 'social.enabled', String(settingsDto.social.enabled), activeTenantId);

    // Update Support settings
    if (settingsDto.support.provider) {
      await this.updateOrCreateSetting(SettingCategory.AI, 'support.provider', settingsDto.support.provider, activeTenantId);
    }
    if (settingsDto.support.apiKey && !settingsDto.support.apiKey.startsWith('***')) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.AI, 'support.apiKey', settingsDto.support.apiKey, activeTenantId);
    }
    await this.updateOrCreateSetting(SettingCategory.AI, 'support.model', settingsDto.support.model, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.AI, 'support.enabled', String(settingsDto.support.enabled), activeTenantId);

    // Update Analytics settings
    if (settingsDto.analytics.provider) {
      await this.updateOrCreateSetting(SettingCategory.AI, 'analytics.provider', settingsDto.analytics.provider, activeTenantId);
    }
    if (settingsDto.analytics.apiKey && !settingsDto.analytics.apiKey.startsWith('***')) {
      await this.updateOrCreateSettingEncrypted(SettingCategory.AI, 'analytics.apiKey', settingsDto.analytics.apiKey, activeTenantId);
    }
    await this.updateOrCreateSetting(SettingCategory.AI, 'analytics.model', settingsDto.analytics.model, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.AI, 'analytics.enabled', String(settingsDto.analytics.enabled), activeTenantId);

    this.logger.log('✅ AI settings updated successfully');
  }


  /**
   * Update AI settings using KEK/DEK pattern (Phase 2 implementation)
   * This is the NEW recommended method that uses Data Encryption Keys per provider
   */
  async updateAiSettingsWithKEKDEK(settingsDto: AiSettingsDto, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    this.logger.log(`🔐 updateAiSettingsWithKEKDEK called (KEK/DEK pattern)`);

    // Update global settings
    await this.updateOrCreateSetting(SettingCategory.AI, 'global.useSingleKey', String(settingsDto.useSingleApiKey), tenantId);

    if (settingsDto.useSingleApiKey && settingsDto.global) {
      // Only update API key if it's not masked
      if (settingsDto.global.apiKey && !settingsDto.global.apiKey.startsWith('***')) {
        this.logger.log(`🔐 Encrypting global API key with KEK/DEK pattern`);

        // Encrypt using KEK/DEK pattern (Note: encryptApiKey might need tenantId if it saves state, assuming stateless/global for key management logic, but let's check KeyManagementService later. For now assuming it returns encrypted content)
        const { encryptedApiKey, encryptedDek } = await this.keyManagementService.encryptApiKey(
          settingsDto.global.apiKey,
          'global'
        );

        // Save encrypted API key
        const setting = await this.findByKeyAndCategory('global.apiKey', SettingCategory.AI, activeTenantId);
        if (setting) {
          setting.value = encryptedApiKey;
          setting.isEncrypted = true;
          setting.encryptedDek = encryptedDek;
          setting.provider = 'global';
          setting.dekCreatedAt = new Date();
          setting.dekRotationCount = (setting.dekRotationCount || 0);
          await this.settingsRepository.save(setting);
        } else {
          const newSetting = this.settingsRepository.create({
            category: SettingCategory.AI,
            key: 'global.apiKey',
            value: encryptedApiKey,
            isEncrypted: true,
            encryptedDek,
            provider: 'global',
            dekCreatedAt: new Date(),
            dekRotationCount: 0,
            tenantId: activeTenantId,
          });
          await this.settingsRepository.save(newSetting);
        }

        // Auto-detect provider and model
        const detection = ApiKeyDetector.detect(settingsDto.global.apiKey);
        await this.updateOrCreateSetting(SettingCategory.AI, 'global.provider', detection.provider, activeTenantId);

        if (!settingsDto.global.model) {
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', detection.defaultModel, activeTenantId);
          this.logger.log(`Auto-detected provider: ${detection.provider}, model: ${detection.defaultModel}`);
        } else {
          await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', settingsDto.global.model, activeTenantId);
        }
      } else if (settingsDto.global.model) {
        await this.updateOrCreateSetting(SettingCategory.AI, 'global.model', settingsDto.global.model, activeTenantId);
      }
    }

    // Update module settings with KEK/DEK pattern
    const modules: Array<'emailMarketing' | 'social' | 'support' | 'analytics'> = [
      'emailMarketing',
      'social',
      'support',
      'analytics'
    ];

    for (const module of modules) {
      const moduleSettings = settingsDto[module];

      if (moduleSettings.apiKey && !moduleSettings.apiKey.startsWith('***')) {
        this.logger.log(`🔐 Encrypting ${module} API key with KEK/DEK pattern`);

        // Note: encryptApiKey likely doesn't need tenantId if it just handles encryption logic
        // But if it accesses DB, it might. Assuming KeyManagementService handles keys globally or locally.
        // Let's assume encryptApiKey is stateless or handles its own context.
        const { encryptedApiKey, encryptedDek } = await this.keyManagementService.encryptApiKey(
          moduleSettings.apiKey,
          module
        );

        const setting = await this.findByKeyAndCategory(`${module}.apiKey`, SettingCategory.AI, activeTenantId);
        if (setting) {
          setting.value = encryptedApiKey;
          setting.isEncrypted = true;
          setting.encryptedDek = encryptedDek;
          setting.provider = module;
          setting.dekCreatedAt = new Date();
          setting.dekRotationCount = (setting.dekRotationCount || 0);
          await this.settingsRepository.save(setting);
        } else {
          const newSetting = this.settingsRepository.create({
            category: SettingCategory.AI,
            key: `${module}.apiKey`,
            value: encryptedApiKey,
            isEncrypted: true,
            encryptedDek,
            provider: module,
            dekCreatedAt: new Date(),
            dekRotationCount: 0,
            tenantId: activeTenantId,
          });
          await this.settingsRepository.save(newSetting);
        }
      }

      await this.updateOrCreateSetting(SettingCategory.AI, `${module}.model`, moduleSettings.model, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.AI, `${module}.enabled`, String(moduleSettings.enabled), activeTenantId);
    }

    this.logger.log('✅ AI settings updated with KEK/DEK pattern successfully');
  }

  /**
   * Rotate DEK for a provider (key rotation)
   */
  async rotateDEKForProvider(provider: AiProviderType, tenantId?: string): Promise<void> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    this.logger.log(`🔄 Rotating DEK for provider: ${provider}`);

    // Find the setting for this provider
    const setting = await this.settingsRepository.findOne({
      where: {
        category: SettingCategory.AI,
        provider,
        isEncrypted: true,
        tenantId: activeTenantId,
      }
    });

    if (!setting || !setting.encryptedDek) {
      throw new Error(`No encrypted DEK found for provider: ${provider}`);
    }

    // Decrypt the API key with the old DEK
    const apiKey = await this.keyManagementService.decryptApiKey(
      setting.value,
      setting.encryptedDek,
      provider
    );

    // Rotate the DEK (generates new DEK)
    const rotation = await this.keyManagementService.rotateDEK(provider);

    // Re-encrypt the API key with the new DEK
    const encryptedApiKey = this.keyManagementService.encryptWithDEK(apiKey, rotation.newDek);

    // Update the setting
    setting.value = encryptedApiKey;
    setting.encryptedDek = rotation.newEncryptedDek;
    setting.dekCreatedAt = new Date();
    setting.dekRotationCount = (setting.dekRotationCount || 0) + 1;

    await this.settingsRepository.save(setting);

    this.logger.log(`✅ DEK rotated for ${provider}. Rotation count: ${setting.dekRotationCount}`);
  }

  /**
   * Get API key for specific module
   * Returns global key if useSingleApiKey=true, otherwise module-specific key
   */
  async getAiApiKeyForModule(module: 'emailMarketing' | 'social' | 'support' | 'analytics', tenantId?: string): Promise<string | null> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getAiSettings(activeTenantId);

    // If module is disabled, return null
    if (!settings[module]?.enabled) {
      this.logger.warn(`AI module '${module}' is disabled`);
      return null;
    }

    // Use global key if configured
    if (settings.useSingleApiKey && settings.global?.apiKey) {
      const key = settings.global.apiKey;
      return key;
    }

    // Use module-specific key
    return settings[module]?.apiKey || null;
  }

  /**
   * Get AI model for specific module
   */
  async getAiModelForModule(module: 'emailMarketing' | 'social' | 'support' | 'analytics', tenantId?: string): Promise<AiModel> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getAiSettings(activeTenantId);

    // Use global model if configured
    if (settings.useSingleApiKey && settings.global?.model) {
      return settings.global.model;
    }

    // Use module-specific model
    return settings[module]?.model || AiModel.GPT_4_TURBO;
  }

  /**
   * Get AI provider for specific module
   */
  async getAiProviderForModule(module: 'emailMarketing' | 'social' | 'support' | 'analytics', tenantId?: string): Promise<AiProvider> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getAiSettings(activeTenantId);

    // Use global provider if configured
    if (settings.useSingleApiKey && settings.global?.provider) {
      return settings.global.provider;
    }

    // Use module-specific provider
    return settings[module]?.provider || AiProvider.OPENAI;
  }

  /**
   * Helper: Determine provider from model name
   */
  private getProviderFromModel(model: AiModel): AiProvider {
    if (model.startsWith('gpt-') || model.includes('openai/')) {
      return AiProvider.OPENAI;
    }
    if (model.startsWith('claude-') || model.includes('anthropic/')) {
      return AiProvider.ANTHROPIC;
    }
    if (model.startsWith('gemini-') || model.includes('google/')) {
      return AiProvider.GOOGLE;
    }
    if (model.startsWith('deepseek-')) {
      return AiProvider.DEEPSEEK;
    }
    if (model.includes('/') && !model.startsWith('gpt-') && !model.startsWith('claude-')) {
      return AiProvider.OPENROUTER;
    }
    if (['llama3.1', 'mistral', 'codellama'].includes(model)) {
      return AiProvider.LOCAL;
    }

    return AiProvider.OPENAI; // default fallback
  }

  // ============ STORAGE SETTINGS METHODS ============

  /**
   * Get storage settings from database
   * Returns decrypted secrets
   */
  async getStorageSettings(tenantId?: string): Promise<StorageSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.findByCategory(SettingCategory.STORAGE, activeTenantId);

    const storageSettings: StorageSettingsDto = {
      provider: this.getSettingValue(settings, SettingCategory.STORAGE, 'provider', StorageProvider.LOCAL) as StorageProvider,
      useLocalFallback: this.getSettingValue(settings, SettingCategory.STORAGE, 'useLocalFallback', 'true') === 'true',

      awsS3: {
        accessKeyId: this.getSettingValue(settings, SettingCategory.STORAGE, 'awsS3.accessKeyId', ''),
        secretAccessKey: (await this.getDecryptedValue('awsS3.secretAccessKey', SettingCategory.STORAGE, activeTenantId)) || '',
        region: this.getSettingValue(settings, SettingCategory.STORAGE, 'awsS3.region', ''),
        bucket: this.getSettingValue(settings, SettingCategory.STORAGE, 'awsS3.bucket', ''),
        endpoint: this.getSettingValue(settings, SettingCategory.STORAGE, 'awsS3.endpoint', ''),
        publicUrl: this.getSettingValue(settings, SettingCategory.STORAGE, 'awsS3.publicUrl', ''),
      },

      cloudflareR2: {
        accountId: this.getSettingValue(settings, SettingCategory.STORAGE, 'cloudflareR2.accountId', ''),
        accessKeyId: this.getSettingValue(settings, SettingCategory.STORAGE, 'cloudflareR2.accessKeyId', ''),
        secretAccessKey: (await this.getDecryptedValue('cloudflareR2.secretAccessKey', SettingCategory.STORAGE, activeTenantId)) || '',
        bucket: this.getSettingValue(settings, SettingCategory.STORAGE, 'cloudflareR2.bucket', ''),
        publicUrl: this.getSettingValue(settings, SettingCategory.STORAGE, 'cloudflareR2.publicUrl', ''),
      },

      digitalOceanSpaces: {
        accessKeyId: this.getSettingValue(settings, SettingCategory.STORAGE, 'digitalOceanSpaces.accessKeyId', ''),
        secretAccessKey: (await this.getDecryptedValue('digitalOceanSpaces.secretAccessKey', SettingCategory.STORAGE, activeTenantId)) || '',
        region: this.getSettingValue(settings, SettingCategory.STORAGE, 'digitalOceanSpaces.region', ''),
        bucket: this.getSettingValue(settings, SettingCategory.STORAGE, 'digitalOceanSpaces.bucket', ''),
        endpoint: this.getSettingValue(settings, SettingCategory.STORAGE, 'digitalOceanSpaces.endpoint', ''),
        cdnUrl: this.getSettingValue(settings, SettingCategory.STORAGE, 'digitalOceanSpaces.cdnUrl', ''),
      },

      minio: {
        endPoint: this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.endPoint', 'localhost'),
        port: parseInt(this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.port', '9000')),
        useSSL: this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.useSSL', 'false') === 'true',
        accessKey: this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.accessKey', ''),
        secretKey: (await this.getDecryptedValue('minio.secretKey', SettingCategory.STORAGE, activeTenantId)) || '',
        bucket: this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.bucket', ''),
        publicUrl: this.getSettingValue(settings, SettingCategory.STORAGE, 'minio.publicUrl', ''),
      },
    };

    return storageSettings;
  }

  /**
   * Get masked storage settings (for frontend)
   */
  async getStorageSettingsMasked(tenantId?: string): Promise<StorageSettingsMaskedDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const settings = await this.getStorageSettings(activeTenantId);
    return StorageSettingsMaskedDto.mask(settings);
  }

  /**
   * Update storage settings
   */
  async updateStorageSettings(settingsDto: StorageSettingsDto, tenantId?: string): Promise<StorageSettingsDto> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    // Basic Settings
    await this.updateOrCreateSetting(SettingCategory.STORAGE, 'provider', settingsDto.provider, activeTenantId);
    await this.updateOrCreateSetting(SettingCategory.STORAGE, 'useLocalFallback', String(settingsDto.useLocalFallback), activeTenantId);

    // AWS S3
    if (settingsDto.awsS3) {
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'awsS3.accessKeyId', settingsDto.awsS3.accessKeyId, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'awsS3.region', settingsDto.awsS3.region, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'awsS3.bucket', settingsDto.awsS3.bucket, activeTenantId);
      if (settingsDto.awsS3.endpoint) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'awsS3.endpoint', settingsDto.awsS3.endpoint, activeTenantId);
      if (settingsDto.awsS3.publicUrl) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'awsS3.publicUrl', settingsDto.awsS3.publicUrl, activeTenantId);

      // Only update secret if provided (and not masked)
      if (settingsDto.awsS3.secretAccessKey && !settingsDto.awsS3.secretAccessKey.startsWith('***')) {
        await this.updateOrCreateSettingEncrypted(SettingCategory.STORAGE, 'awsS3.secretAccessKey', settingsDto.awsS3.secretAccessKey, activeTenantId);
      }
    }

    // Cloudflare R2
    if (settingsDto.cloudflareR2) {
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'cloudflareR2.accountId', settingsDto.cloudflareR2.accountId, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'cloudflareR2.accessKeyId', settingsDto.cloudflareR2.accessKeyId, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'cloudflareR2.bucket', settingsDto.cloudflareR2.bucket, activeTenantId);
      if (settingsDto.cloudflareR2.publicUrl) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'cloudflareR2.publicUrl', settingsDto.cloudflareR2.publicUrl, activeTenantId);

      if (settingsDto.cloudflareR2.secretAccessKey && !settingsDto.cloudflareR2.secretAccessKey.startsWith('***')) {
        await this.updateOrCreateSettingEncrypted(SettingCategory.STORAGE, 'cloudflareR2.secretAccessKey', settingsDto.cloudflareR2.secretAccessKey, activeTenantId);
      }
    }

    // DigitalOcean Spaces
    if (settingsDto.digitalOceanSpaces) {
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'digitalOceanSpaces.accessKeyId', settingsDto.digitalOceanSpaces.accessKeyId, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'digitalOceanSpaces.region', settingsDto.digitalOceanSpaces.region, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'digitalOceanSpaces.bucket', settingsDto.digitalOceanSpaces.bucket, activeTenantId);
      if (settingsDto.digitalOceanSpaces.endpoint) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'digitalOceanSpaces.endpoint', settingsDto.digitalOceanSpaces.endpoint, activeTenantId);
      if (settingsDto.digitalOceanSpaces.cdnUrl) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'digitalOceanSpaces.cdnUrl', settingsDto.digitalOceanSpaces.cdnUrl, activeTenantId);

      if (settingsDto.digitalOceanSpaces.secretAccessKey && !settingsDto.digitalOceanSpaces.secretAccessKey.startsWith('***')) {
        await this.updateOrCreateSettingEncrypted(SettingCategory.STORAGE, 'digitalOceanSpaces.secretAccessKey', settingsDto.digitalOceanSpaces.secretAccessKey, activeTenantId);
      }
    }

    // MinIO
    if (settingsDto.minio) {
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.endPoint', settingsDto.minio.endPoint, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.port', String(settingsDto.minio.port), activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.useSSL', String(settingsDto.minio.useSSL), activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.accessKey', settingsDto.minio.accessKey, activeTenantId);
      await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.bucket', settingsDto.minio.bucket, activeTenantId);
      if (settingsDto.minio.publicUrl) await this.updateOrCreateSetting(SettingCategory.STORAGE, 'minio.publicUrl', settingsDto.minio.publicUrl, activeTenantId);

      if (settingsDto.minio.secretKey && !settingsDto.minio.secretKey.startsWith('***')) {
        await this.updateOrCreateSettingEncrypted(SettingCategory.STORAGE, 'minio.secretKey', settingsDto.minio.secretKey, activeTenantId);
      }
    }

    this.logger.log('Storage settings updated successfully');
    return settingsDto;
  }

  /**
   * Get system domain for email threading and webhook URLs
   * @returns Domain string (e.g., 'affexai.com', 'example.com')
   */
  async getDomain(tenantId?: string): Promise<string> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const setting = await this.findByKeyAndCategory('domain', SettingCategory.COMPANY, activeTenantId);
    return setting?.value || 'affexai.com'; // Fallback to default
  }

  /**
   * Get frontend URL for email links (verification, password reset, etc.)
   * Uses domain from site settings with https protocol
   * @returns Full frontend URL (e.g., 'https://aluplan.tr')
   */
  async getFrontendUrl(tenantId?: string): Promise<string> {
    const activeTenantId = this.getActiveTenantId(tenantId);
    const domain = await this.getDomain(activeTenantId);
    // Always use https in production, fallback to env variable for development
    if (process.env.NODE_ENV === 'development') {
      return process.env.FRONTEND_URL || 'http://localhost:9003';
    }
    return `https://${domain}`;
  }
}