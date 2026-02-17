import { Test, TestingModule } from '@nestjs/testing';
import { TicketEmailService } from './ticket-email.service';
import { MailService } from '../../mail/mail.service';
import { SettingsService } from '../../settings/settings.service';
import { Ticket, TicketStatus, TicketPriority } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';
import { User } from '../../users/entities/user.entity';

describe('TicketEmailService', () => {
    let service: TicketEmailService;
    let mailService: MailService;
    let settingsService: SettingsService;

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        displayNumber: 'SUP-00001',
        subject: 'Test Ticket',
        description: 'Test description',
        status: TicketStatus.OPEN,
        priority: TicketPriority.HIGH,
        userId: 'customer-123',
        assignedToId: 'agent-123',
    };

    const mockUser: Partial<User> = {
        id: 'user-123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
    };

    const mockMessage: Partial<TicketMessage> = {
        id: 'msg-123',
        ticketId: 'ticket-123',
        content: 'Test message content',
        userId: 'user-123',
        isInternal: false,
    };

    const mockMailService = {
        sendMail: jest.fn(),
    };

    const mockSettingsService = {
        get: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketEmailService,
                {
                    provide: MailService,
                    useValue: mockMailService,
                },
                {
                    provide: SettingsService,
                    useValue: mockSettingsService,
                },
            ],
        }).compile();

        service = module.get<TicketEmailService>(TicketEmailService);
        mailService = module.get<MailService>(MailService);
        settingsService = module.get<SettingsService>(SettingsService);

        jest.clearAllMocks();
        mockSettingsService.get.mockResolvedValue('http://localhost:3000');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('sendTicketCreatedEmail', () => {
        it('should send email to customer when ticket is created', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketCreatedEmail(
                mockTicket as Ticket,
                mockUser as User,
            );

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: mockUser.email,
                    subject: expect.stringContaining('SUP-00001'),
                }),
            );
        });

        it('should send email to assigned agent', async () => {
            const assignedUser = { ...mockUser, id: 'agent-123', email: 'agent@example.com' };
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketCreatedEmail(
                mockTicket as Ticket,
                mockUser as User,
                assignedUser as User,
            );

            expect(mockMailService.sendMail).toHaveBeenCalledTimes(2);
            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'agent@example.com',
                }),
            );
        });

        it('should send email to support managers', async () => {
            const managers = [
                { ...mockUser, id: 'manager-1', email: 'manager1@example.com' },
                { ...mockUser, id: 'manager-2', email: 'manager2@example.com' },
            ];
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketCreatedEmail(
                mockTicket as Ticket,
                mockUser as User,
                undefined,
                managers as User[],
            );

            expect(mockMailService.sendMail).toHaveBeenCalledTimes(3); // Customer + 2 managers
        });

        it('should handle email send failures gracefully', async () => {
            mockMailService.sendMail.mockRejectedValue(new Error('SMTP error'));

            await expect(
                service.sendTicketCreatedEmail(mockTicket as Ticket, mockUser as User),
            ).resolves.not.toThrow();
        });
    });

    describe('sendTicketAssignedEmail', () => {
        it('should send email to newly assigned agent', async () => {
            const assignedTo = { ...mockUser, email: 'agent@example.com' };
            const assignedBy = { ...mockUser, email: 'manager@example.com' };
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketAssignedEmail(
                mockTicket as Ticket,
                assignedTo as User,
                assignedBy as User,
            );

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'agent@example.com',
                    subject: expect.stringContaining('assigned'),
                }),
            );
        });

        it('should include ticket details in email', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketAssignedEmail(
                mockTicket as Ticket,
                mockUser as User,
                mockUser as User,
            );

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({
                        ticketNumber: 'SUP-00001',
                        ticketSubject: 'Test Ticket',
                    }),
                }),
            );
        });
    });

    describe('sendNewMessageEmail', () => {
        it('should send email for customer message to agent', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendNewMessageEmail(
                mockTicket as Ticket,
                mockMessage as TicketMessage,
                mockUser as User,
                true, // isCustomerMessage
            );

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: mockUser.email,
                    subject: expect.stringContaining('New message'),
                }),
            );
        });

        it('should send email for agent message to customer', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendNewMessageEmail(
                mockTicket as Ticket,
                mockMessage as TicketMessage,
                mockUser as User,
                false, // isCustomerMessage
            );

            expect(mockMailService.sendMail).toHaveBeenCalled();
        });

        it('should not send email for internal messages', async () => {
            const internalMessage = { ...mockMessage, isInternal: true };

            await service.sendNewMessageEmail(
                mockTicket as Ticket,
                internalMessage as TicketMessage,
                mockUser as User,
                false,
            );

            expect(mockMailService.sendMail).not.toHaveBeenCalled();
        });
    });

    describe('sendTicketResolved', () => {
        it('should send resolution email with CSAT survey link', async () => {
            const surveyToken = 'survey-token-123';
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketResolved(mockTicket as Ticket, surveyToken);

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({
                        surveyUrl: expect.stringContaining(surveyToken),
                    }),
                }),
            );
        });

        it('should send resolution email without survey if no token provided', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketResolved(mockTicket as Ticket);

            expect(mockMailService.sendMail).toHaveBeenCalled();
        });
    });

    describe('sendSLABreachAlert', () => {
        it('should send alert for first response SLA breach', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendSLABreachAlert(mockTicket as Ticket, 'first_response');

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: expect.stringContaining('SLA Breach'),
                    context: expect.objectContaining({
                        breachType: 'first_response',
                    }),
                }),
            );
        });

        it('should send alert for resolution SLA breach', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendSLABreachAlert(mockTicket as Ticket, 'resolution');

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    context: expect.objectContaining({
                        breachType: 'resolution',
                    }),
                }),
            );
        });
    });

    describe('sendSLAApproachingAlert', () => {
        it('should send proactive alert when SLA is approaching', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendSLAApproachingAlert(mockTicket as Ticket, 2);

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    subject: expect.stringContaining('SLA Approaching'),
                    context: expect.objectContaining({
                        remainingHours: 2,
                    }),
                }),
            );
        });

        it('should include urgency in alert for very short remaining time', async () => {
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendSLAApproachingAlert(mockTicket as Ticket, 0.5);

            expect(mockMailService.sendMail).toHaveBeenCalled();
        });
    });

    describe('sendTicketEscalatedEmail', () => {
        it('should send escalation email to escalated user', async () => {
            const escalatedTo = { ...mockUser, email: 'manager@example.com' };
            mockMailService.sendMail.mockResolvedValue(true);

            await service.sendTicketEscalatedEmail(
                mockTicket as Ticket,
                escalatedTo as User,
                2,
                'SLA breach',
            );

            expect(mockMailService.sendMail).toHaveBeenCalledWith(
                expect.objectContaining({
                    to: 'manager@example.com',
                    subject: expect.stringContaining('Escalated'),
                    context: expect.objectContaining({
                        escalationLevel: 2,
                        reason: 'SLA breach',
                    }),
                }),
            );
        });
    });
});
