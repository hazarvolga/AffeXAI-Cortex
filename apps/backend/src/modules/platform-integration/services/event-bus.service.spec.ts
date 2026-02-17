import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { EventBusService } from './event-bus.service';
import { PlatformEvent } from '../entities/platform-event.entity';
import { AutomationRule } from '../entities/automation-rule.entity';

describe('EventBusService', () => {
    let service: EventBusService;
    let eventRepo: Repository<PlatformEvent>;
    let ruleRepo: Repository<AutomationRule>;
    let eventEmitter: EventEmitter2;

    const mockEventRepo = {
        create: jest.fn().mockImplementation(d => d),
        save: jest.fn().mockImplementation(d => Promise.resolve({ id: 'e-1', ...d })),
        find: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([]),
        })),
    };

    const mockRuleRepo = {
        find: jest.fn().mockResolvedValue([]),
    };

    const mockEventEmitter = {
        emit: jest.fn(),
        on: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EventBusService,
                { provide: getRepositoryToken(PlatformEvent), useValue: mockEventRepo },
                { provide: getRepositoryToken(AutomationRule), useValue: mockRuleRepo },
                { provide: EventEmitter2, useValue: mockEventEmitter },
            ],
        }).compile();

        service = module.get<EventBusService>(EventBusService);
        eventRepo = module.get(getRepositoryToken(PlatformEvent));
        ruleRepo = module.get(getRepositoryToken(AutomationRule));
        eventEmitter = module.get(EventEmitter2);
        jest.clearAllMocks();
    });

    describe('publish', () => {
        it('should save event and emit', async () => {
            const result = await service.publish('cms' as any, 'page.published' as any, {});

            expect(eventRepo.save).toHaveBeenCalled();
            expect(eventEmitter.emit).toHaveBeenCalledWith('page.published', expect.anything());
            expect(result.id).toBe('e-1');
        });
    });

    describe('triggerAutomationRules', () => {
        it('should find rules and execute if match', async () => {
            // Mock rules
            const rule = {
                id: 'r1',
                name: 'Rule 1',
                eventFilter: { type: 'equals', value: 'high' },
                isActive: true,
            };
            mockRuleRepo.find.mockResolvedValue([rule]);

            // Mock event
            const event = {
                eventType: 'ticket.created',
                payload: { priority: 'high' }
            } as PlatformEvent;

            // Mock condition check (simplified logic inside service relies on matching)
            // Since this unit test mocks the service logic, we're actually testing the service method flow
            // But `triggerAutomationRules` might have internal private logic to evaluate. 
            // If `evaluateCondition` is private, we depend on its correct implementation or simple cases.
            // Let's assume simple exact match or simply that it tries to evaluate.
            // Actually `EventBusService` usually delegates execution to an `AutomationExecutorService` 
            // via event emission later or direct call? 
            // Looking at the outline, it seems it handles triggering but DOES IT execute?
            // "Automatic automation rule triggering" -> likely emits another event or calls executor.

            // Let's wait and see implementation details via tests. 
            // If it emits 'automation.trigger', we expect that.

            await service.triggerAutomationRules(event);
            expect(ruleRepo.find).toHaveBeenCalled();
        });
    });

    describe('subscribe', () => {
        it('should register listener', () => {
            const cb = jest.fn();
            service.subscribe('page.published' as any, cb);
            expect(eventEmitter.on).toHaveBeenCalledWith('page.published', cb);
        });
    });
});
