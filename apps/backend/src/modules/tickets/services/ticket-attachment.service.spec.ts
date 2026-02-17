import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketAttachmentService } from './ticket-attachment.service';
import { TicketAttachment } from '../entities/ticket-attachment.entity';
import { Ticket } from '../entities/ticket.entity';
import { MediaService } from '../../media/media.service';

describe('TicketAttachmentService', () => {
    let service: TicketAttachmentService;
    let repository: Repository<TicketAttachment>;
    let mediaService: MediaService;

    const mockAttachment: Partial<TicketAttachment> = {
        id: 'attach-123',
        ticketId: 'ticket-123',
        filename: 'screenshot.png',
        originalFilename: 'my-screenshot.png',
        mimeType: 'image/png',
        size: 102400, // 100KB
        url: 'https://cdn.example.com/attachments/screenshot.png',
        createdAt: new Date(),
    };

    const mockRepository = {
        create: jest.fn(),
        save: jest.fn(),
        findOne: jest.fn(),
        find: jest.fn(),
        delete: jest.fn(),
    };

    const mockMediaService = {
        uploadFile: jest.fn(),
        deleteFile: jest.fn(),
        getFileUrl: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                TicketAttachmentService,
                {
                    provide: getRepositoryToken(TicketAttachment),
                    useValue: mockRepository,
                },
                {
                    provide: getRepositoryToken(Ticket),
                    useValue: mockRepository,
                },
                {
                    provide: MediaService,
                    useValue: mockMediaService,
                },
            ],
        }).compile();

        service = module.get<TicketAttachmentService>(TicketAttachmentService);
        repository = module.get(getRepositoryToken(TicketAttachment));
        mediaService = module.get<MediaService>(MediaService);

        jest.clearAllMocks();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    describe('uploadAttachment', () => {
        it('should upload file and create attachment record', async () => {
            const file = Buffer.from('test file content');
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/file.png',
                filename: 'file.png',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            const result = await service.uploadAttachment('ticket-123', file, 'test.png');

            expect(mockMediaService.uploadFile).toHaveBeenCalled();
            expect(mockRepository.save).toHaveBeenCalled();
            expect(result).toHaveProperty('filename');
            expect(result).toHaveProperty('url');
        });

        it('should validate file size limit (10MB)', async () => {
            const largeFile = Buffer.alloc(11 * 1024 * 1024); // 11MB

            await expect(
                service.uploadAttachment('ticket-123', largeFile, 'large.zip'),
            ).rejects.toThrow('File size exceeds limit');
        });

        it('should validate allowed file types', async () => {
            const file = Buffer.from('test');

            await expect(
                service.uploadAttachment('ticket-123', file, 'malware.exe'),
            ).rejects.toThrow('File type not allowed');
        });

        it('should allow image files', async () => {
            const file = Buffer.from('image data');
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/image.jpg',
                filename: 'image.jpg',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            await expect(
                service.uploadAttachment('ticket-123', file, 'image.jpg'),
            ).resolves.not.toThrow();
        });

        it('should allow PDF files', async () => {
            const file = Buffer.from('PDF content');
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/doc.pdf',
                filename: 'doc.pdf',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            await expect(
                service.uploadAttachment('ticket-123', file, 'document.pdf'),
            ).resolves.not.toThrow();
        });

        it('should sanitize filename', async () => {
            const file = Buffer.from('test');
            const unsafeFilename = '../../../etc/passwd.txt';
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/safe.txt',
                filename: 'safe.txt',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            const result = await service.uploadAttachment('ticket-123', file, unsafeFilename);

            expect(result.filename).not.toContain('..');
            expect(result.filename).not.toContain('/');
        });

        it('should handle upload failures gracefully', async () => {
            const file = Buffer.from('test');
            mockMediaService.uploadFile.mockRejectedValue(new Error('Upload failed'));

            await expect(
                service.uploadAttachment('ticket-123', file, 'test.txt'),
            ).rejects.toThrow('Upload failed');
        });
    });

    describe('getAttachments', () => {
        it('should return all attachments for a ticket', async () => {
            mockRepository.find.mockResolvedValue([mockAttachment]);

            const result = await service.getAttachments('ticket-123');

            expect(mockRepository.find).toHaveBeenCalledWith({
                where: { ticketId: 'ticket-123' },
                order: { createdAt: 'ASC' },
            });
            expect(result).toEqual([mockAttachment]);
        });

        it('should return empty array if no attachments', async () => {
            mockRepository.find.mockResolvedValue([]);

            const result = await service.getAttachments('ticket-456');

            expect(result).toEqual([]);
        });
    });

    describe('getAttachment', () => {
        it('should return attachment by id', async () => {
            mockRepository.findOne.mockResolvedValue(mockAttachment);

            const result = await service.getAttachment('attach-123');

            expect(mockRepository.findOne).toHaveBeenCalledWith({
                where: { id: 'attach-123' },
            });
            expect(result).toEqual(mockAttachment);
        });

        it('should throw error if attachment not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.getAttachment('non-existent')).rejects.toThrow(
                'Attachment not found',
            );
        });
    });

    describe('deleteAttachment', () => {
        it('should delete attachment and file from storage', async () => {
            mockRepository.findOne.mockResolvedValue(mockAttachment);
            mockMediaService.deleteFile.mockResolvedValue(true);
            mockRepository.delete.mockResolvedValue({ affected: 1 });

            await service.deleteAttachment('attach-123');

            expect(mockMediaService.deleteFile).toHaveBeenCalledWith(mockAttachment.url);
            expect(mockRepository.delete).toHaveBeenCalledWith('attach-123');
        });

        it('should throw error if attachment not found', async () => {
            mockRepository.findOne.mockResolvedValue(null);

            await expect(service.deleteAttachment('non-existent')).rejects.toThrow();
        });

        it('should handle storage deletion failures', async () => {
            mockRepository.findOne.mockResolvedValue(mockAttachment);
            mockMediaService.deleteFile.mockRejectedValue(new Error('Storage error'));

            await expect(service.deleteAttachment('attach-123')).rejects.toThrow();
        });
    });

    describe('getTotalSize', () => {
        it('should calculate total size of ticket attachments', async () => {
            const attachments = [
                { ...mockAttachment, size: 100000 },
                { ...mockAttachment, id: 'attach-456', size: 200000 },
            ];
            mockRepository.find.mockResolvedValue(attachments);

            const result = await service.getTotalSize('ticket-123');

            expect(result).toBe(300000);
        });

        it('should return 0 for tickets with no attachments', async () => {
            mockRepository.find.mockResolvedValue([]);

            const result = await service.getTotalSize('ticket-456');

            expect(result).toBe(0);
        });
    });

    describe('edge cases', () => {
        it('should handle empty file', async () => {
            const emptyFile = Buffer.from('');

            await expect(
                service.uploadAttachment('ticket-123', emptyFile, 'empty.txt'),
            ).rejects.toThrow('File is empty');
        });

        it('should handle very long filenames', async () => {
            const file = Buffer.from('test');
            const longFilename = 'a'.repeat(300) + '.txt';
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/truncated.txt',
                filename: 'truncated.txt',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            const result = await service.uploadAttachment('ticket-123', file, longFilename);

            expect(result.filename.length).toBeLessThanOrEqual(255);
        });

        it('should handle special characters in filename', async () => {
            const file = Buffer.from('test');
            const specialFilename = 'file@#$%^&*().txt';
            mockMediaService.uploadFile.mockResolvedValue({
                url: 'https://cdn.example.com/file.txt',
                filename: 'file.txt',
            });
            mockRepository.create.mockReturnValue(mockAttachment);
            mockRepository.save.mockResolvedValue(mockAttachment);

            const result = await service.uploadAttachment('ticket-123', file, specialFilename);

            expect(result.filename).toMatch(/^[a-zA-Z0-9._-]+$/);
        });
    });
});
