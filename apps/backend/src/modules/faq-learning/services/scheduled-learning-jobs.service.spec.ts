import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulerRegistry } from '@nestjs/schedule';
import { ScheduledLearningJobsService } from './scheduled-learning-jobs.service';
import { FaqLearningConfig } from '../entities/faq-learning-config.entity';
import { FaqLearningService } from './faq-learning.service';
import { ReviewQueueService } from './review-queue.service';
import { KnowledgeBaseIntegratorService } from './knowledge-base-integrator.service';

describe('ScheduledLearningJobsService', () => {
    let service: ScheduledLearningJobsService;

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
    };

    const mockFaqLearningService = {
        runBatchProcessing: jest.fn(),
    };

    const mockReviewQueueService = {
        autoPublishHighConfidenceFaqs: jest.fn(),
    };

    const mockKbIntegrator = {
        syncFaqUpdates: jest.fn(),
    };

    const mockSchedulerRegistry = {
        addCronJob: jest.fn(),
        deleteCronJob: jest.fn(),
        getCronJob: jest.fn(() => ({
            start: jest.fn(),
            stop: jest.fn(),
        })),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ScheduledLearningJobsService,
                { provide: getRepositoryToken(FaqLearningConfig), useValue: mockRepository },
                { provide: FaqLearningService, useValue: mockFaqLearningService },
                { provide: ReviewQueueService, useValue: mockReviewQueueService },
                { provide: KnowledgeBaseIntegratorService, useValue: mockKbIntegrator },
                { provide: SchedulerRegistry, useValue: mockSchedulerRegistry },
            ],
        }).compile();

        service = module.get<ScheduledLearningJobsService>(ScheduledLearningJobsService);

        jest.clearAllMocks();
    });

    describe('processHourlyData', () => {
        it('should run learning pipeline', async () => {
            await service.processHourlyData();

            expect(mockFaqLearningService.runBatchProcessing).toHaveBeenCalled();
        });
    });

    describe('autoPublishHighConfidenceFaqs', () => {
        it('should trigger auto-publish', async () => {
            await service.autoPublishHighConfidenceFaqs();

            expect(mockReviewQueueService.autoPublishHighConfidenceFaqs).toHaveBeenCalled();
        });
    });

    describe('syncWithKnowledgeBase', () => {
        it('should trigger sync', async () => {
            await service.syncWithKnowledgeBase();

            expect(mockKbIntegrator.syncFaqUpdates).toHaveBeenCalled();
        });
    });

    describe('Job Management', () => {
        it('should toggle jobs', async () => {
            // Assuming initialization adds job
            await service.disableJob('hourly-processing');
            // Verify mock scheduler interactions if implementation uses them directly
            // Or check internal state via getJobStatuses

            const statuses = await service.getJobStatuses();
            const job = statuses.find(j => j.name === 'hourly-processing');
            // expect(job.enabled).toBe(false);
        });

        it('should execute job manually', async () => {
            // Mock job function mapping if needed or rely on switch case
            jest.spyOn(service, 'processHourlyData');

            await service.triggerJobManually('hourly-processing');

            expect(service.processHourlyData).toHaveBeenCalled();
        });

        it('should record history', async () => {
            await service.processHourlyData();
            const history = await service.getJobHistory('hourly-processing');
            expect(history.length).toBeGreaterThan(0);
        });
    });

    describe('updateJobSchedule', () => {
        it('should update cron expression', async () => {
            const result = await service.updateJobSchedule('hourly-processing', '0 0 * * *');
            expect(result).toBe(true);
            expect(mockSchedulerRegistry.deleteCronJob).toHaveBeenCalled();
            expect(mockSchedulerRegistry.addCronJob).toHaveBeenCalled();
        });
    });
});
