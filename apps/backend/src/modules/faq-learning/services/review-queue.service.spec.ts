import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReviewQueueService } from './review-queue.service';
import { LearnedFaqEntry, FaqEntryStatus } from '../entities/learned-faq-entry.entity';
import { FaqLearningConfig } from '../entities/faq-learning-config.entity';
import { User } from '../../users/entities/user.entity';

describe('ReviewQueueService', () => {
    let service: ReviewQueueService;
    let faqRepository: Repository<LearnedFaqEntry>;

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
        findAndCount: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            getManyAndCount: jest.fn(),
            getMany: jest.fn(),
        })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReviewQueueService,
                { provide: getRepositoryToken(LearnedFaqEntry), useValue: mockRepository },
                { provide: getRepositoryToken(FaqLearningConfig), useValue: mockRepository },
                { provide: getRepositoryToken(User), useValue: mockRepository },
            ],
        }).compile();

        service = module.get<ReviewQueueService>(ReviewQueueService);
        faqRepository = module.get(getRepositoryToken(LearnedFaqEntry));

        jest.clearAllMocks();
    });

    describe('getReviewQueue', () => {
        it('should return paginated items', async () => {
            mockRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

            const response = await service.getReviewQueue({ page: 1, limit: 10 });

            expect(response.total).toBe(0);
            expect(response.items).toEqual([]);
        });

        it('should apply filters', async () => {
            mockRepository.createQueryBuilder().getManyAndCount.mockResolvedValue([[], 0]);

            await service.getReviewQueue({ status: [FaqEntryStatus.PENDING_REVIEW] });

            expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
        });
    });

    describe('reviewFaq', () => {
        it('should approve FAQ', async () => {
            const faq = { id: 'f1', status: FaqEntryStatus.PENDING_REVIEW };
            mockRepository.findOne.mockResolvedValue(faq);
            mockRepository.save.mockImplementation(f => Promise.resolve(f));

            const result = await service.reviewFaq({
                faqId: 'f1',
                action: 'approve',
                reviewerId: 'u1'
            });

            expect(result.status).toBe(FaqEntryStatus.APPROVED);
        });

        it('should reject FAQ', async () => {
            const faq = { id: 'f1', status: FaqEntryStatus.PENDING_REVIEW };
            mockRepository.findOne.mockResolvedValue(faq);

            const result = await service.reviewFaq({
                faqId: 'f1',
                action: 'reject',
                reviewerId: 'u1',
                reason: 'Bad quality'
            });

            expect(result.status).toBe(FaqEntryStatus.REJECTED);
        });
    });

    describe('bulkReview', () => {
        it('should process multiple items', async () => {
            const faq = { id: 'f1', status: FaqEntryStatus.PENDING_REVIEW };
            mockRepository.findOne.mockResolvedValue(faq);
            mockRepository.save.mockImplementation(f => Promise.resolve(f));

            const result = await service.bulkReview({
                faqIds: ['f1', 'f2'],
                action: 'approve',
                reviewerId: 'u1'
            });

            expect(result.successful).toHaveLength(2); // Assuming findOne returns valid for both calls or mocked accordingly
        });
    });

    describe('autoPublishHighConfidenceFaqs', () => {
        it('should publish qualified faqs', async () => {
            // Mock config
            mockRepository.findOne.mockResolvedValue({ minConfidenceForAutoPublish: 0.95 });
            // Mock find
            mockRepository.find.mockResolvedValue([{ id: 'f1' }, { id: 'f2' }]);

            const counts = await service.autoPublishHighConfidenceFaqs();

            expect(counts).toBe(2);
            expect(mockRepository.save).toHaveBeenCalledTimes(2);
        });
    });
});
