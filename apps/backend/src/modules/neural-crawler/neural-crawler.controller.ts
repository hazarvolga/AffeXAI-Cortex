import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NeuralCrawlerService } from './services/neural-crawler.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GetUser } from '../users/decorators/get-user.decorator';

@ApiTags('Neural Crawler')
@Controller('neural-crawler')
@UseGuards(JwtAuthGuard)
export class NeuralCrawlerController {
    constructor(private readonly crawlerService: NeuralCrawlerService) { }

    @Post('trigger')
    @ApiOperation({ summary: '[NEURAL GRID] Trigger external intelligence crawl' })
    async triggerCrawl(
        @GetUser() user: any,
        @Body() body: { url: string; type: 'COMPETITOR' | 'SECTOR' | 'REPUTATION' }
    ) {
        return this.crawlerService.processTarget(user.tenantId, body.url, body.type);
    }
}
