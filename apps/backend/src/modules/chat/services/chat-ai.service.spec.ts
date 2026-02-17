import { Test, TestingModule } from '@nestjs/testing';
import { ChatAiService } from './chat-ai.service';
import { AiService } from '../../ai/ai.service';
import { SettingsService } from '../../settings/settings.service';
import { ChatContextEngineService } from './chat-context-engine.service';
import { ChatAiSettingsService, ChatAiConfiguration } from './chat-ai-settings.service';
import { AiProvider, AiModel } from '../../settings/dto/ai-settings.dto';

describe('ChatAiService', () => {
    let service: ChatAiService;
    let aiService: AiService;
    let contextEngine: ChatContextEngineService;

    const mockAiService = {
        generateText: jest.fn(),
        generateStream: jest.fn(),
    };

    const mockSettingsService = {
        getSettings: jest.fn(),
    };

    const mockContextEngine = {
        buildContext: jest.fn(),
    };

    const mockChatAiSettings = {
        getConfigurationWithFailover: jest.fn(),
        validateApiKey: jest.fn(),
    };

    const mockConfig: ChatAiConfiguration = {
        apiKey: 'sk-test',
        model: AiModel.GPT4,
        provider: AiProvider.OPENAI,
        enabled: true,
        priority: 1,
        maxRetries: 1,
        timeoutMs: 1000,
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatAiService,
                { provide: AiService, useValue: mockAiService },
                { provide: SettingsService, useValue: mockSettingsService },
                { provide: ChatContextEngineService, useValue: mockContextEngine },
                { provide: ChatAiSettingsService, useValue: mockChatAiSettings },
            ],
        }).compile();

        service = module.get<ChatAiService>(ChatAiService);
        aiService = module.get<AiService>(AiService);
        contextEngine = module.get<ChatContextEngineService>(ChatContextEngineService);

        jest.clearAllMocks();
    });

    describe('generateChatResponse', () => {
        it('should generate response with context', async () => {
            mockChatAiSettings.getConfigurationWithFailover.mockResolvedValue(mockConfig);
            mockContextEngine.buildContext.mockResolvedValue({
                sources: [{ content: 'Context' }],
                totalRelevanceScore: 10
            } as any);
            mockAiService.generateText.mockResolvedValue({ content: 'Response', usage: {} });

            const result = await service.generateChatResponse('Hello', { includeContext: true });

            expect(result.contextUsed).toBeDefined();
            expect(mockAiService.generateText).toHaveBeenCalled();
        });

        it('should handle AI service failure', async () => {
            mockChatAiSettings.getConfigurationWithFailover.mockResolvedValue(mockConfig);
            mockAiService.generateText.mockRejectedValue(new Error('AI Error'));

            await expect(service.generateChatResponse('Hello')).rejects.toThrow();
        });
    });

    describe('generateStreamingChatResponse', () => {
        it('should yield chunks', async () => {
            mockChatAiSettings.getConfigurationWithFailover.mockResolvedValue(mockConfig);
            // Mock async generator from aiService
            async function* mockStream() {
                yield { content: 'He', isComplete: false };
                yield { content: 'llo', isComplete: true };
            }
            mockAiService.generateStream.mockReturnValue(mockStream());

            const generator = service.generateStreamingChatResponse('Hello');
            let fullContent = '';

            for await (const chunk of generator) {
                fullContent += chunk.content;
            }

            expect(fullContent).toBe('Hello');
        });
    });

    describe('buildContextAwarePrompt', () => {
        it('should embed context into prompt', () => {
            const context = { sources: [{ content: 'Secret info' }] } as any;
            const prompt = service.buildContextAwarePrompt('Q', context);
            expect(prompt).toContain('Secret info');
        });
    });

    describe('calculateConfidenceScore', () => {
        it('should calculate valid score', () => {
            const score = service.calculateConfidenceScore(
                { finishReason: 'stop' },
                { totalRelevanceScore: 10 } as any
            );
            expect(score).toBeGreaterThan(0.5);
        });
    });
});
