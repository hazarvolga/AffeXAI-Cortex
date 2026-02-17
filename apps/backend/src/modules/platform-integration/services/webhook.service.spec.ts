import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HttpService } from '@nestjs/axios';
import { WebhookService } from './webhook.service';
import { Webhook } from '../entities/webhook.entity';
import { of, throwError } from 'rxjs';

describe('WebhookService', () => {
    let service: WebhookService;
    let repo: Repository<Webhook>;
    let httpService: HttpService;

    const mockRepo = {
        create: jest.fn().mockImplementation(d => d),
        save: jest.fn().mockImplementation(d => Promise.resolve({ id: 'w-1', ...d })),
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        })),
    };

    const mockHttpService = {
        post: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                WebhookService,
                { provide: getRepositoryToken(Webhook), useValue: mockRepo },
                { provide: HttpService, useValue: mockHttpService },
            ],
        }).compile();

        service = module.get<WebhookService>(WebhookService);
        repo = module.get(getRepositoryToken(Webhook));
        httpService = module.get(HttpService);
        jest.clearAllMocks();
    });

    describe('triggerWebhook', () => {
        it('should send payload to webhook url', async () => {
            const hook = { id: 'w1', url: 'http://test.com', isActive: true, retryCount: 3 };
            const event = { id: 'e1', eventType: 'test' };

            mockHttpService.post.mockReturnValue(of({ status: 200 }));

            await service.triggerWebhook(hook as any, event as any);

            expect(httpService.post).toHaveBeenCalledWith('http://test.com', expect.anything(), expect.anything());
        });

        it('should retry on failure', async () => {
            const hook = { id: 'w1', url: 'http://fail.com', isActive: true, retryCount: 2, retryDelay: 0 };
            const event = { id: 'e1' };

            // Fail twice then succeed? Or just fail.
            mockHttpService.post.mockReturnValue(throwError(() => new Error('Fail')));

            // Mock setTimeout to be instant? 
            // Or if it uses delay, this test might be slow. 
            // Assuming we mock delay or it's just calling sendWithRetry logic.
            // We can test 'sendWithRetry' directly if public, but it's likely private used by trigger.

            // This test attempts to trigger. It should catch error and update fails.
            await service.triggerWebhook(hook as any, event as any);

            // Should have tried multiple times
            expect(httpService.post).toHaveBeenCalledTimes(3); // Initial + 2 retries
        });
    });

    describe('findSubscribedWebhooks', () => {
        it('should return matching hooks', async () => {
            // Mock QueryBuilder response
            (mockRepo.createQueryBuilder().getMany as jest.Mock).mockResolvedValue([{ id: 'w1' }]);

            const result = await service.findSubscribedWebhooks('test.event' as any);
            expect(result.length).toBe(1);
        });
    });
});
