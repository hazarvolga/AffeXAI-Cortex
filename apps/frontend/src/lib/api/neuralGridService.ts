import { baseService } from './base-service';

export interface NeuralSignal {
    id: string;
    tenantId: string;
    source: 'tickets' | 'social' | 'email' | 'forms' | 'system' | 'crawler';
    type: string;
    successScore?: number;
    context?: string;
    content?: string;
    timestamp: Date;
}

class NeuralGridService {
    /**
     * Fetch latest neural signals from the grid
     */
    async getSignals(limit: number = 20): Promise<NeuralSignal[]> {
        try {
            const response = await baseService.get(`/neural-grid/signals?limit=${limit}`);
            return response.data || [];
        } catch (error) {
            console.error('[NeuralGridService] Failed to fetch signals:', error);
            return [];
        }
    }

    /**
     * Trigger manual analysis in the insight engine
     */
    async triggerAnalysis(tenantId: string = 'system-wide') {
        try {
            return await baseService.post('/insight-engine/analyze/manual', { tenantId });
        } catch (error) {
            console.error('[NeuralGridService] Analysis trigger failed:', error);
            throw error;
        }
    }
}

export const neuralGridService = new NeuralGridService();
