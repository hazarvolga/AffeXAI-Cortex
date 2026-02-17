import {
  Controller,
  Post,
  Get,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UseGuards,
  Req,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { TicketAttachmentService } from '../services/ticket-attachment.service';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

@ApiTags('Ticket Attachments')
@Controller('tickets/attachments')
@UseGuards(AuthGuard('jwt'))
export class TicketAttachmentsController {
  constructor(
    private readonly attachmentService: TicketAttachmentService,
  ) {}

  @Post('upload')
  @ApiOperation({ summary: 'Upload a ticket attachment' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({ 
    status: 201, 
    description: 'Attachment uploaded successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        filename: { type: 'string' },
        originalName: { type: 'string' },
        mimeType: { type: 'string' },
        size: { type: 'number' },
        url: { type: 'string' },
        type: { type: 'string' },
        uploadedAt: { type: 'string', format: 'date-time' },
      }
    }
  })
  @UseInterceptors(FileInterceptor('file'))
  async uploadAttachment(
    @UploadedFile() file: Express.Multer.File,
    @Req() req?: Request,
  ) {
    if (!file) {
      throw new BadRequestException('No file provided');
    }

    // Get user ID from request (in real implementation, this would come from auth)
    const userId = (req as any).user?.userId || 'anonymous';
    
    return this.attachmentService.uploadAttachment(file, userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket attachment by ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Attachment retrieved successfully',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        filename: { type: 'string' },
        originalName: { type: 'string' },
        mimeType: { type: 'string' },
        size: { type: 'number' },
        url: { type: 'string' },
        type: { type: 'string' },
        uploadedAt: { type: 'string', format: 'date-time' },
      }
    }
  })
  @ApiResponse({ status: 404, description: 'Attachment not found' })
  async getAttachment(@Param('id') id: string) {
    const attachment = await this.attachmentService.getAttachment(id);
    if (!attachment) {
      throw new BadRequestException('Attachment not found');
    }
    return attachment;
  }
}