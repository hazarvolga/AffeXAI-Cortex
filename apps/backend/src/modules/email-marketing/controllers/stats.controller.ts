
import { Controller, Get } from '@nestjs/common';
import { StatsService } from '../services/stats.service';

@Controller('email-marketing/stats')
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('recipients')
  getRecipientStats() {
    return this.statsService.getRecipientStats();
  }
}
