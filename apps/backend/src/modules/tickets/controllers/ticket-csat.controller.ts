import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  Request,
  Ip,
  Headers,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { TicketCSATService, CSATSurveyData } from '../services/ticket-csat.service';
import { Public } from '../../../core/auth/decorators/public.decorator';

/**
 * CSAT Controller
 * Manages customer satisfaction surveys
 */

@ApiTags('Ticket CSAT')
@Controller('tickets/csat')
export class TicketCSATController {
  constructor(private readonly csatService: TicketCSATService) {}

  /**
   * Get survey by token (public endpoint)
   */
  @Public()
  @Get('survey/:token')
  @ApiOperation({ summary: 'Get CSAT survey by token' })
  @ApiResponse({ status: 200, description: 'Survey found' })
  @ApiResponse({ status: 404, description: 'Survey not found' })
  async getSurvey(@Param('token') token: string) {
    return await this.csatService.getSurveyByToken(token);
  }

  /**
   * Submit CSAT survey (public endpoint)
   */
  @Public()
  @Post('survey/:token/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit CSAT survey response' })
  @ApiResponse({ status: 200, description: 'Survey submitted successfully' })
  @ApiResponse({ status: 400, description: 'Invalid survey data' })
  @ApiResponse({ status: 404, description: 'Survey not found' })
  async submitSurvey(
    @Param('token') token: string,
    @Body() surveyData: Partial<CSATSurveyData>,
    @Ip() ipAddress: string,
    @Headers('user-agent') userAgent: string,
  ) {
    return await this.csatService.submitSurvey(token, {
      ...surveyData,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Request survey for a ticket (admin only)
   */
  @Post(':ticketId/request')
  @ApiOperation({ summary: 'Request CSAT survey for ticket' })
  @ApiResponse({ status: 200, description: 'Survey requested successfully' })
  async requestSurvey(@Param('ticketId') ticketId: string) {
    return await this.csatService.requestSurvey(ticketId);
  }

  /**
   * Get CSAT statistics
   */
  @Get('statistics')
  @ApiOperation({ summary: 'Get CSAT statistics' })
  @ApiResponse({ status: 200, description: 'Statistics retrieved' })
  async getStatistics(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('agentId') agentId?: string,
  ) {
    return await this.csatService.getStatistics(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
      agentId,
    );
  }

  /**
   * Get recent feedback
   */
  @Get('feedback/recent')
  @ApiOperation({ summary: 'Get recent CSAT feedback' })
  @ApiResponse({ status: 200, description: 'Feedback retrieved' })
  async getRecentFeedback(@Query('limit') limit?: string) {
    return await this.csatService.getRecentFeedback(
      limit ? parseInt(limit, 10) : 10,
    );
  }
}
