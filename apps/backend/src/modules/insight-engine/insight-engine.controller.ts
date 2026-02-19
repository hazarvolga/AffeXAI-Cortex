import { Controller, Post, Body, Get } from '@nestjs/common';
import { InsightEngineService } from './services/insight-engine.service';

@Controller('insight-engine')
export class InsightEngineController {
    constructor(private readonly insightEngineService: InsightEngineService) { }

    @Post('analyze/manual')
    async triggerAnalysis(@Body() body: { tenantId: string }) {
        return this.insightEngineService.triggerManualAnalysis(body.tenantId || 'default');
    }

    @Get('status')
    async getStatus() {
        return {
            status: 'Proactive Insight Engine Online',
            mode: 'Autonomous Correlation',
            version: 'Alpha-6.0.1'
        };
    }
}
