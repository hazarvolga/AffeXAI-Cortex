import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AutomationExecutorService } from './automation-executor.service';
import { AutomationRule } from '../entities/automation-rule.entity';
import { AutomationApproval } from '../entities/automation-approval.entity';

describe('AutomationExecutorService', () => {
    let service: AutomationExecutorService;
    let ruleRepo: Repository<AutomationRule>;
    let approvalRepo: Repository<AutomationApproval>;

    const mockRuleRepo = {
        find: jest.fn(),
        findOne: jest.fn(),
    };

    const mockApprovalRepo = {
        create: jest.fn().mockImplementation(d => d),
        save: jest.fn().mockImplementation(d => Promise.resolve({ id: 'a-1', ...d })),
        find: jest.fn(),
        findOne: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AutomationExecutorService,
                { provide: getRepositoryToken(AutomationRule), useValue: mockRuleRepo },
                { provide: getRepositoryToken(AutomationApproval), useValue: mockApprovalRepo },
            ],
        }).compile();

        service = module.get<AutomationExecutorService>(AutomationExecutorService);
        ruleRepo = module.get(getRepositoryToken(AutomationRule));
        approvalRepo = module.get(getRepositoryToken(AutomationApproval));
        jest.clearAllMocks();
    });

    describe('handleAutomationTrigger', () => {
        it('should execute rule if conditions met', async () => {
            const data = {
                rule: { id: 'r1', actions: [], conditions: {} },
                event: { id: 'e1' }
            };

            // Mock internal check for conditions or simplified flow
            // Assuming we're testing the public method integrating evaluation + execution
            jest.spyOn(service as any, 'executeRule').mockResolvedValue(undefined);

            await service.handleAutomationTrigger(data as any);

            expect(service['executeRule']).toHaveBeenCalled();
        });
    });

    describe('createApprovalRequest', () => {
        it('should save approval request', async () => {
            const rule = { id: 'r1', actions: [{ type: 'delete' }] };
            const event = { id: 'e1' };

            await service.createApprovalRequest(rule as any, event as any);

            expect(approvalRepo.save).toHaveBeenCalled();
        });
    });

    describe('executeApprovedAutomation', () => {
        it('should execute if approved', async () => {
            mockApprovalRepo.findOne.mockResolvedValue({
                id: 'a1',
                status: 'APPROVED',
                rule: { id: 'r1' },
                event: { id: 'e1' }
            });
            jest.spyOn(service as any, 'executeRule').mockResolvedValue(undefined);

            await service.executeApprovedAutomation('a1');

            expect(service['executeRule']).toHaveBeenCalled();
        });

        it('should throw if not approved', async () => {
            mockApprovalRepo.findOne.mockResolvedValue({ status: 'PENDING' });

            await expect(service.executeApprovedAutomation('a1'))
                .rejects.toThrow();
        });
    });

    describe('shouldAutoApprove', () => {
        it('should return true for low impact', () => {
            const rule = { autoApprove: true };
            const result = service.shouldAutoApprove(rule as any, {} as any);
            // Logic depends on impact implementation. 
            // If simply checking property:
            expect(result).toBe(true);
            // Ideally we mock 'estimateActionImpact' if used internallys
        });
    });

    describe('estimateActionImpact', () => {
        it('should calculate impact', () => {
            const result = service.estimateActionImpact({ type: 'email' } as any, {} as any);
            // Assuming basic logic returns some structure
            expect(result).toBeDefined();
        });
    });
});
