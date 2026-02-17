import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  NotFoundException,
  UseInterceptors,
  UploadedFile,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { MediaService } from './media.service';
import { S3Service } from './s3.service';
import { CreateMediaDto } from './dto/create-media.dto';
import { UpdateMediaDto } from './dto/update-media.dto';
import { Media } from './entities/media.entity';
import { MediaType, StorageType, MediaModule, MediaCategory } from '@affexai/shared-types';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { ConfigService } from '@nestjs/config';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';

@ApiTags('media')
@Controller('media')
@UseGuards(JwtAuthGuard)
export class MediaController {
  private readonly logger = new Logger(MediaController.name);

  constructor(
    private readonly mediaService: MediaService,
    private readonly s3Service: S3Service,
    private readonly configService: ConfigService,
  ) { }

  @Post()
  @ApiOperation({ summary: 'Create a media entry' })
  create(@Body() createMediaDto: CreateMediaDto): Promise<Media> {
    return this.mediaService.create(createMediaDto);
  }

  @Get('filter')
  @ApiOperation({ summary: 'Find media with advanced filters' })
  findWithFilters(
    @Query('type') type?: string,
    @Query('module') module?: MediaModule,
    @Query('category') category?: MediaCategory,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<{ data: Media[]; total: number } | Media[]> {
    return this.mediaService.findWithFilters({
      type: type as MediaType,
      module,
      category,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 50,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all media files' })
  findAll(): Promise<Media[]> {
    return this.mediaService.findAll();
  }

  @Get('modules')
  @ApiOperation({ summary: 'Get module counts' })
  getModulesWithCount() {
    return this.mediaService.getModulesWithCount();
  }

  @Get('categories')
  @ApiOperation({ summary: 'Get category counts' })
  getCategoriesWithCount() {
    return this.mediaService.getCategoriesWithCount();
  }

  @Get('by-module/:module')
  @ApiOperation({ summary: 'Find by module' })
  findByModule(@Param('module') module: MediaModule): Promise<Media[]> {
    return this.mediaService.findByModule(module);
  }

  @Get('by-category/:category')
  @ApiOperation({ summary: 'Find by category' })
  findByCategory(@Param('category') category: MediaCategory): Promise<Media[]> {
    return this.mediaService.findByCategory(category);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one media entry' })
  findOne(@Param('id') id: string): Promise<Media> {
    return this.mediaService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update media' })
  update(
    @Param('id') id: string,
    @Body() updateMediaDto: UpdateMediaDto,
  ): Promise<Media> {
    return this.mediaService.update(id, updateMediaDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete media' })
  remove(@Param('id') id: string): Promise<void> {
    return this.mediaService.remove(id);
  }

  @Post('upload')
  @ApiOperation({ summary: 'Upload a file to S3' })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      fileFilter: (req, file, cb) => {
        if (!file.originalname.match(/\.(jpg|jpeg|png|gif|svg|webp)$/)) {
          return cb(new Error('Only image files are allowed!'), false);
        }
        cb(null, true);
      },
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      },
    }),
  )
  async uploadFile(
    @UploadedFile() file: any,
    @CurrentUser() user: any,
    @Query('module') module?: MediaModule,
    @Query('category') category?: MediaCategory,
    @Query('tags') tags?: string,
  ) {
    if (!file) {
      throw new NotFoundException('File not found');
    }

    this.logger.log(`Uploading file ${file.originalname} to S3...`);

    const uniqueSuffix = uuidv4().split('-')[0];
    const ext = extname(file.originalname);
    const basename = file.originalname.replace(ext, '');

    const slug = basename
      .toLowerCase()
      .replace(/ğ/g, 'g')
      .replace(/ü/g, 'u')
      .replace(/ş/g, 's')
      .replace(/ı/g, 'i')
      .replace(/ö/g, 'o')
      .replace(/ç/g, 'c')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const filename = `${slug}-${uniqueSuffix}${ext}`;

    let uploadPath = 'uploads';
    if (module) {
      uploadPath = module.toString().toLowerCase();
      if (category) {
        uploadPath += `/${category.toString().toLowerCase()}`;
      }
    }

    const tenantId = user?.tenantId || user?.organizationId || 'default';

    let fileUrl: string;
    try {
      fileUrl = await this.s3Service.uploadFile(
        filename,
        file.buffer,
        file.mimetype,
        tenantId,
        {
          path: uploadPath,
          acl: 'public-read',
          metadata: {
            originalName: file.originalname,
            module: module ? module.toString() : 'general',
          }
        }
      );
    } catch (error) {
      this.logger.error(`S3 Upload failed: ${error.message}`);
      throw new Error('Failed to upload file to storage system');
    }

    const createMediaDto: CreateMediaDto = {
      filename: filename,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url: fileUrl,
      type: MediaType.IMAGE,
      storageType: StorageType.S3,
      module: module || MediaModule.GENERAL,
      category: category || MediaCategory.OTHER,
      tags: tags ? tags.split(',').map((t) => t.trim()) : undefined,
      isActive: true,
    };

    return this.mediaService.create(createMediaDto);
  }
}