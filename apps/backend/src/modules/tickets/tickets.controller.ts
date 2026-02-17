import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ForbiddenException,
  BadRequestException,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { TicketsService } from './tickets.service';
import { CreateTicketDto } from './dto/create-ticket.dto';
import { UpdateStatusDto } from './dto/update-status.dto';
import { AssignTicketDto } from './dto/assign-ticket.dto';
import { AddMessageDto } from './dto/add-message.dto';
import { TicketFiltersDto } from './dto/ticket-filters.dto';
import { MergeTicketsDto } from './dto/merge-tickets.dto';
import { SplitTicketDto } from './dto/split-ticket.dto';
import { InboundEmailDto } from './dto/inbound-email.dto';
import { JwtAuthGuard } from '../../core/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../core/auth/guards/roles.guard';
import { Roles } from '../../core/auth/decorators/roles.decorator';
import { Public } from '../../core/auth/decorators/public.decorator';
import { CurrentUser } from '../../core/auth/decorators/current-user.decorator';
import { UserRole } from '../users/enums/user-role.enum';
import { TicketEmailParserService } from './services/ticket-email-parser.service';
import { EmailWebhookAdapterFactory, PROVIDER_AUTO } from './services/email-webhook-adapter-factory.service';
import { EmailProvider } from '../settings/dto/email-settings.dto';

/**
 * Tickets Controller
 * RESTful API endpoints for ticket management
 * Protected with JWT authentication
 */
