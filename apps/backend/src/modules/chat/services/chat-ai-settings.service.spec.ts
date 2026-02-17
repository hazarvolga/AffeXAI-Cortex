import { Test, TestingModule } from '@nestjs/testing';
import { ChatAiSettingsService } from './chat-ai-settings.service';
import { SettingsService } from '../../settings/settings.service';
import { AiService } from '../../ai/ai.service';
import { AiProvider, AiModel } from '../../settings/dto/ai-settings.dto';

describe('ChatAiSettingsService', () => {
    let service: ChatAiSettingsService;
    let settingsService: SettingsService;
    let aiService: AiService;

    const mockSettingsService = {
        getSettings: jest.fn(),
        updateSettings: jest.fn(),
    };

    const mockAiService = {
        testConnection: jest.fn(),
    };

    const mockConfig = {
        chat: {
            ai: {
                provider: AiProvider.OPENAI,
                model: AiModel.GPT4,
                apiKey: 'sk-test',
                enabled: true,
                priority: 1,
                maxRetries: 3,
                timeoutMs: 5000
            }
        }
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatAiSettingsService,
                { provide: SettingsService, useValue: mockSettingsService },
                { provide: AiService, useValue: mockAiService },
            ],
        }).compile();

        service = module.get<ChatAiSettingsService>(ChatAiSettingsService);
        settingsService = module.get<SettingsService>(SettingsService);
        aiService = module.get<AiService>(AiService);

        jest.clearAllMocks();
    });

    describe('getChatAiConfiguration', () => {
        it('should return configuration', async () => {
            mockSettingsService.getSettings.mockResolvedValue(mockConfig);

            const config = await service.getChatAiConfiguration();

            expect(config.provider).toBe(AiProvider.OPENAI);
        });

        it('should return default if not configured', async () => {
            mockSettingsService.getSettings.mockResolvedValue({});

            const config = await service.getChatAiConfiguration();

            expect(config).toBeDefined();
            expect(config.enabled).toBe(false);
        });
    });

    describe('getConfigurationWithFailover', () => {
        it('should return primary config if healthy', async () => {
            mockSettingsService.getSettings.mockResolvedValue(mockConfig);

            const config = await service.getConfigurationWithFailover();

            expect(config.provider).toBe(AiProvider.OPENAI);
        });

        it('should switch to fallback if primary fails', async () => {
            // Logic for fallback involves internal state of failures.
            // We simulate failure state by calling recordProviderFailure
            mockSettingsService.getSettings.mockResolvedValue(mockConfig);

            // Assume maxFailures is 3. We record 4 failures.
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);

            const config = await service.getConfigurationWithFailover();

            // Should return a backup provider based on internal fallback list logic
            expect(config.provider).not.toBe(AiProvider.OPENAI);
        });
    });

    describe('isProviderAvailable', () => {
        it('should return true initially', () => {
            const available = service.isProviderAvailable(AiProvider.OPENAI);
            expect(available).toBe(true);
        });

        it('should return false if in cooldown', () => {
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);
            service.recordProviderFailure(AiProvider.OPENAI);

            const available = service.isProviderAvailable(AiProvider.OPENAI);
            expect(available).toBe(false);
        });
    });

    describe('validateApiKey', () => {
        it('should return true valid key', async () => {
            mockAiService.testConnection.mockResolvedValue(true);

            const isValid = await service.validateApiKey('sk-valid', AiModel.GPT4);

            expect(isValid).toBe(true);
        });

        it('should return false for invalid key', async () => {
            mockAiService.testConnection.mockResolvedValue(false);

            const isValid = await service.validateApiKey('sk-invalid', AiModel.GPT4);

            expect(isValid).toBe(false);
        });
    });

    describe('updateChatAiSettings', () => {
        it('should update settings', async () => {
            mockAiService.testConnection.mockResolvedValue(true);

            await service.updateChatAiSettings({
                globalApiKey: 'sk-new',
                globalModel: AiModel.GPT4
            });

            expect(mockSettingsService.updateSettings).toHaveBeenCalled();
        });
    });
});
