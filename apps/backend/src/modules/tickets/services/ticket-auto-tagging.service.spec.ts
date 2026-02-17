import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAutoTaggingService } from './ticket-auto-tagging.service';
import { Ticket, TicketPriority, TicketStatus } from '../entities/ticket.entity';
import { TicketTag } from '../entities/ticket-tag.entity';

describe('TicketAutoTaggingService', () => {
    let service: TicketAutoTaggingService;
    let ticketRepository: Repository<Ticket>;
    let tagRepository: Repository<TicketTag>;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        subject: 'Urgent: Production server down',
        description: 'The production API server is not responding. Critical issue affecting all users.',
        priority: TicketPriority.URGENT,
        status: TicketStatus.OPEN,
        tags: [],
    };

    const mockTag: Partial<TicketTag> = {
        id: 'tag-123',
        name: 'urgent',
        color: '#ff0000',
    };

    const mockRepository = {
        findOne: jest.fn(),
        find: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketAutoTaggingService,
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketTag),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<TicketAutoTaggingService>(TicketAutoTaggingService);
        ticketRepository = module.get(getRepositoryToken(Ticket));
        tagRepository = module.get(getRepositoryToken(TicketTag));

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('autoTagTicket', () => {
        it('should auto-tag ticket based on content keywords', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.find.mockResolvedValue([mockTag]);
            mockRepository.save.mockResolvedValue({
                ...mockTicket,
                tags: ['urgent', 'production', 'server'],
            });

            const result = await service.autoTagTicket(mockTicket as Ticket);

            expect(result.tags).toContain('urgent');
            expect(result.tags).toContain('production');
            expect(result.tags).toContain('server');
        });

        it('should detect priority-based tags', async () => {
            const urgentTicket = {
                ...mockTicket,
                subject: 'CRITICAL: Data loss',
                priority: TicketPriority.URGENT,
            };
            mockRepository.findOne.mockResolvedValue(urgentTicket);
            mockRepository.save.mockResolvedValue(urgentTicket);

            const result = await service.autoTagTicket(urgentTicket as Ticket);

            expect(result.tags).toContain('critical');
        });

        it('should detect technical keywords', async () => {
            const techTicket = {
                ...mockTicket,
                subject: 'API error 500',
                description: 'Database connection timeout',
            };
            mockRepository.findOne.mockResolvedValue(techTicket);
            mockRepository.save.mockResolvedValue(techTicket);

            const result = await service.autoTagTicket(techTicket as Ticket);

            expect(result.tags).toContain('api');
            expect(result.tags).toContain('database');
        });

        it('should detect billing keywords', async () => {
            const billingTicket = {
                ...mockTicket,
                subject: 'Invoice payment failed',
                description: 'Credit card declined',
            };
            mockRepository.findOne.mockResolvedValue(billingTicket);
            mockRepository.save.mockResolvedValue(billingTicket);

            const result = await service.autoTagTicket(billingTicket as Ticket);

            expect(result.tags).toContain('billing');
            expect(result.tags).toContain('payment');
        });

        it('should not duplicate existing tags', async () => {
            const taggedTicket = {
                ...mockTicket,
                tags: ['urgent', 'production'],
            };
            mockRepository.findOne.mockResolvedValue(taggedTicket);
            mockRepository.save.mockResolvedValue(taggedTicket);

            const result = await service.autoTagTicket(taggedTicket as Ticket);

            const urgentCount = result.tags.filter(t => t === 'urgent').length;
            expect(urgentCount).toBe(1);
        });

        it('should handle case-insensitive matching', async () => {
            const mixedCaseTicket = {
                ...mockTicket,
                subject: 'URGENT: Server DOWN',
            };
            mockRepository.findOne.mockResolvedValue(mixedCaseTicket);
            mockRepository.save.mockResolvedValue(mixedCaseTicket);

            const result = await service.autoTagTicket(mixedCaseTicket as Ticket);

            expect(result.tags).toContain('urgent');
            expect(result.tags).toContain('server');
        });

        it('should limit maximum number of tags', async () => {
            const verboseTicket = {
                ...mockTicket,
                subject: 'urgent critical important high priority server api database payment billing',
                description: 'Many keywords here',
            };
            mockRepository.findOne.mockResolvedValue(verboseTicket);
            mockRepository.save.mockResolvedValue(verboseTicket);

            const result = await service.autoTagTicket(verboseTicket as Ticket);

            expect(result.tags.length).toBeLessThanOrEqual(10);
        });
    });

    describe('extractKeywords', () => {
        it('should extract keywords from subject and description', () => {
            const keywords = service.extractKeywords(mockTicket as Ticket);

            expect(keywords).toBeInstanceOf(Array);
            expect(keywords.length).toBeGreaterThan(0);
        });

        it('should filter out common stop words', () => {
            const ticket = {
                ...mockTicket,
                subject: 'The server is not working',
            };

            const keywords = service.extractKeywords(ticket as Ticket);

            expect(keywords).not.toContain('the');
            expect(keywords).not.toContain('is');
            expect(keywords).not.toContain('not');
        });

        it('should normalize keywords to lowercase', () => {
            const ticket = {
                ...mockTicket,
                subject: 'URGENT SERVER',
            };

            const keywords = service.extractKeywords(ticket as Ticket);

            keywords.forEach(keyword => {
                expect(keyword).toBe(keyword.toLowerCase());
            });
        });
    });

    describe('suggestTags', () => {
        it('should suggest tags without applying them', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.suggestTags('ticket-123');

            expect(result).toBeInstanceOf(Array);
            expect(mockRepository.save).not.toHaveBeenCalled();
        });

        it('should return confidence scores for suggestions', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.suggestTags('ticket-123');

            result.forEach(suggestion => {
                expect(suggestion).toHaveProperty('tag');
                expect(suggestion).toHaveProperty('confidence');
                expect(suggestion.confidence).toBeGreaterThanOrEqual(0);
                expect(suggestion.confidence).toBeLessThanOrEqual(1);
            });
        });
    });

    describe('removeTag', () => {
        it('should remove tag from ticket', async () => {
            const taggedTicket = {
                ...mockTicket,
                tags: ['urgent', 'production', 'server'],
            };
            mockRepository.findOne.mockResolvedValue(taggedTicket);
            mockRepository.save.mockResolvedValue({
                ...taggedTicket,
                tags: ['production', 'server'],
            });

            const result = await service.removeTag('ticket-123', 'urgent');

            expect(result.tags).not.toContain('urgent');
            expect(result.tags).toContain('production');
        });
    });

    describe('getTagStatistics', () => {
        it('should return tag usage statistics', async () => {
            mockRepository.find.mockResolvedValue([
                { ...mockTicket, tags: ['urgent', 'production'] },
                { ...mockTicket, id: 'ticket-456', tags: ['urgent', 'billing'] },
            ]);

            const result = await service.getTagStatistics();

            expect(result).toBeInstanceOf(Array);
            expect(result[0]).toHaveProperty('tag');
            expect(result[0]).toHaveProperty('count');
        });

        it('should sort tags by usage count', async () => {
            mockRepository.find.mockResolvedValue([
                { ...mockTicket, tags: ['urgent', 'production'] },
                { ...mockTicket, id: 'ticket-456', tags: ['urgent'] },
            ]);

            const result = await service.getTagStatistics();

            if (result.length > 1) {
                expect(result[0].count).toBeGreaterThanOrEqual(result[1].count);
            }
        });
    });

    describe('edge cases', () => {
        it('should handle tickets with no content', async () => {
            const emptyTicket = {
                id: 'ticket-789',
                subject: '',
                description: '',
                tags: [],
            };
            mockRepository.findOne.mockResolvedValue(emptyTicket);
            mockRepository.save.mockResolvedValue(emptyTicket);

            const result = await service.autoTagTicket(emptyTicket as Ticket);

            expect(result.tags).toEqual([]);
        });

        it('should handle special characters in content', async () => {
            const specialTicket = {
                ...mockTicket,
                subject: '🔥 URGENT!!! @#$%',
            };
            mockRepository.findOne.mockResolvedValue(specialTicket);
            mockRepository.save.mockResolvedValue(specialTicket);

            const result = await service.autoTagTicket(specialTicket as Ticket);

            expect(result.tags).toContain('urgent');
        });

        it('should handle multilingual content', async () => {
            const turkishTicket = {
                ...mockTicket,
                subject: 'Acil: Sunucu çalışmıyor',
                description: 'Üretim sunucusu yanıt vermiyor',
            };
            mockRepository.findOne.mockResolvedValue(turkishTicket);
            mockRepository.save.mockResolvedValue(turkishTicket);

            const result = await service.autoTagTicket(turkishTicket as Ticket);

            expect(result).toBeDefined();
        });
    });
});
