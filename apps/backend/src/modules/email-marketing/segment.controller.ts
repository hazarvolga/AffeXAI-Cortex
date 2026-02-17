import { Controller, Get, Post, Patch, Delete, Body, Param, NotFoundException, Req } from '@nestjs/common';
import { SegmentService } from './segment.service';
import { CreateSegmentDto } from './dto/create-segment.dto';
import { UpdateSegmentDto } from './dto/update-segment.dto';
import { Segment } from './entities/segment.entity';

@Controller('email-marketing/segments')
export class SegmentController {
  constructor(private readonly segmentService: SegmentService) { }

  @Post()
  create(@Body() createSegmentDto: CreateSegmentDto, @Req() req: any): Promise<Segment> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.segmentService.create(createSegmentDto, tenantId);
  }

  @Get()
  findAll(@Req() req: any): Promise<Segment[]> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.segmentService.findAll(tenantId);
  }

  @Get('import/options')
  async getImportOptions(@Req() req: any) {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    const segments = await this.segmentService.findAllForImport(tenantId);
    return {
      success: true,
      data: segments
    };
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any): Promise<Segment> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.segmentService.findOne(id, tenantId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateSegmentDto: UpdateSegmentDto, @Req() req: any): Promise<Segment> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.segmentService.update(id, updateSegmentDto, tenantId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any): Promise<void> {
    const tenantId = req.user?.tenantId || req.headers['x-tenant-id'];
    return this.segmentService.remove(id, tenantId);
  }
}