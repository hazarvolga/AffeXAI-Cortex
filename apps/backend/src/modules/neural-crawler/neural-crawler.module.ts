import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { NeuralCrawlerService } from './services/neural-crawler.service';
import { CrawlQueueService } from './services/crawl-queue.service';
import { IntelSearchService } from './services/intel-search.service';

import { NeuralCrawlerController } from './neural-crawler.controller';

@Module({
    imports: [HttpModule],
    controllers: [NeuralCrawlerController],
    providers: [NeuralCrawlerService, CrawlQueueService, IntelSearchService],
    exports: [NeuralCrawlerService],
})
export class NeuralCrawlerModule { }
