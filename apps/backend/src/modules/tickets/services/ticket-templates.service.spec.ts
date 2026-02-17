import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketTemplatesService } from './ticket-templates.service';
import { TicketTemplate } from '../entities/ticket-template.entity';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('TicketTemplatesService', () => {
    let service: TicketTemplatesService;
    let repository: Repository<TicketTemplate>;

    const mockTemplate: Partial<TicketTemplate> = {
        id: 'template-123',
        name: 'Password Reset Response',
        subject: 'Password Reset Instructions',
        content: 'Dear {{customerName}},\n\nHere are the steps to reset your password:\n1. Click on {{resetLink}}\n2. Enter your new password\n\nBest regards,\n{{agentName}}',
        variables: ['customerName', 'resetLink', 'agentName'],
        category: 'Account Support',
        isActive: true,
        usageCount: 50,
        createdAt: new Date(),
        updatedAt: new Date(),
    };

    const mockRepository = {
        find: jest.fn(),
        findOne: jest.fn(),
        create: jest.fn(),
        save: jest.fn(),
        delete: jest.fn(),
        count: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketTemplatesService,
                {
                    provide: getRepositoryToken(TicketTemplate),
                    useValue: mockRepository,
                },
            ],
        }).compile();

        service = module.get<TicketTemplatesService>(TicketTemplatesService);
        repository = module.get(getRepositoryToken(TicketTemplate));

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('getTemplates', () => {
        it('should return all active templates', async () => {
            mockRepository.find.mockResolvedValue([mockTemplate]);

            const result = await service.getTemplates();

            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { usageCount: 'DESC' },
            });
            expect(result).toEqual([mockTemplate]);
        });

        it('should return templates filtered by category', async () => {
            mockRepository.find.mockResolvedValue([mockTemplate]);

            const result = await service.getTemplates({ category: 'Account Support' });

            expect(mockRepository.find).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ category: 'Account Support' }),
                }),
            );
            expect(result).toEqual([mockTemplate]);
        });

        it('should include inactive templates when requested', async () => {
            mockRepository.find.mockResolvedValue([mockTemplate, { ...mockTemplate, isActive: false }]);

            const result = await service.getTemplates({ includeInactive: true });

            expect(result.length).toBe(2);
        });
    });

    describe('getTemplate', () => {
        it('should return template by id', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            const result = await service.getTemplate('template-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'template-123' },
            });
            expect(result).toEqual(mockTemplate);
        });

        it('should throw NotFoundException if template not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.getTemplate('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('renderTemplate', () => {
        it('should render template with all variables replaced', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            const result = await service.renderTemplate('template-123', {
                customerName: 'John Doe',
                resetLink: 'https://example.com/reset/abc123',
                agentName: 'Support Team',
            });

            expect(result).toContain('John Doe');
            expect(result).toContain('https://example.com/reset/abc123');
            expect(result).toContain('Support Team');
            expect(result).not.toContain('{{');
        });

        it('should handle missing variables gracefully', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            const result = await service.renderTemplate('template-123', {
                customerName: 'John Doe',
            });

            expect(result).toContain('John Doe');
            expect(result).toContain('{{resetLink}}'); // Unreplaced
        });

        it('should throw error if template not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(
                service.renderTemplate('non-existent', {}),
            ).rejects.toThrow(NotFoundException);
        });

        it('should increment usage count after rendering', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);
            mockRepository.save.mockResolvedValue({
                ...mockTemplate,
                usageCount: 51,
            });

            await service.renderTemplate('template-123', {});

            expect(mockRepository.save).toHaveBeenCalledWith(
                expect.objectContaining({ usageCount: 51 }),
            );
        });

        it('should handle nested variables', async () => {
            const nestedTemplate = {
                ...mockTemplate,
                content: 'Hello {{user.firstName}} {{user.lastName}}',
                variables: ['user.firstName', 'user.lastName'],
            };
            mockRepository.findOne.mockResolvedValue(nestedTemplate);

            const result = await service.renderTemplate('template-123', {
                'user.firstName': 'John',
                'user.lastName': 'Doe',
            });

            expect(result).toContain('John');
            expect(result).toContain('Doe');
        });
    });

    describe('createTemplate', () => {
        it('should create new template', async () => {
            const createDto = {
                name: 'New Template',
                subject: 'Subject',
                content: 'Content with {{variable}}',
                category: 'General',
            };

            mockRepository.create.mockReturnValue(mockTemplate);
            mockRepository.save.mockResolvedValue(mockTemplate);

            const result = await service.createTemplate(createDto);

            expect(mockRepository.create).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toEqual(mockTemplate);
        });

        it('should extract variables from content', async () => {
            const createDto = {
                name: 'Template',
                content: 'Hello {{name}}, your order {{orderId}} is ready',
            };

            mockRepository.create.mockImplementation((data) => ({
                ...mockTemplate,
                ...data,
                variables: ['name', 'orderId'],
            }));
            mockRepository.save.mockResolvedValue(mockTemplate);

            const result = await service.createTemplate(createDto);

            expect(result.variables).toContain('name');
            expect(result.variables).toContain('orderId');
        });

        it('should validate template name uniqueness', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            await expect(
                service.createTemplate({ name: 'Password Reset Response' }),
            ).rejects.toThrow(BadRequestException);
        });
    });

    describe('updateTemplate', () => {
        it('should update template', async () => {
            const updateDto = {
                name: 'Updated Template',
                content: 'Updated content',
            };

            mockRepository.findOne.mockResolvedValue(mockTemplate);
            mockRepository.save.mockResolvedValue({
                ...mockTemplate,
                ...updateDto,
            });

            const result = await service.updateTemplate('template-123', updateDto);

            expect(result.name).toBe('Updated Template');
            expect(mockRepository.save).toHaveBeenCalled();
        });

        it('should re-extract variables when content changes', async () => {
            const updateDto = {
                content: 'New {{var1}} and {{var2}}',
            };

            mockRepository.findOne.mockResolvedValue(mockTemplate);
            mockRepository.save.mockResolvedValue({
                ...mockTemplate,
                ...updateDto,
                variables: ['var1', 'var2'],
            });

            const result = await service.updateTemplate('template-123', updateDto);

            expect(result.variables).toContain('var1');
            expect(result.variables).toContain('var2');
        });
    });

    describe('deleteTemplate', () => {
        it('should delete template', async () => {
            mockRepository.delete.mockResolvedValue({ affected: 1 });

            await service.deleteTemplate('template-123');

            expect(mockRepository.delete).toHaveBeenCalledWith('template-123');
        });

        it('should throw error if template not found', async () => {
            mockRepository.delete.mockResolvedValue({ affected: 0 });

            await expect(service.deleteTemplate('non-existent')).rejects.toThrow(
                NotFoundException,
            );
        });
    });

    describe('getPopularTemplates', () => {
        it('should return most used templates', async () => {
            const templates = [
                { ...mockTemplate, usageCount: 100 },
                { ...mockTemplate, id: 'template-456', usageCount: 50 },
            ];
            mockRepository.find.mockResolvedValue(templates);

            const result = await service.getPopularTemplates(10);

            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { isActive: true },
                order: { usageCount: 'DESC' },
                take: 10,
            });
            expect(result[0].usageCount).toBeGreaterThanOrEqual(result[1].usageCount);
        });
    });

    describe('getStatistics', () => {
        it('should return template statistics', async () => {
            mockRepository.count
                .mockResolvedValueOnce(50) // total
                .mockResolvedValueOnce(45); // active

            const result = await service.getStatistics();

            expect(result).toHaveProperty('total');
            expect(result).toHaveProperty('active');
            expect(result).toHaveProperty('inactive');
            expect(result.inactive).toBe(5);
        });
    });

    describe('edge cases', () => {
        it('should handle templates with no variables', async () => {
            const staticTemplate = {
                ...mockTemplate,
                content: 'Static content with no variables',
                variables: [],
            };
            mockRepository.findOne.mockResolvedValue(staticTemplate);

            const result = await service.renderTemplate('template-123', {});

            expect(result).toBe('Static content with no variables');
        });

        it('should handle empty variable values', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            const result = await service.renderTemplate('template-123', {
                customerName: '',
                resetLink: '',
                agentName: '',
            });

            expect(result).not.toContain('{{');
        });

        it('should handle special characters in variables', async () => {
            mockRepository.findOne.mockResolvedValue(mockTemplate);

            const result = await service.renderTemplate('template-123', {
                customerName: "O'Brien & Co.",
                resetLink: 'https://example.com/reset?token=abc&user=123',
                agentName: 'Support <Team>',
            });

            expect(result).toContain("O'Brien & Co.");
            expect(result).toContain('https://example.com/reset?token=abc&user=123');
        });
    });
});
