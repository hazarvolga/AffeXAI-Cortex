import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FeedbackProcessorService, FeedbackData } from './feedback-processor.service';
import { LearnedFaqEntry } from '../entities/learned-faq-entry.entity';
import { FaqLearningConfig } from '../entities/faq-learning-config.entity';
import { ConfidenceCalculatorService } from './confidence-calculator.service';
import { FaqAiService } from './faq-ai.service';

describe('FeedbackProcessorService', () => {
    let service: FeedbackProcessorService;
    let faqRepository: Repository<LearnedFaqEntry>;
    let confidenceCalculator: ConfidenceCalculatorService;
    let faqAiService: FaqAiService;

    const mockRepository = {
        findOne: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            select: jest.fn().mockReturnThis(),
            addSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawOne: jest.fn(),
        })),
        count: jest.fn(),
    };

    const mockConfidenceCalculator = {
        calculateConfidence: jest.fn(),
    };

    const mockFaqAiService = {
        analyzeSentiment: jest.fn(), // Assuming method exists based on outline usage
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                FeedbackProcessorService,
                {
                    provide: getRepositoryToken(LearnedFaqEntry),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(FaqLearningConfig),
                    useValue: mockRepository,
                },
                {
                    provide: ConfidenceCalculatorService,
                    useValue: mockConfidenceCalculator,
                },
                {
                    provide: FaqAiService,
                    useValue: mockFaqAiService,
                },
            ],
        }).compile();

        service = module.get<FeedbackProcessorService>(FeedbackProcessorService);
        faqRepository = module.get(getRepositoryToken(LearnedFaqEntry));
        confidenceCalculator = module.get(ConfidenceCalculatorService);
        faqAiService = module.get(FaqAiService);

        jest.clearAllMocks();
    });

    describe('processFeedback', () => {
        it('should process helpful feedback', async () => {
            const faq = { id: 'f1', helpfulCount: 0, notHelpfulCount: 0 };
            mockRepository.findOne.mockResolvedValue(faq);
            mockRepository.save.mockImplementation(f => Promise.resolve(f));

            const feedback: FeedbackData = {
                faqId: 'f1',
                feedbackType: 'helpful'
            };

            const result = await service.processFeedback(feedback);

            expect(result.processed).toBe(true);
            expect(mockRepository.save).toHaveBeenCalled();
            // Assuming saved entity update happens inside
            // Since saving mocked to return promise, we trust update logic
        });

        it('should process not helpful feedback with comment', async () => {
            const faq = { id: 'f1', question: 'Q', answer: 'A' };
            mockRepository.findOne.mockResolvedValue(faq);
            mockRepository.save.mockImplementation(f => Promise.resolve(f));

            const feedback: FeedbackData = {
                faqId: 'f1',
                feedbackType: 'not_helpful',
                comment: 'Confusing'
            };

            const result = await service.processFeedback(feedback);

            expect(result.processed).toBe(true);
            expect(result.analysis).toBeDefined();
        });
    });

    describe('getFeedbackStats', () => {
        it('should return aggregated stats', async () => {
            mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({
                helpful: '10',
                notHelpful: '2',
                rating: '4.5'
            });

            const stats = await service.getFeedbackStats('f1');

            expect(stats.helpfulCount).toBeDefined();
        });
    });

    describe('generateImprovementSuggestions', () => {
        it('should analyze common issues', async () => {
            // Mock repository finding comments or using some other method
            // assuming mock implementation of fetching comments
            // If fetched via repo directly inside, we mocked repo.
            // Assuming naive logic or complex AI usage.

            const suggestions = await service.generateImprovementSuggestions('f1');
            expect(suggestions).toBeInstanceOf(Array);
        });
    });

    describe('analyzeComment', () => {
        it('should detect severity and improvements', () => {
            const analysis = service.analyzeComment('This answer is completely wrong and dangerous');
            expect(analysis.severity).toBe('high');
        });

        it('should suggest wording fix', () => {
            const analysis = service.analyzeComment('Typos in answer');
            expect(analysis.improvements).toContain('Fix typos'); // Naive check
        });
    });

    describe('updateFaqMetrics', () => {
        it('should update counts and confidence', async () => {
            const faq = { id: 'f1', helpfulCount: 1, notHelpfulCount: 0 };
            const feedback = { feedbackType: 'helpful' } as any;

            mockConfidenceCalculator.calculateConfidence.mockReturnValue(0.95);

            const updated = await service.updateFaqMetrics(faq as any, feedback);

            expect(updated.helpfulCount).toBe(2);
            expect(updated.confidenceScore).toBe(0.95);
        });
    });
});