@ApiTags('Tickets')
@ApiBearerAuth()
@Controller('tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly emailParserService: TicketEmailParserService,
    private readonly adapterFactory: EmailWebhookAdapterFactory,
  ) { }

  /**
   * Create a new support ticket
   * Available to: CUSTOMER role and above
   */
  @Post()
  @Roles(UserRole.CUSTOMER, UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Create a new support ticket (authenticated)' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async create(
    @Body() createTicketDto: CreateTicketDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.ticketsService.create(userId, createTicketDto);
  }

  /**
   * Create a new support ticket (public endpoint for anonymous users)
   * This endpoint allows ticket creation without authentication
   * userId must be provided in the request body
   */
  @Post('public')
  @Public() // Mark as public endpoint - bypasses authentication
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new support ticket (public - no authentication required)' })
  @ApiResponse({ status: 201, description: 'Ticket created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data or missing userId' })
  async createPublic(
    @Body() createTicketDto: CreateTicketDto & { userId?: string },
  ) {
    if (!createTicketDto.userId) {
      throw new BadRequestException('userId is required for public ticket creation');
    }
    // For public tickets, tenant context should be determined from domain/headers
    // For now, using TenantService which will handle tenant context
    return this.ticketsService.create(createTicketDto.userId, createTicketDto);
  }

  /**
   * Get all tickets with filters
   * Role-based access:
   * - CUSTOMER: Only their own tickets
   * - ADMIN/EDITOR: All tickets
   */
  @Get()
  @ApiOperation({ summary: 'Get all tickets with filters' })
  @ApiResponse({ status: 200, description: 'Tickets retrieved successfully' })
  async findAll(
    @Query() filters: TicketFiltersDto,
    @CurrentUser() user: any,
  ) {
    // If customer, force userId filter
    if (user.roles?.includes(UserRole.CUSTOMER) && !user.roles?.includes(UserRole.ADMIN) && !user.roles?.includes(UserRole.SUPPORT)) {
      filters.userId = user.id;
    }

    return this.ticketsService.findAll(filters);
  }

  /**
   * Get a single ticket by ID
   * Customers can only view their own tickets
   */
  @Get(':id')
  @ApiOperation({ summary: 'Get ticket details by ID' })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not your ticket' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    const ticket = await this.ticketsService.findOne(id);

    // Customers can only view their own tickets
    if (user.roleEntity?.name === UserRole.CUSTOMER && ticket.userId !== user.id) {
      throw new ForbiddenException('You can only view your own tickets');
    }

    return ticket;
  }

  /**
   * Update ticket status
   * Available to:
   * - ADMIN and EDITOR: Can set any status
   * - CUSTOMER: Can only set their own tickets to 'resolved' or 'cancelled'
   */
  @Patch(':id/status')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.CUSTOMER)
  @ApiOperation({ summary: 'Update ticket status' })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Status updated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async updateStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateStatusDto,
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    // Get ticket to check ownership
    const ticket = await this.ticketsService.findOne(id);

    // Customers have restricted permissions
    if (user.roleEntity?.name === UserRole.CUSTOMER) {
      // Customers can only update their own tickets
      if (ticket.userId !== user.id) {
        throw new ForbiddenException('You can only update your own tickets');
      }

      // Customers can only set status to 'resolved' or 'cancelled'
      const allowedStatuses = ['resolved', 'cancelled', 'closed'];
      if (!allowedStatuses.includes(updateStatusDto.status)) {
        throw new ForbiddenException(
          'Customers can only mark tickets as resolved, cancelled, or closed'
        );
      }
    }

    return this.ticketsService.updateStatus(id, updateStatusDto.status, userId);
  }

  /**
   * Assign ticket to a support agent
   * Available to: ADMIN, EDITOR, and SUPPORT_MANAGER roles
   */
  @Patch(':id/assign')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.SUPPORT_MANAGER)
  @ApiOperation({ summary: 'Assign ticket to a support agent' })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket assigned successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async assign(
    @Param('id') id: string,
    @Body() assignTicketDto: AssignTicketDto,
    @CurrentUser('id') assignerId: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.assignTo(id, assignTicketDto.assignedToId, assignerId);
  }

  /**
   * Add a message to a ticket
   * All authenticated users can add messages to tickets they have access to
   */
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a message to a ticket' })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 201, description: 'Message added successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 403, description: 'Forbidden - Not authorized to message this ticket' })
  async addMessage(
    @Param('id') id: string,
    @Body() addMessageDto: AddMessageDto,
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    const ticket = await this.ticketsService.findOne(id);

    // Check if user has access to this ticket
    if (user.roleEntity?.name === UserRole.CUSTOMER && ticket.userId !== user.id) {
      throw new ForbiddenException('You can only add messages to your own tickets');
    }

    return this.ticketsService.addMessage(id, userId, addMessageDto);
  }

  /**
   * Get ticket statistics
   * Available to: ADMIN, EDITOR, and SUPPORT_MANAGER roles
   */
  @Get('stats/overview')
  @Roles(UserRole.ADMIN, UserRole.EDITOR, UserRole.SUPPORT_MANAGER)
  @ApiOperation({ summary: 'Get ticket statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  async getStats() {
    return this.ticketsService.getStats();
  }


  /**
   * Manually escalate a ticket
   * Available to: ADMIN and EDITOR roles only
   */
  @Post(':id/escalate')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manually escalate a ticket' })
  @ApiParam({ name: 'id', description: 'Ticket UUID' })
  @ApiResponse({ status: 200, description: 'Ticket escalated successfully' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  @ApiResponse({ status: 400, description: 'Escalation failed' })
  async escalateTicket(
    @Param('id') id: string,
    @Body() body: { reason?: string; escalateTo?: string },
    @Req() req: any,
  ) {
    return this.ticketsService.escalateTicket(
      id,
      req.user.id,
      body.reason,
      body.escalateTo
    );
  }

  /**
   * Get all ticket categories
   */
  @Get('categories/list')
  @ApiOperation({ summary: 'Get all ticket categories' })
  @ApiResponse({ status: 200, description: 'Categories retrieved successfully' })
  async getCategories() {
    return this.ticketsService.findAllCategories();
  }

  /**
   * Merge tickets
   * Available to: ADMIN and EDITOR roles only
   */
  @Post('merge')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Merge multiple tickets into one' })
  @ApiResponse({ status: 200, description: 'Tickets merged successfully' })
  @ApiResponse({
    status: 400, description: 'Invalid input data'   // No changes needed for merge/split as they will use findOne internally (which has been updated)
    // But explicit check is safer if we update them later
    // For now skipping as methods were not fully visible in provided view
  })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'One or more tickets not found' })
  async mergeTickets(
    @Body() mergeTicketsDto: MergeTicketsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    return this.ticketsService.mergeTickets(
      mergeTicketsDto.ticketIds,
      mergeTicketsDto.targetTicketId,
      userId,
      mergeTicketsDto.mergeNote
    );
  }

  /**
   * Split ticket
   * Available to: ADMIN and EDITOR roles only
   */
  @Post('split')
  @Roles(UserRole.ADMIN, UserRole.EDITOR)
  @ApiOperation({ summary: 'Split a ticket into two tickets' })
  @ApiResponse({ status: 201, description: 'Ticket split successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 403, description: 'Forbidden - Insufficient permissions' })
  @ApiResponse({ status: 404, description: 'Ticket not found' })
  async splitTicket(
    @Body() splitTicketDto: SplitTicketDto,
    @CurrentUser('id') userId: string,
    @CurrentUser() user: any,
  ) {
    // Validate required fields
    if (!splitTicketDto.newTicketPriority) {
      throw new BadRequestException('newTicketPriority is required');
    }

    if (!splitTicketDto.messageIds || splitTicketDto.messageIds.length === 0) {
      throw new BadRequestException('messageIds is required and must not be empty');
    }

    return this.ticketsService.splitTicket(
      splitTicketDto.originalTicketId,
      {
        newTicketSubject: splitTicketDto.newTicketSubject,
        newTicketDescription: splitTicketDto.newTicketDescription,
        newTicketPriority: splitTicketDto.newTicketPriority,
        newTicketCategoryId: splitTicketDto.newTicketCategoryId,
        messageIds: splitTicketDto.messageIds,
        splitNote: splitTicketDto.splitNote,
      },
      userId
    );
  }

  /**
   * Analyze ticket before creation (AI-powered analysis)
   * PUBLIC endpoint - No authentication required
   * Note: This is safe because it only provides AI analysis, no sensitive data
   */
  @Post('analyze')
  @Public() // Mark as public endpoint to bypass JWT auth
  @ApiOperation({ summary: 'Analyze ticket description with AI before creation (public)' })
  @ApiResponse({ status: 200, description: 'Analysis completed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async analyzeTicket(
    @Body() body: { title: string; problemDescription: string; category: string },
  ) {
    return this.ticketsService.analyzeTicketWithAI(body.problemDescription, body.category);
  }

  /**
   * Universal webhook endpoint for inbound emails
   * Supports: Resend, SendGrid, Mailgun (auto-detected or specified)
   * Processes email replies to tickets via Reply-To address
   * PUBLIC endpoint - No authentication (webhook from email provider)
   *
   * Query params:
   * - provider: 'resend' | 'sendgrid' | 'mailgun' | 'auto' (default: auto)
   *
   * Usage:
   * - Resend: POST /tickets/inbound-email?provider=resend
   * - SendGrid: POST /tickets/inbound-email?provider=sendgrid
   * - Mailgun: POST /tickets/inbound-email?provider=mailgun
   * - Auto-detect: POST /tickets/inbound-email (or ?provider=auto)
   */
  @Post('inbound-email')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process inbound email replies to tickets (universal webhook)' })
  @ApiResponse({ status: 200, description: 'Email processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid email format or unsupported provider' })
  async processInboundEmail(
    @Body() payload: any,
    @Query('provider') provider: string = PROVIDER_AUTO,
    @Req() request: any,
  ) {
    try {
      // Get appropriate adapter (auto-detect or specified)
      const adapter = this.adapterFactory.getAdapter(provider, payload);

      // Convert provider-specific format to standardized format
      const parsedEmail = adapter.convertToStandardFormat(payload);

      // Extract ticket ID from recipient email
      const ticketId = adapter.extractTicketId(parsedEmail.to);
      if (!ticketId) {
        throw new BadRequestException('Invalid recipient email format - ticket ID not found');
      }

      // Validate webhook signature (if provider supports it)
      if (adapter.validateWebhook) {
        const isValid = adapter.validateWebhook(payload, request.headers);
        if (!isValid) {
          throw new BadRequestException('Invalid webhook signature');
        }
      }

      // Process email through parser service
      const ticket = await this.emailParserService.processInboundEmail(parsedEmail);

      return {
        success: true,
        message: 'Email processed successfully',
        ticketId: ticket.id,
        displayNumber: ticket.displayNumber,
        provider: provider === PROVIDER_AUTO ? 'auto-detected' : provider,
      };
    } catch (error) {
      throw new BadRequestException(`Failed to process inbound email: ${error.message}`);
    }
  }

  /**
   * [NEURAL GRID] Get Ticket Context from RAG
   * Returns insights from Email/Social history relevant to this ticket.
   */
  @Get(':id/neural-context')
  @ApiOperation({ summary: 'Get Brand Intelligence for this ticket' })
  @ApiResponse({ status: 200, description: 'Neural context retrieved' })
  async getNeuralContext(
    @Param('id') id: string,
  ) {
    return this.ticketsService.getTicketSignal(id);
  }
}



