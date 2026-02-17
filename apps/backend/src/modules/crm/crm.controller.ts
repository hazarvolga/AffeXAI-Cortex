import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpStatus,
  HttpException,
  Req,
} from '@nestjs/common';
import { CrmService } from './crm.service';
import { CreateCrmCustomerDto } from './dto/create-crm-customer.dto';
import { ImportCrmCustomersDto } from './dto/import-crm-customers.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { UserRole } from '../users/enums/user-role.enum';

@Controller('crm')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CrmController {
  constructor(private readonly crmService: CrmService) { }

  /**
   * Get all CRM customers
   * Admin only
   */
  @Get()
  @Roles(UserRole.ADMIN)
  async findAll() {
    const customers = await this.crmService.findAll();
    return {
      success: true,
      data: customers,
      meta: {
        count: customers.length,
      },
    };
  }

  /**
   * Get CRM statistics
   * Admin only
   */
  @Get('stats')
  @Roles(UserRole.ADMIN)
  async getStats() {
    const stats = await this.crmService.getStats();
    return {
      success: true,
      data: stats,
    };
  }

  /**
   * Get single CRM customer
   * Admin only
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id') id: string) {
    try {
      const customer = await this.crmService.findOne(id);
      return {
        success: true,
        data: customer,
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Create single CRM customer
   * Admin only
   */
  @Post()
  @Roles(UserRole.ADMIN)
  async create(@Body() createDto: CreateCrmCustomerDto) {
    try {
      const customer = await this.crmService.create(createDto);
      return {
        success: true,
        message: 'CRM customer created successfully',
        data: customer,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Bulk import CRM customers
   * Admin only
   */
  @Post('import')
  @Roles(UserRole.ADMIN)
  async bulkImport(@Body() importDto: ImportCrmCustomersDto) {
    try {
      console.log(`📥 Importing ${importDto.customers.length} CRM customers...`);

      const result = await this.crmService.bulkImport(importDto.customers);

      console.log(`✅ Import complete: ${result.imported} imported, ${result.skipped} skipped`);

      return {
        success: true,
        message: `Successfully imported ${result.imported} customers`,
        data: result,
      };
    } catch (error) {
      console.error('❌ CRM import error:', error);
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Update CRM customer
   * Admin only
   */
  @Put(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id') id: string,
    @Body() updateDto: Partial<CreateCrmCustomerDto>,
  ) {
    try {
      const customer = await this.crmService.update(id, updateDto);
      return {
        success: true,
        message: 'CRM customer updated successfully',
        data: customer,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  /**
   * Soft delete CRM customer (set isActive = false)
   * Admin only
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id') id: string) {
    try {
      await this.crmService.remove(id);
      return {
        success: true,
        message: 'CRM customer deactivated successfully',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }

  /**
   * Hard delete CRM customer (permanently delete)
   * Admin only
   */
  @Delete(':id/hard')
  @Roles(UserRole.ADMIN)
  async hardDelete(@Param('id') id: string) {
    try {
      await this.crmService.hardDelete(id);
      return {
        success: true,
        message: 'CRM customer permanently deleted',
      };
    } catch (error) {
      throw new HttpException(error.message, HttpStatus.NOT_FOUND);
    }
  }
}
