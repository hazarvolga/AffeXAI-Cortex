import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NeuralSignal } from '../interfaces/neural-signal.interface';

@Injectable()
export class NeuralGridService {
    private readonly logger = new Logger(NeuralGridService.name);

    @OnEvent('neural.signal')
    handleNeuralSignal(signal: NeuralSignal) {
        this.logger.log(`[NeuralGrid] Signal Ingested: ${signal.source}.${signal.type} | Tenant: ${signal.tenantId} | Score: ${signal.successScore || 0}`);

        // FUTURE: Save to Vector Store / RAG for learning
        if (signal.successScore !== undefined) {
            this.logger.debug(`[NeuralGrid] Reward registered for ${signal.tenantId}: ${signal.successScore}`);
        }
    }
}
