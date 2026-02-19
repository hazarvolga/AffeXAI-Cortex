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

        // Processing External Intelligence
        if (signal.source === 'crawler') {
            this.logger.log(`[NeuralGrid] Market Intelligence Ingested from ${signal.metadata?.url || 'unknown'}`);
            // In Phase 6, this would trigger an LLM-based Market Analysis Agent
        }
    }
}
