import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NeuralSignal } from '../../neural-grid/interfaces/neural-signal.interface';
import { StrategyService } from '../../strategy/services/strategy.service';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class InsightEngineService {
    private readonly logger = new Logger(InsightEngineService.name);
    private signalBuffer: NeuralSignal[] = [];

    constructor(
        private readonly strategyService: StrategyService,
        private readonly eventEmitter: EventEmitter2
    ) { }

    /**
     * Buffer incoming signals for cross-module analysis
     */
    @OnEvent('neural.signal')
    handleSignalForAnalysis(signal: NeuralSignal) {
        // Skip system reports to avoid circular logic
        if (signal.type === 'AUTONOMOUS_REPORT') return;

        // We buffer high-impact signals for batch processing
        if (signal.source === 'crawler' || (signal.successScore && Math.abs(signal.successScore) >= 5)) {
            this.signalBuffer.push({ ...signal, timestamp: new Date() });

            // Keep buffer size manageable
            if (this.signalBuffer.length > 100) {
                this.signalBuffer.shift();
            }
        }
    }

    /**
     * Periodic Cross-Module Correlation (The "Brain" processing)
     * Analyzes external trends vs internal metrics
     */
    @Cron(CronExpression.EVERY_HOUR)
    async performCorrelationAnalysis() {
        if (this.signalBuffer.length < 2) return;

        this.logger.log(`[InsightEngine] Starting Correlation Analysis on ${this.signalBuffer.length} buffered signals...`);

        const crawlerSignals = this.signalBuffer.filter(s => s.source === 'crawler');
        const internalSignals = this.signalBuffer.filter(s => s.source !== 'crawler');

        if (crawlerSignals.length > 0 && internalSignals.length > 0) {
            // Logic to find patterns (e.g., competitor update vs ticket spike)
            this.logger.log(`[InsightEngine] Correlating ${crawlerSignals.length} external vs ${internalSignals.length} internal events.`);

            // Prepare for Phase 6 Proactive Reports
            await this.generateOtonomReport(crawlerSignals, internalSignals);
        }
    }

    private async generateOtonomReport(external: NeuralSignal[], internal: NeuralSignal[]) {
        this.logger.log(`[InsightEngine] Generating Otonom Strategy Report...`);

        // FUTURE: In professional phase, this sends context to LLM for a summary
        const summaryContext = `Analysing ${external.length} external trends and ${internal.length} internal performance signals.`;

        try {
            // We use StrategyService to generate a high-level otonom report
            const result = await this.strategyService.getInsight({
                context: `PHASE_6_AUTONOMOUS_REPORT: ${summaryContext}`,
                draftContent: 'Cross-module correlation between market trends and internal module performance.'
            });

            this.logger.log(`[InsightEngine] Otonom Observation: ${result.insight}`);

            // Emit as a SYSTEM signal so the frontend can display it in the grid
            this.eventEmitter.emit('neural.signal', {
                tenantId: 'system-wide',
                source: 'system',
                type: 'AUTONOMOUS_REPORT',
                context: result.insight,
                successScore: 20, // High impact report
                timestamp: new Date()
            } as NeuralSignal);

            // Clear buffer after successful analysis to prevent duplicate reports
            this.signalBuffer = [];
        } catch (e) {
            this.logger.error(`[InsightEngine] Report generation failed: ${e.message}`);
        }
    }

    /**
     * Manual Trigger for testing
     */
    async triggerManualAnalysis(tenantId: string) {
        this.logger.log(`[InsightEngine] Manual trigger for tenant: ${tenantId}`);
        await this.performCorrelationAnalysis();
        return { status: 'Analysis triggered', bufferSize: this.signalBuffer.length };
    }
}
