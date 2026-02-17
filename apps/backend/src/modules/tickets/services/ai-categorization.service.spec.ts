import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AICategorizationService } from './ai-categorization.service';
import { Ticket, TicketPriority, TicketStatus } from '../entities/ticket.entity';
import { TicketCategory } from '../entities/ticket-category.entity';

describe('AICategorizationService', () => {
    let service: AICategorizationService;
    let ticketRepository: Repository<Ticket>;
    let categoryRepository: Repository<TicketCategory>;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        subject: 'Cannot login to my account',
        description: 'I forgot my password and cannot reset it',
        priority: TicketPriority.MEDIUM,
        status: TicketStatus.OPEN,
    };

    const mockCategory: Partial<TicketCategory> = {
        id: 'cat-123',
        name: 'Account & Login',
        description: 'Login and authentication issues',
    };

    const mockRepository = {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AICategorizationService,
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketCategory),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<AICategorizationService>(AICategorizationService);
        ticketRepository = module.get(getRepositoryToken(Ticket));
        categoryRepository = module.get(getRepositoryToken(TicketCategory));

        jest.clearAllMocks();
        service['initializePatterns']();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('predictCategory', () => {
        it('should predict category with high confidence for clear patterns', async () => {
            const result = await service.predictCategory(mockTicket as Ticket);

            expect(result).toBeInstanceOf(Array);
            expect(result.length).toBeGreaterThan(0);
            expect(result[0]).toHaveProperty('categoryId');
            expect(result[0]).toHaveProperty('categoryName');
            expect(result[0]).toHaveProperty('confidence');
            expect(result[0]).toHaveProperty('reasons');
        });

        it('should return multiple predictions sorted by confidence', async () => {
            const result = await service.predictCategory(mockTicket as Ticket);

            if (result.length > 1) {
                expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
            }
        });

        it('should detect technical support keywords', async () => {
            const techTicket = {
                ...mockTicket,
                subject: 'Server error 500',
                description: 'API is returning internal server error',
            };

            const result = await service.predictCategory(techTicket as Ticket);

            expect(result[0].categoryName).toContain('Technical');
        });

        it('should detect billing keywords', async () => {
            const billingTicket = {
                ...mockTicket,
                subject: 'Invoice not received',
                description: 'I did not receive my monthly invoice',
            };

            const result = await service.predictCategory(billingTicket as Ticket);

            expect(result[0].categoryName).toContain('Billing');
        });

        it('should provide reasons for categorization', async () => {
            const result = await service.predictCategory(mockTicket as Ticket);

            expect(result[0].reasons).toBeInstanceOf(Array);
            expect(result[0].reasons.length).toBeGreaterThan(0);
        });

        it('should handle tickets with minimal information', async () => {
            const minimalTicket = {
                id: 'ticket-456',
                subject: 'Help',
                description: '',
            };

            const result = await service.predictCategory(minimalTicket as Ticket);

            expect(result).toBeInstanceOf(Array);
        });
    });

    describe('autoCategorizе', () => {
        it('should auto-assign category when confidence is high', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue({ ...mockTicket, categoryId: 'cat-123' });

            const result = await service.autoCategorizе('ticket-123');

            expect(result).toBeDefined();
            expect(result?.confidence).toBeGreaterThan(0.7);
        });

        it('should not auto-assign when confidence is low', async () => {
            const ambiguousTicket = {
                ...mockTicket,
                subject: 'Question',
                description: 'I have a question',
            };
            mockRepository.findOne.mockResolvedValue(ambiguousTicket);

            const result = await service.autoCategorizе('ticket-123');

            expect(result).toBeNull();
        });

        it('should throw error if ticket not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.autoCategorizе('non-existent')).rejects.toThrow();
        });

        it('should update ticket with predicted category', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue({ ...mockTicket, categoryId: 'cat-123' });

            await service.autoCategorizе('ticket-123');

            expect(mockRepository.save).toHaveBeenCalled();
        });
    });

    describe('getSuggestions', () => {
        it('should return suggestions without auto-assigning', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.getSuggestions('ticket-123');

            expect(result).toBeInstanceOf(Array);
            expect(mockRepository.save).not.toHaveBeenCalled();
        });

        it('should return top 3 suggestions', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.getSuggestions('ticket-123');

            expect(result.length).toBeLessThanOrEqual(3);
        });
    });

    describe('trainModel', () => {
        it('should train model with historical data', async () => {
            mockRepository.find.mockResolvedValue([mockTicket]);
            mockRepository.count.mockResolvedValue(100);

            const result = await service.trainModel();

            expect(result).toHaveProperty('ticketCount');
            expect(result).toHaveProperty('accuracy');
            expect(result).toHaveProperty('lastTrainedAt');
            expect(result).toHaveProperty('categories');
        });

        it('should calculate accuracy from training data', async () => {
            mockRepository.find.mockResolvedValue([mockTicket]);
            mockRepository.count.mockResolvedValue(100);

            const result = await service.trainModel();

            expect(result.accuracy).toBeGreaterThanOrEqual(0);
            expect(result.accuracy).toBeLessThanOrEqual(1);
        });
    });

    describe('getStatistics', () => {
        it('should return AI categorization statistics', async () => {
            mockRepository.count
                .mockResolvedValueOnce(500) // total predictions
                .mockResolvedValueOnce(400); // auto assigned

            const result = await service.getStatistics();

            expect(result).toHaveProperty('totalPredictions');
            expect(result).toHaveProperty('autoAssigned');
            expect(result).toHaveProperty('averageConfidence');
            expect(result).toHaveProperty('accuracyRate');
        });

        it('should calculate auto-assignment rate', async () => {
            mockRepository.count
                .mockResolvedValueOnce(100)
                .mockResolvedValueOnce(75);

            const result = await service.getStatistics();

            expect(result.autoAssigned).toBe(75);
        });
    });

    describe('validatePrediction', () => {
        it('should validate correct prediction', async () => {
            const result = await service.validatePrediction(
                'ticket-123',
                'cat-123',
                'cat-123',
            );

            expect(result).toBe(true);
        });

        it('should validate incorrect prediction', async () => {
            const result = await service.validatePrediction(
                'ticket-123',
                'cat-123',
                'cat-456',
            );

            expect(result).toBe(false);
        });
    });

    describe('edge cases', () => {
        it('should handle tickets with special characters', async () => {
            const specialTicket = {
                ...mockTicket,
                subject: '🔥 URGENT: System down!!!',
                description: 'Help @#$%',
            };

            const result = await service.predictCategory(specialTicket as Ticket);

            expect(result).toBeInstanceOf(Array);
        });

        it('should handle very long descriptions', async () => {
            const longTicket = {
                ...mockTicket,
                description: 'A'.repeat(10000),
            };

            const result = await service.predictCategory(longTicket as Ticket);

            expect(result).toBeInstanceOf(Array);
        });

        it('should handle multilingual content', async () => {
            const multilingualTicket = {
                ...mockTicket,
                subject: 'Şifre sıfırlama sorunu',
                description: 'Şifremi sıfırlayamıyorum',
            };

            const result = await service.predictCategory(multilingualTicket as Ticket);

            expect(result).toBeInstanceOf(Array);
        });
    });
});
