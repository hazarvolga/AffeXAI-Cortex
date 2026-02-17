import { Module } from '@nestjs/common';
import { AiModule } from '../ai/ai.module';
import { CommerceModule } from '../commerce/commerce.module';
import { StrategyController } from './controllers/strategy.controller';
import { StrategyService } from './services/strategy.service';

import { HttpModule } from '@nestjs/axios';

@Module({
    imports: [AiModule, CommerceModule, HttpModule],
    controllers: [StrategyController],
    providers: [StrategyService],
    exports: [StrategyService],
})
export class StrategyModule { }
