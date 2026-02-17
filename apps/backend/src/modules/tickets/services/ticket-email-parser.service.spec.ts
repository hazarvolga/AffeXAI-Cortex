import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketEmailParserService, ParsedEmail } from './ticket-email-parser.service';
import { TicketsService } from '../tickets.service';
import { Ticket, TicketPriority, TicketStatus } from '../entities/ticket.entity';
import { TicketMessage } from '../entities/ticket-message.entity';

describe('TicketEmailParserService', () => {
    let service: TicketEmailParserService;
    let ticketsService: TicketsService;
    let ticketRepository: Repository<Ticket>;
    let messageRepository: Repository<TicketMessage>;

    const mockParsedEmail: ParsedEmail = {
        from: 'customer@example.com',
        fromName: 'John Doe',
        to: 'support@company.com',
        subject: 'Need help with product',
        textBody: 'I am having issues with the product. Please help urgently!',
        htmlBody: '<p>I am having issues with the product. Please help urgently!</p>',
        messageId: 'msg-123@example.com',
        receivedAt: new Date(),
        inReplyTo: null,
        references: [],
        attachments: [],
    };

    const mockTicket: Partial<Ticket> = {
        id: 'ticket-123',
        displayNumber: 'SUP-00001',
        subject: 'Need help with product',
        status: TicketStatus.OPEN,
        priority: TicketPriority.MEDIUM,
    };

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        createQueryBuilder: jest.fn(() => ({
            where: jest.fn().mockReturnThis(),
            orWhere: jest.fn().mockReturnThis(),
            getOne: jest.fn(),
        })),
    };

    const mockTicketsService = {
        create: jest.fn(),
        addMessage: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketEmailParserService,
                {
                    provide: TicketsService,
                    useValue: mockTicketsService,
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

        service = module.get<TicketEmailParserService>(TicketEmailParserService);
        ticketsService = module.get<TicketsService>(TicketsService);
        ticketRepository = module.get(getRepositoryToken(Ticket));
        messageRepository = module.get(getRepositoryToken(TicketMessage));

        jest.clearAllMocks();
    });

    describe('processInboundEmail', () => {
        it('should create new ticket if no existing ticket found', async () => {
            mockRepository.createQueryBuilder().getOne.mockResolvedValue(null);
            mockTicketsService.create.mockResolvedValue(mockTicket);

            const result = await service.processInboundEmail(mockParsedEmail);

            expect(mockTicketsService.create).toHaveBeenCalled();
            expect(result).toEqual(mockTicket);
        });

        it('should add message to existing ticket if found', async () => {
            mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockTicket);
            mockTicketsService.addMessage.mockResolvedValue({});
            mockRepository.save.mockResolvedValue(mockTicket);

            const result = await service.processInboundEmail(mockParsedEmail);

            expect(mockTicketsService.addMessage).toHaveBeenCalled();
            expect(result).toEqual(mockTicket);
        });

        it('should handle email with attachments', async () => {
            const emailWithAttachments: ParsedEmail = {
                ...mockParsedEmail,
                attachments: [
                    {
                        filename: 'screenshot.png',
                        contentType: 'image/png',
                        content: Buffer.from('fake-image-data'),
                        size: 1024,
                    },
                ],
            };

            mockRepository.createQueryBuilder().getOne.mockResolvedValue(null);
            mockTicketsService.create.mockResolvedValue(mockTicket);

            await service.processInboundEmail(emailWithAttachments);

            expect(mockTicketsService.create).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    attachments: expect.arrayContaining([
                        expect.objectContaining({ filename: 'screenshot.png' }),
                    ]),
                }),
            );
        });
    });

    describe('findTicketByEmail', () => {
        it('should find ticket by message ID in references', async () => {
            const emailWithReferences: ParsedEmail = {
                ...mockParsedEmail,
                references: ['original-msg-id@example.com'],
            };

            mockRepository.createQueryBuilder().getOne.mockResolvedValue(mockTicket);

            const result = await service.findTicketByEmail(emailWithReferences);

            expect(result).toEqual(mockTicket);
        });

        it('should find ticket by subject line ticket ID', async () => {
            const emailWithTicketId: ParsedEmail = {
                ...mockParsedEmail,
                subject: 'Re: [#SUP-00001] Need help',
            };

            mockRepository.findOne.mockResolvedValue(mockTicket);

            const result = await service.findTicketByEmail(emailWithTicketId);

            expect(result).toEqual(mockTicket);
        });

        it('should return null if no ticket found', async () => {
            mockRepository.createQueryBuilder().getOne.mockResolvedValue(null);
            mockRepository.findOne.mockResolvedValue(null);

            const result = await service.findTicketByEmail(mockParsedEmail);

            expect(result).toBeNull();
        });
    });

    describe('extractTicketIdFromSubject', () => {
        it('should extract ticket ID from [#SUP-00001] format', () => {
            const result = service.extractTicketIdFromSubject('[#SUP-00001] Test subject');
            expect(result).toBe('SUP-00001');
        });

        it('should extract ticket ID from Ticket #123 format', () => {
            const result = service.extractTicketIdFromSubject('Ticket #123 - Issue');
            expect(result).toBe('123');
        });

        it('should extract ticket ID from Re: #123 format', () => {
            const result = service.extractTicketIdFromSubject('Re: #123 Follow up');
            expect(result).toBe('123');
        });

        it('should return null if no ticket ID found', () => {
            const result = service.extractTicketIdFromSubject('Regular subject without ID');
            expect(result).toBeNull();
        });

        it('should handle multiple ticket ID formats', () => {
            expect(service.extractTicketIdFromSubject('[TICKET-456]')).toBe('TICKET-456');
            expect(service.extractTicketIdFromSubject('Fwd: #789')).toBe('789');
        });
    });

    describe('detectPriority', () => {
        it('should detect URGENT priority from keywords', () => {
            const result = service.detectPriority('URGENT: System down', 'This is critical!');
            expect(result).toBe(TicketPriority.URGENT);
        });

        it('should detect HIGH priority from keywords', () => {
            const result = service.detectPriority('Important issue', 'High priority matter');
            expect(result).toBe(TicketPriority.HIGH);
        });

        it('should detect MEDIUM priority as default', () => {
            const result = service.detectPriority('Regular question', 'Normal inquiry');
            expect(result).toBe(TicketPriority.MEDIUM);
        });

        it('should detect LOW priority from keywords', () => {
            const result = service.detectPriority('Minor question', 'Low priority');
            expect(result).toBe(TicketPriority.LOW);
        });

        it('should be case-insensitive', () => {
            expect(service.detectPriority('urgent issue', '')).toBe(TicketPriority.URGENT);
            expect(service.detectPriority('CRITICAL PROBLEM', '')).toBe(TicketPriority.URGENT);
        });
    });

    describe('cleanSubject', () => {
        it('should remove Re: prefix', () => {
            const result = service.cleanSubject('Re: Original subject');
            expect(result).toBe('Original subject');
        });

        it('should remove Fwd: prefix', () => {
            const result = service.cleanSubject('Fwd: Forwarded message');
            expect(result).toBe('Forwarded message');
        });

        it('should remove multiple Re: prefixes', () => {
            const result = service.cleanSubject('Re: Re: Re: Subject');
            expect(result).toBe('Subject');
        });

        it('should handle mixed prefixes', () => {
            const result = service.cleanSubject('Re: Fwd: Re: Message');
            expect(result).toBe('Message');
        });

        it('should trim whitespace', () => {
            const result = service.cleanSubject('  Re:  Subject  ');
            expect(result).toBe('Subject');
        });
    });

    describe('removeEmailSignature', () => {
        it('should remove signature after -- delimiter', () => {
            const content = 'Email body\n--\nJohn Doe\nCompany Inc.';
            const result = service.removeEmailSignature(content);
            expect(result).not.toContain('John Doe');
            expect(result).toContain('Email body');
        });

        it('should remove signature after Best regards', () => {
            const content = 'Email body\nBest regards,\nJohn Doe';
            const result = service.removeEmailSignature(content);
            expect(result).toContain('Email body');
        });

        it('should handle content without signature', () => {
            const content = 'Just email body';
            const result = service.removeEmailSignature(content);
            expect(result).toBe('Just email body');
        });
    });

    describe('removeQuotedReplies', () => {
        it('should remove lines starting with >', () => {
            const content = 'New message\n> Quoted text\n> More quoted';
            const result = service.removeQuotedReplies(content);
            expect(result).toContain('New message');
            expect(result).not.toContain('> Quoted');
        });

        it('should preserve non-quoted lines', () => {
            const content = 'Line 1\n> Quoted\nLine 2';
            const result = service.removeQuotedReplies(content);
            expect(result).toContain('Line 1');
            expect(result).toContain('Line 2');
        });
    });

    describe('extractTags', () => {
        it('should extract tags from subject and body', () => {
            const result = service.extractTags(
                'Subject with #bug and #urgent',
                'Body with #feature-request',
            );
            expect(result).toContain('bug');
            expect(result).toContain('urgent');
            expect(result).toContain('feature-request');
        });

        it('should return unique tags', () => {
            const result = service.extractTags('#bug #bug', '#bug');
            expect(result).toEqual(['bug']);
        });

        it('should handle no tags', () => {
            const result = service.extractTags('No tags here', 'Nothing');
            expect(result).toEqual([]);
        });
    });

    describe('validateEmail', () => {
        it('should validate correct email format', () => {
            expect(service.validateEmail('test@example.com')).toBe(true);
            expect(service.validateEmail('user.name@company.co.uk')).toBe(true);
        });

        it('should reject invalid email format', () => {
            expect(service.validateEmail('invalid-email')).toBe(false);
            expect(service.validateEmail('@example.com')).toBe(false);
            expect(service.validateEmail('test@')).toBe(false);
        });
    });
});
