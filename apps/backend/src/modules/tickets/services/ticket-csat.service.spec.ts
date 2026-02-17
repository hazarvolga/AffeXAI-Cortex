import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketCSATService } from './ticket-csat.service';
import { CSATSurvey, CSATRating } from '../entities/csat-survey.entity';
import { Ticket } from '../entities/ticket.entity';
import { MailService } from '../../mail/mail.service';

describe('TicketCSATService', () => {
    let service: TicketCSATService;
    let surveyRepository: Repository<CSATSurvey>;
    let ticketRepository: Repository<Ticket>;
    let mailService: MailService;

    const mockSurvey: Partial<CSATSurvey> = {
        id: 'survey-123',
        ticketId: 'ticket-123',
        token: 'unique-token-123',
        rating: null,
        comment: null,
        sentAt: new Date(),
        respondedAt: null,
    };

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        displayNumber: 'SUP-00001',
        subject: 'Test Ticket',
    };

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            select: jest.fn().mockReturnThis(),
            getRawOne: jest.fn(),
            getMany: jest.fn(),
        })),
    };

    const mockMailService = {
        sendCSATSurvey: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketCSATService,
                {
                    provide: getRepositoryToken(CSATSurvey),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: MailService,
                    useValue: mockMailService,
                },
            ],
        }).compile();

        service = module.get<TicketCSATService>(TicketCSATService);
        surveyRepository = module.get(getRepositoryToken(CSATSurvey));
        ticketRepository = module.get(getRepositoryToken(Ticket));
        mailService = module.get<MailService>(MailService);

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sendSurvey', () => {
        it('should create and send CSAT survey for resolved ticket', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.create.mockReturnValue(mockSurvey);
            mockRepository.save.mockResolvedValue(mockSurvey);
            mockMailService.sendCSATSurvey.mockResolvedValue(true);

            const result = await service.sendSurvey('ticket-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'ticket-123' },
            });
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockMailService.sendCSATSurvey).toHaveBeenCalled();
            expect(result).toEqual(mockSurvey);
        });

        it('should generate unique token for survey', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.create.mockReturnValue(mockSurvey);
            mockRepository.save.mockResolvedValue(mockSurvey);

            await service.sendSurvey('ticket-123');

            expect(mockRepository.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    token: expect.any(String),
                }),
            );
        });

        it('should throw error if ticket not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.sendSurvey('non-existent')).rejects.toThrow();
        });

        it('should not send duplicate survey for same ticket', async () => {
            mockRepository.findOne
                .mockResolvedValueOnce(mockTicket)
                .mockResolvedValueOnce(mockSurvey); // Existing survey

            await expect(service.sendSurvey('ticket-123')).rejects.toThrow();
        });
    });

    describe('submitResponse', () => {
        it('should record CSAT rating and comment', async () => {
            mockRepository.findOne.mockResolvedValue(mockSurvey);
            mockRepository.save.mockResolvedValue({
                ...mockSurvey,
                rating: CSATRating.SATISFIED,
                comment: 'Great service!',
                respondedAt: expect.any(Date),
            });

            const result = await service.submitResponse('unique-token-123', {
                rating: CSATRating.SATISFIED,
                comment: 'Great service!',
            });

            expect(result.rating).toBe(CSATRating.SATISFIED);
            expect(result.comment).toBe('Great service!');
            expect(result.respondedAt).toBeDefined();
        });

        it('should throw error if survey not found by token', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(
                service.submitResponse('invalid-token', { rating: CSATRating.SATISFIED }),
            ).rejects.toThrow();
        });

        it('should throw error if survey already responded', async () => {
            const respondedSurvey = {
                ...mockSurvey,
                respondedAt: new Date(),
                rating: CSATRating.SATISFIED,
            };
            mockRepository.findOne.mockResolvedValue(respondedSurvey);

            await expect(
                service.submitResponse('unique-token-123', { rating: CSATRating.VERY_SATISFIED }),
            ).rejects.toThrow();
        });

        it('should accept all rating types', async () => {
            const ratings = [
                CSATRating.VERY_DISSATISFIED,
                CSATRating.DISSATISFIED,
                CSATRating.NEUTRAL,
                CSATRating.SATISFIED,
                CSATRating.VERY_SATISFIED,
            ];

            for (const rating of ratings) {
                mockRepository.findOne.mockResolvedValue(mockSurvey);
                mockRepository.save.mockResolvedValue({ ...mockSurvey, rating });

                const result = await service.submitResponse('token', { rating });
                expect(result.rating).toBe(rating);
            }
        });

        it('should allow submission without comment', async () => {
            mockRepository.findOne.mockResolvedValue(mockSurvey);
            mockRepository.save.mockResolvedValue({
                ...mockSurvey,
                rating: CSATRating.SATISFIED,
            });

            const result = await service.submitResponse('token', {
                rating: CSATRating.SATISFIED,
            });

            expect(result.rating).toBe(CSATRating.SATISFIED);
            expect(result.comment).toBeNull();
        });
    });

    describe('getSurveyByToken', () => {
        it('should return survey by token', async () => {
            mockRepository.findOne.mockResolvedValue(mockSurvey);

            const result = await service.getSurveyByToken('unique-token-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { token: 'unique-token-123' },
                relations: ['ticket'],
            });
            expect(result).toEqual(mockSurvey);
        });

        it('should return null if survey not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            const result = await service.getSurveyByToken('invalid-token');

            expect(result).toBeNull();
        });
    });

    describe('getStatistics', () => {
        it('should calculate CSAT statistics', async () => {
            mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({
                total: 100,
                responded: 80,
                avgRating: 4.2,
            });

            const result = await service.getStatistics();

            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('responded');
            expect(result).toHaveProperty('responseRate');
            expect(result).toHaveProperty('avgRating');
        });

        it('should calculate response rate correctly', async () => {
            mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({
                total: 100,
                responded: 75,
                avgRating: 4.0,
            });

            const result = await service.getStatistics();

            expect(result.responseRate).toBe(75); // 75%
        });

        it('should handle zero surveys gracefully', async () => {
            mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({
                total: 0,
                responded: 0,
                avgRating: 0,
            });

            const result = await service.getStatistics();

            expect(result.total).toBe(0);
            expect(result.responseRate).toBe(0);
        });
    });

    describe('getRatingDistribution', () => {
        it('should return distribution of ratings', async () => {
            const distribution = [
                { rating: CSATRating.VERY_SATISFIED, count: 50 },
                { rating: CSATRating.SATISFIED, count: 30 },
                { rating: CSATRating.NEUTRAL, count: 10 },
                { rating: CSATRating.DISSATISFIED, count: 5 },
                { rating: CSATRating.VERY_DISSATISFIED, count: 5 },
            ];

            mockRepository.createQueryBuilder().getMany.mockResolvedValue(distribution);

            const result = await service.getRatingDistribution();

            expect(result).toEqual(distribution);
        });
    });

    describe('getPendingSurveys', () => {
        it('should return surveys awaiting response', async () => {
            const pendingSurveys = [
                mockSurvey,
                { ...mockSurvey, id: 'survey-456', ticketId: 'ticket-456' },
            ];

            mockRepository.find.mockResolvedValue(pendingSurveys);

            const result = await service.getPendingSurveys();

            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { respondedAt: null },
                relations: ['ticket'],
            });
            expect(result).toEqual(pendingSurveys);
        });
    });
});
