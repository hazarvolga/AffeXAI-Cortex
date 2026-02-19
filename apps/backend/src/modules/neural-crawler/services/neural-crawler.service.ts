import { Injectable, Logger } from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { HttpService } from '@nestjs/axios';
import { Cron, CronExpression } from '@nestjs/schedule';
import { firstValueFrom } from 'rxjs';
import { CrawlQueueService } from './crawl-queue.service';
import { NeuralSignal } from '../../neural-grid/interfaces/neural-signal.interface';

@Injectable()
export class NeuralCrawlerService {
    private readonly logger = new Logger(NeuralCrawlerService.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly eventEmitter: EventEmitter2,
        private readonly queueService: CrawlQueueService,
    ) { }

    /**
     * [NEURAL CRAWLER] Main entry point for crawling a target
     */
    async processTarget(tenantId: string, url: string, type: 'COMPETITOR' | 'SECTOR' | 'REPUTATION') {
        this.logger.log(`[NeuralCrawler] Task Queued: ${type} | URL: ${url}`);

        // Add to strict sequential queue to protect RAM
        return this.queueService.addJob(async () => {
            try {
                const content = await this.performLightweightCrawl(url);

                // Emit intelligence signal to Neural Grid
                const signal: any = {
                    source: 'crawler',
                    type: `intelligence.${type.toLowerCase()}`,
                    tenantId,
                    content: `EXTERNAL_INTEL [${type}]: ${content.substring(0, 1000)}...`,
                    metadata: {
                        url,
                        crawledAt: new Date(),
                        confidence: 0.85
                    }
                };

                this.eventEmitter.emit('neural.signal', signal);
                this.logger.log(`[NeuralCrawler] Signal Emitted: ${type}`);

                return content;
            } catch (err) {
                this.logger.error(`[NeuralCrawler] Crawl failed for ${url}: ${err.message}`);
                throw err;
            }
        });
    }

    /**
   * [NEURAL GRID] Automated Nightly Intelligence Gathering
   * Triggered at 2 AM
   */
    @Cron(CronExpression.EVERY_DAY_AT_2AM)
    async handleNightlyCrawl() {
        this.logger.log('[NeuralCrawler] Starting nightly autonomous intelligence scan...');
        // In a multi-tenant system, we'd iterate over active tenants
        // For MVP, we use a generic placeholder or the main tenant
        const mockTenants = ['system-default'];

        for (const tenantId of mockTenants) {
            // 1. Reputation Scan
            await this.processTarget(tenantId, 'https://news.google.com/search?q=AffeXAI', 'REPUTATION');

            // 2. Competitor Scan (Placeholder URL)
            await this.processTarget(tenantId, 'https://competitor.example.com/blog', 'COMPETITOR');
        }
    }

    /**
     * [NEURAL GRID] Reactive Ticket Knowledge Enhancement
     * Triggered when a new ticket is created
     */
    @OnEvent('ticket.created')
    async handleTicketIntelligence(payload: any) {
        const { id, subject, tenantId } = payload;
        this.logger.log(`[NeuralCrawler] Enhancing intelligence for Ticket: ${id}`);

        // Search sectoral documentation based on ticket subject
        const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(subject + " documentation solution")}`;
        await this.processTarget(tenantId, searchUrl, 'SECTOR');
    }

    /**
     * Tries to fetch data using simple HTTP first (No browser)
     */
    private async performLightweightCrawl(url: string): Promise<string> {
        this.logger.debug(`[NeuralCrawler] Attempting lightweight fetch: ${url}`);
        try {
            const response = await firstValueFrom(
                this.httpService.get(url, {
                    timeout: 10000,
                    headers: { 'User-Agent': 'AffeXAI-Neural-Crawler/1.0' }
                })
            );

            // Simple text extraction from HTML (Placeholder for better parser)
            return response.data;
        } catch (err) {
            this.logger.warn(`[NeuralCrawler] HTTP fetch failed, fallback to browser needed: ${err.message}`);
            // FUTURE: Trigger Headless Browser here if necessary
            return "RAW_FALLBACK: Page content unreachable via simple GET.";
        }
    }
}
