import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAutomationService } from './ticket-automation.service';
import { TicketsService } from '../tickets.service';
import { TicketEscalationRulesService } from './ticket-escalation-rules.service';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';

describe('TicketAutomationService', () => {
    let service: TicketAutomationService;
    let ticketsService: TicketsService;
    let escalationRulesService: TicketEscalationRulesService;
    let ticketRepository: Repository<Ticket>;
    let messageRepository: Repository<TicketMessage>;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        status: TicketStatus.PENDING_CUSTOMER,
        priority: TicketPriority.MEDIUM,
        lastCustomerResponseAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
        createdAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    };

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
    };

    const mockTicketsService = {
        updateStatus: jest.fn(),
        escalateTicket: jest.fn(),
    };

    const mockEscalationRulesService = {
        getActiveRules: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketAutomationService,
                {
                    provide: TicketsService,
                    useValue: mockTicketsService,
                },
                {
                    provide: TicketEscalationRulesService,
                    useValue: mockEscalationRulesService,
                },
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketMessage),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<TicketAutomationService>(TicketAutomationService);
        ticketsService = module.get<TicketsService>(TicketsService);
        escalationRulesService = module.get<TicketEscalationRulesService>(TicketEscalationRulesService);
        ticketRepository = module.get(getRepositoryToken(Ticket));
        messageRepository = module.get(getRepositoryToken(TicketMessage));

        jest.clearAllMocks();
    });

    describe('checkForAutoClose', () => {
        it('should auto-close tickets pending customer for 7+ days', async () => {
            mockRepository.find.mockResolvedValue([mockTicket]);
            mockTicketsService.updateStatus.mockResolvedValue(mockTicket);

            await service.checkForAutoClose();

            expect(mockTicketsService.updateStatus).toHaveBeenCalledWith(
                'ticket-123',
                TicketStatus.CLOSED,
                expect.any(String),
            );
        });

        it('should not close recent tickets', async () => {
            const recentTicket = {
                ...mockTicket,
                lastCustomerResponseAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
            };
            mockRepository.find.mockResolvedValue([recentTicket]);

            await service.checkForAutoClose();

            expect(mockTicketsService.updateStatus).not.toHaveBeenCalled();
        });
    });

    describe('checkForPendingThirdPartyTransition', () => {
        it('should transition tickets from pending third party', async () => {
            const pendingTicket = {
                ...mockTicket,
                status: TicketStatus.PENDING_THIRD_PARTY,
                lastThirdPartyResponseAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // 4 days ago
            };
            mockRepository.find.mockResolvedValue([pendingTicket]);
            mockTicketsService.updateStatus.mockResolvedValue(pendingTicket);

            await service.checkForPendingThirdPartyTransition();

            expect(mockTicketsService.updateStatus).toHaveBeenCalled();
        });
    });

    describe('checkForEscalation', () => {
        it('should escalate tickets based on rules', async () => {
            const escalationRule = {
                id: 'rule-123',
                isActive: true,
                shouldEscalate: jest.fn().mockReturnValue(true),
            };

            mockRepository.find.mockResolvedValue([mockTicket]);
            mockEscalationRulesService.getActiveRules.mockResolvedValue([escalationRule]);
            mockTicketsService.escalateTicket.mockResolvedValue(mockTicket);

            await service.checkForEscalation();

            expect(mockTicketsService.escalateTicket).toHaveBeenCalled();
        });

        it('should not escalate if no rules match', async () => {
            mockRepository.find.mockResolvedValue([mockTicket]);
            mockEscalationRulesService.getActiveRules.mockResolvedValue([]);

            await service.checkForEscalation();

            expect(mockTicketsService.escalateTicket).not.toHaveBeenCalled();
        });
    });

    describe('getHoursSinceDate', () => {
        it('should calculate hours correctly', () => {
            const past = new Date(Date.now() - 5 * 60 * 60 * 1000); // 5 hours ago
            const now = new Date();

            const hours = service['getHoursSinceDate'](past, now);

            expect(hours).toBeCloseTo(5, 0);
        });
    });
});
