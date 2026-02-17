import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TicketsService } from './tickets.service';
import { Ticket, TicketStatus, TicketPriority } from './entities/ticket.entity';
import { TicketMessage } from './entities/ticket-message.entity';
import { TicketCategory } from './entities/ticket-category.entity';
import { TicketAudit } from './entities/ticket-audit.entity';
import { User } from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { MailService } from '../mail/mail.service';
import { SlaService } from './services/sla.service';
import { TicketAssignmentService } from './services/ticket-assignment.service';
import { TicketNotificationsGateway } from './gateways/ticket-notifications.gateway';
import { SettingsService } from '../settings/settings.service';
import { AiService } from '../ai/ai.service';
import { AppLoggerService } from '../../common/logging/app-logger.service';
import { FaqEnhancedSearchService } from '../faq-learning/services/faq-enhanced-search.service';
import { KnowledgeBaseService } from './services/knowledge-base.service';

describe('TicketsService', () => {
    let service: TicketsService;
    let ticketRepository: Repository<Ticket>;
    let messageRepository: Repository<TicketMessage>;
    let categoryRepository: Repository<TicketCategory>;
    let auditRepository: Repository<TicketAudit>;
    let usersService: UsersService;
    let mailService: MailService;
    let slaService: SlaService;
    let assignmentService: TicketAssignmentService;
    let notificationsGateway: TicketNotificationsGateway;
    let settingsService: SettingsService;
    let aiService: AiService;
    let appLoggerService: AppLoggerService;
    let faqSearchService: FaqEnhancedSearchService;
    let knowledgeBaseService: KnowledgeBaseService;
    let eventEmitter: EventEmitter2;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        displayNumber: 'SUP-00001',
        subject: 'Test Ticket',
        description: 'Test Description',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
        userId: 'user-123',
        assignedToId: null,
        categoryId: 'cat-123',
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
    };

    const mockMessage: Partial<TicketMessage> = {
        id: 'msg-123',
        ticketId: 'ticket-123',
        userId: 'user-123',
        content: 'Test message',
        isInternal: false,
        createdAt: new Date(),
    };

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        find: jest.fn(),
        findOne: jest.fn(),
        update: jest.fn(),
        remove: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            orderBy: jest.fn().mockReturnThis(),
            skip: jest.fn().mockReturnThis(),
            take: jest.fn().mockReturnThis(),
            getMany: jest.fn(),
            getOne: jest.fn(),
            getCount: jest.fn(),
            select: jest.fn().mockReturnThis(),
            getRawOne: jest.fn(),
        })),
        query: jest.fn(),
    };

    const mockUsersService = {
        findOne: jest.fn(),
        findByRole: jest.fn(),
    };

    const mockMailService = {
        sendTicketCreated: jest.fn(),
        sendTicketAssigned: jest.fn(),
        sendTicketStatusChanged: jest.fn(),
        sendTicketEscalated: jest.fn(),
    };

    const mockSlaService = {
        calculateSLA: jest.fn(),
        checkSLABreach: jest.fn(),
    };

    const mockAssignmentService = {
        assignTicket: jest.fn(),
        getAvailableAgents: jest.fn(),
    };

    const mockNotificationsGateway = {
        sendTicketUpdate: jest.fn(),
        sendNewMessage: jest.fn(),
    };

    const mockSettingsService = {
        get: jest.fn(),
    };

    const mockAiService = {
        categorizeTicket: jest.fn(),
        suggestResponse: jest.fn(),
        analyzeSentiment: jest.fn(),
    };

    const mockAppLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    };

    const mockFaqSearchService = {
        search: jest.fn(),
    };

    const mockKnowledgeBaseService = {
        searchArticles: jest.fn(),
    };

    const mockEventEmitter = {
        emit: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketsService,
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketMessage),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketCategory),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(TicketAudit),
                    useValue: mockRepository,
                },
                {
                    provide: UsersService,
                    useValue: mockUsersService,
                },
                {
                    provide: MailService,
                    useValue: mockMailService,
                },
                {
                    provide: SlaService,
                    useValue: mockSlaService,
                },
                {
                    provide: TicketAssignmentService,
                    useValue: mockAssignmentService,
                },
                {
                    provide: TicketNotificationsGateway,
                    useValue: mockNotificationsGateway,
                },
                {
                    provide: SettingsService,
                    useValue: mockSettingsService,
                },
                {
                    provide: AiService,
                    useValue: mockAiService,
                },
                {
                    provide: AppLoggerService,
                    useValue: mockAppLoggerService,
                },
                {
                    provide: FaqEnhancedSearchService,
                    useValue: mockFaqSearchService,
                },
                {
                    provide: KnowledgeBaseService,
                    useValue: mockKnowledgeBaseService,
                },
                {
                    provide: EventEmitter2,
                    useValue: mockEventEmitter,
                },
            ],
        }).compile();

        service = module.get<TicketsService>(TicketsService);
        ticketRepository = module.get(getRepositoryToken(Ticket));
        messageRepository = module.get(getRepositoryToken(TicketMessage));
        categoryRepository = module.get(getRepositoryToken(TicketCategory));
        auditRepository = module.get(getRepositoryToken(TicketAudit));
        usersService = module.get<UsersService>(UsersService);
        mailService = module.get<MailService>(MailService);
        slaService = module.get<SlaService>(SlaService);
        assignmentService = module.get<TicketAssignmentService>(TicketAssignmentService);
        notificationsGateway = module.get<TicketNotificationsGateway>(TicketNotificationsGateway);
        settingsService = module.get<SettingsService>(SettingsService);
        aiService = module.get<AiService>(AiService);
        appLoggerService = module.get<AppLoggerService>(AppLoggerService);
        faqSearchService = module.get<FaqEnhancedSearchService>(FaqEnhancedSearchService);
        knowledgeBaseService = module.get<KnowledgeBaseService>(KnowledgeBaseService);
        eventEmitter = module.get<EventEmitter2>(EventEmitter2);

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('create', () => {
        it('should create a new ticket successfully', async () => {
            const createDto = {
                subject: 'Test Ticket',
                description: 'Test Description',
                priority: TicketPriority.MEDIUM,
                categoryId: 'cat-123',
            };

            mockRepository.query.mockResolvedValue([{ nextval: 1 }]);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue(mockTicket);
            mockRepository.save.mockResolvedValue(mockTicket);
            mockAiService.categorizeTicket.mockResolvedValue({ categoryId: 'cat-123', confidence: 0.9 });
            mockSlaService.calculateSLA.mockResolvedValue({ dueDate: new Date() });

            const result = await service.create('user-123', createDto);

            expect(mockRepository.query).toHaveBeenCalled();
            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockMailService.sendTicketCreated).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ticket.created', expect.any(Object));
            expect(result).toEqual(mockTicket);
        });

        it('should generate correct display number format', async () => {
            mockRepository.query.mockResolvedValue([{ nextval: 42 }]);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue({ ...mockTicket, displayNumber: 'SUP-00042' });
            mockRepository.save.mockResolvedValue({ ...mockTicket, displayNumber: 'SUP-00042' });

            const result = await service.create('user-123', {
                subject: 'Test',
                description: 'Test',
                priority: TicketPriority.MEDIUM,
            });

            expect(result.displayNumber).toBe('SUP-00042');
        });

        it('should handle AI categorization failure gracefully', async () => {
            mockRepository.query.mockResolvedValue([{ nextval: 1 }]);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue(mockTicket);
            mockRepository.save.mockResolvedValue(mockTicket);
            mockAiService.categorizeTicket.mockRejectedValue(new Error('AI service unavailable'));

            const result = await service.create('user-123', {
                subject: 'Test',
                description: 'Test',
                priority: TicketPriority.MEDIUM,
            });

            expect(result).toBeDefined();
            expect(mockAppLoggerService.error).toHaveBeenCalled();
        });

        it('should throw error if user not found', async () => {
            mockUsersService.findOne.mockResolvedValue(null);

            await expect(
                service.create('invalid-user', {
                    subject: 'Test',
                    description: 'Test',
                    priority: TicketPriority.MEDIUM,
                }),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('findAll', () => {
        it('should return all tickets with filters', async () => {
            const tickets = [mockTicket];
            mockRepository.createQueryBuilder().getMany.mockResolvedValue(tickets);

            const result = await service.findAll({
                status: TicketStatus.OPEN,
                priority: TicketPriority.HIGH,
            });

            expect(mockRepository.createQueryBuilder).toHaveBeenCalled();
            expect(result).toEqual(tickets);
        });

        it('should filter by assigned user', async () => {
            mockRepository.createQueryBuilder().getMany.mockResolvedValue([mockTicket]);

            await service.findAll({ assignedToId: 'agent-123' });

            expect(mockRepository.createQueryBuilder().andWhere).toHaveBeenCalledWith(
                expect.stringContaining('assignedToId'),
                expect.any(Object),
            );
        });

        it('should filter by date range', async () => {
            mockRepository.createQueryBuilder().getMany.mockResolvedValue([mockTicket]);

            await service.findAll({
                startDate: new Date('2024-01-01'),
                endDate: new Date('2024-12-31'),
            });

            expect(mockRepository.createQueryBuilder().andWhere).toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('should return a ticket by id', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.findOne('ticket-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'ticket-123' },
                relations: expect.any(Array),
            });
            expect(result).toEqual(mockTicket);
        });

        it('should throw NotFoundException if ticket not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.findOne('non-existent')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateStatus', () => {
        it('should update ticket status successfully', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue({ ...mockTicket, status: TicketStatus.RESOLVED });

            const result = await service.updateStatus('ticket-123', TicketStatus.RESOLVED, 'user-123');

            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockMailService.sendTicketStatusChanged).toHaveBeenCalled();
            expect(mockEventEmitter.emit).toHaveBeenCalledWith('ticket.statusChanged', expect.any(Object));
            expect(result.status).toBe(TicketStatus.RESOLVED);
        });

        it('should create audit log on status change', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue({ ...mockTicket, status: TicketStatus.RESOLVED });

            await service.updateStatus('ticket-123', TicketStatus.RESOLVED, 'user-123');

            expect(mockRepository.save).toHaveBeenCalledTimes(2); // Ticket + Audit
        });

        it('should throw error if ticket not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(
                service.updateStatus('non-existent', TicketStatus.RESOLVED, 'user-123'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('assignTo', () => {
        it('should assign ticket to agent successfully', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.save.mockResolvedValue({ ...mockTicket, assignedToId: 'agent-123' });

            const result = await service.assignTo('ticket-123', 'agent-123', 'manager-123');

            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockMailService.sendTicketAssigned).toHaveBeenCalled();
            expect(mockNotificationsGateway.sendTicketUpdate).toHaveBeenCalled();
            expect(result.assignedToId).toBe('agent-123');
        });

        it('should throw error if agent not found', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockUsersService.findOne.mockResolvedValue(null);

            await expect(
                service.assignTo('ticket-123', 'invalid-agent', 'manager-123'),
            ).rejects.toThrow(NotFoundException);
        });
    });

    describe('addMessage', () => {
        it('should add message to ticket successfully', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue(mockMessage);
            mockRepository.save.mockResolvedValue(mockMessage);

            const result = await service.addMessage('ticket-123', 'user-123', {
                content: 'Test message',
                isInternal: false,
            });

            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockNotificationsGateway.sendNewMessage).toHaveBeenCalled();
            expect(result).toEqual(mockMessage);
        });

        it('should handle attachments', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue(mockMessage);
            mockRepository.save.mockResolvedValue(mockMessage);

            await service.addMessage('ticket-123', 'user-123', {
                content: 'Test message',
                attachments: ['file1.pdf', 'file2.jpg'],
            });

            expect(mockRepository.save).toHaveBeenCalled();
        });

        it('should mark internal messages correctly', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockUsersService.findOne.mockResolvedValue(mockUser);
            mockRepository.create.mockReturnValue({ ...mockMessage, isInternal: true });
            mockRepository.save.mockResolvedValue({ ...mockMessage, isInternal: true });

            const result = await service.addMessage('ticket-123', 'user-123', {
                content: 'Internal note',
                isInternal: true,
            });

            expect(result.isInternal).toBe(true);
        });
    });

    describe('getStats', () => {
        it('should return ticket statistics', async () => {
            mockRepository.createQueryBuilder().getCount.mockResolvedValue(100);
            mockRepository.createQueryBuilder().getRawOne.mockResolvedValue({
                avgResponseTime: 3600,
                avgResolutionTime: 86400,
            });

            const result = await service.getStats();

            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('open');
            expect(result).toHaveProperty('avgResponseTime');
        });
    });

    describe('escalateTicket', () => {
        it('should escalate ticket successfully', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue({
                ...mockTicket,
                priority: TicketPriority.URGENT,
                isEscalated: true,
            });

            const result = await service.escalateTicket('ticket-123', 'manager-123', 'SLA breach');

            expect(mockRepository.save).toHaveBeenCalled();
            expect(mockMailService.sendTicketEscalated).toHaveBeenCalled();
            expect(result.priority).toBe(TicketPriority.URGENT);
        });

        it('should notify support managers on escalation', async () => {
            mockRepository.findOne.mockResolvedValue(mockTicket);
            mockRepository.save.mockResolvedValue(mockTicket);
            mockUsersService.findByRole.mockResolvedValue([mockUser]);

            await service.escalateTicket('ticket-123', 'manager-123');

            expect(mockMailService.sendTicketEscalated).toHaveBeenCalled();
        });
    });

    describe('mergeTickets', () => {
        it('should merge multiple tickets into target', async () => {
            const sourceTicket = { ...mockTicket, id: 'ticket-456' };
            mockRepository.findOne
                .mockResolvedValueOnce(mockTicket) // target
                .mockResolvedValueOnce(sourceTicket); // source

            mockRepository.find.mockResolvedValue([mockMessage]);
            mockRepository.save.mockResolvedValue(mockTicket);

            const result = await service.mergeTickets(
                ['ticket-456'],
                'ticket-123',
                'manager-123',
                'Duplicate tickets',
            );

            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(mockTicket);
        });
    });

    describe('editMessage', () => {
        it('should edit message successfully', async () => {
            mockRepository.findOne
                .mockResolvedValueOnce(mockTicket)
                .mockResolvedValueOnce(mockMessage);
            mockRepository.save.mockResolvedValue({ ...mockMessage, content: 'Edited content' });

            const result = await service.editMessage(
                'ticket-123',
                'msg-123',
                'user-123',
                'Edited content',
            );

            expect(result.content).toBe('Edited content');
        });

        it('should throw error if user not message author', async () => {
            mockRepository.findOne
                .mockResolvedValueOnce(mockTicket)
                .mockResolvedValueOnce({ ...mockMessage, userId: 'other-user' });

            await expect(
                service.editMessage('ticket-123', 'msg-123', 'user-123', 'Edited'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('deleteMessage', () => {
        it('should soft delete message', async () => {
            mockRepository.findOne
                .mockResolvedValueOnce(mockTicket)
                .mockResolvedValueOnce(mockMessage);
            mockRepository.save.mockResolvedValue({ ...mockMessage, deletedAt: new Date() });

            await service.deleteMessage('ticket-123', 'msg-123', 'user-123');

            expect(mockRepository.save).toHaveBeenCalled();
        });
    });
});
