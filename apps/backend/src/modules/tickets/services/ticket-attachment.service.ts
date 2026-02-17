import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { MediaService } from '../../media/media.service';
import { Media, MediaType, StorageType } from '@affexai/shared-types';
import { v4 as uuidv4 } from 'uuid';
import { TenantService } from '../../../core/tenant/tenant.service';

export interface TicketAttachment {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  type: MediaType;
  uploadedAt: Date;
}

@Injectable()
export class TicketAttachmentService {
  private readonly logger = new Logger(TicketAttachmentService.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly tenantService: TenantService,
  ) { }

  /**
   * Get current tenant ID from TenantService
   * @private
   */
  private getActiveTenantId(): string {
    return this.tenantService.getTenantId();
  }

  /**
   * Handle ticket attachment upload
   */
  async uploadAttachment(
    file: Express.Multer.File,
    uploaderId: string
  ): Promise<TicketAttachment> {
    try {
      // Validate file
      this.validateFile(file);

      // Determine media type based on MIME type
      const mediaType = this.determineMediaType(file.mimetype);

      // Create media entity
      const media = await this.mediaService.create({
        filename: `${uuidv4()}-${file.originalname}`,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/tickets/${uuidv4()}-${file.originalname}`,
        type: mediaType,
        storageType: StorageType.LOCAL,
        title: file.originalname,
        description: `Ticket attachment uploaded by ${uploaderId}`,
        isActive: true,
      }, this.getActiveTenantId());

      const attachment: TicketAttachment = {
        id: media.id,
        filename: media.filename,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        url: media.url,
        type: media.type,
        uploadedAt: new Date(),
      };

      this.logger.log(`Ticket attachment uploaded: ${file.originalname} (${file.size} bytes)`);

      return attachment;
    } catch (error) {
      this.logger.error(`Failed to upload ticket attachment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get attachment by ID
   */
  async getAttachment(id: string): Promise<TicketAttachment | null> {
    try {
      const tenantId = this.getActiveTenantId();
      const media = await this.mediaService.findOne(id, tenantId);
      if (!media) {
        return null;
      }

      return {
        id: media.id,
        filename: media.filename,
        originalName: media.originalName,
        mimeType: media.mimeType,
        size: media.size,
        url: media.url,
        type: media.type,
        uploadedAt: media.createdAt,
      };
    } catch (error) {
      this.logger.error(`Failed to get ticket attachment: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Validate uploaded file
   */
  private validateFile(file: Express.Multer.File): void {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Check file size (max 10MB for ticket attachments)
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('File size exceeds maximum allowed size of 10MB');
    }

    // Check file type
    const allowedTypes = [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Documents
      'text/plain',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text files
      'text/csv',
      'text/markdown',
    ];

    if (!allowedTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `File type ${file.mimetype} is not allowed for ticket attachments`
      );
    }
  }

  /**
   * Determine media type based on MIME type
   */
  private determineMediaType(mimeType: string): MediaType {
    if (mimeType.startsWith('image/')) {
      return MediaType.IMAGE;
    }
    if (mimeType.startsWith('video/')) {
      return MediaType.VIDEO;
    }
    if (mimeType.startsWith('audio/')) {
      return MediaType.AUDIO;
    }
    return MediaType.DOCUMENT;
  }
}