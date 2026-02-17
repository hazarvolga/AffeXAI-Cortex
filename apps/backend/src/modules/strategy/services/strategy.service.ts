import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class StrategyService {
    private readonly logger = new Logger(StrategyService.name);
    private readonly COLLECTION_NAME = 'brand_intelligence_signals';
    private readonly CORTEX_URL = 'http://localhost:8000'; // Tunnel to Server 1

    constructor(
        private readonly aiService: AiService,
        private readonly vectorStore: VectorStoreService,
        private readonly commerceService: CommerceService,
        private readonly httpService: HttpService
    ) { }

    async getInsight(tenantId: string, context: string, draftContent?: string) {
        try {
            this.logger.log(`Generating insight for tenant: ${tenantId}, context: ${context}`);

            // 0. Governance Check (Rate Limiting)
            const limitCheck = await this.commerceService.checkLimit(tenantId);
            if (!limitCheck.allowed) {
                this.logger.warn(`Rate limit exceeded for tenant ${tenantId}`);
                return { insight: "⚠️ Token Limit Exceeded. Please upgrade to continue using AI Insights.", source: "governance-guard" };
            }

            // 1. Retrieve RAG Context (Brain Connection)
            let ragContext = '';
            try {
                const retrievalResponse = await firstValueFrom(
                    this.httpService.post(`${this.CORTEX_URL}/retrieve`, {
                        query: context,
                        limit: 3,
                        tenantId: tenantId
                    })
                );

                const searchResults = retrievalResponse.data.results;

                if (searchResults && searchResults.length > 0) {
                    ragContext = searchResults.map(res => {
                        return `[Signal] ${res.content}`;
                    }).join('\n');
                    this.logger.log(`RAG: Retrieved ${searchResults.length} relevant signals from Cortex.`);
                } else {
                    ragContext = "No relevant memory found in Cortex.";
                }
            } catch (err) {
                this.logger.warn(`RAG Retrieval Connection failed: ${err.message}`);
                ragContext = "Cortex Memory unavailable.";
            }

            // 2. Construct System Prompt with RAG
            const systemPrompt = `You are a Brand Strategy Expert for AffeXAI (Brand Communication Center).
            Your goal is to provide a brief, high-impact strategic insight or recommendation.
            
            Context: ${context}
            User Draft: ${draftContent ? draftContent.substring(0, 1000) : 'No content provided'}
            Reference Knowledge (RAG): ${ragContext}
            
            Strategy_Engine_Note: Ground your insights in the brand's identity.
            Output format: A single, punchy paragraph (max 2 sentences).`;

            const result = await this.aiService.generateCompletion(
                process.env.OPENAI_API_KEY || 'local-fallback',
                "Analyze this context and provide insight.",
                {
                    provider: AiProvider.LOCAL,
                    model: AiModel.LOCAL_MISTRAL,
                    systemPrompt
                }
            );

            // Log Token Usage (Approximate: 1 token per 4 chars)
            const estimatedTokens = Math.ceil((context.length + (result.content?.length || 0)) / 4);
            await this.commerceService.logUsage(tenantId, estimatedTokens, 'generate_insight', 'strategy_service');

            return { insight: result.content, source: 'hybrid-ai-engine-rag' };
        } catch (error) {
            this.logger.error(`Failed to generate strategy insight: ${error.message}`);
            return { insight: "Focus on clear value proposition and audience alignment.", source: "fallback" };
        }
    }

    async emitSignal(tenantId: string, type: string, data: any) {
        this.logger.log(`[Signal Emitted] Tenant: ${tenantId}, Type: ${type}`);

        try {
            // Ensure collection exists (lazy init)
            await this.vectorStore.createCollection(this.COLLECTION_NAME);

            // TODO: Generate Embedding for 'data'
            const dummyVector = new Array(1024).fill(0); // Placeholder

            await this.vectorStore.upsert(this.COLLECTION_NAME, [{
                id: Date.now(), // Simple ID generation
                vector: dummyVector,
                payload: {
                    tenantId,
                    type,
                    content: JSON.stringify(data),
                    timestamp: new Date().toISOString()
                }
            }]);

            this.logger.log(`Signal persisted to Qdrant: ${this.COLLECTION_NAME}`);

            // 0. Governance: Track Data Ingestion Cost (Optional: 1 token per signal or based on size)
            // Even if we don't charge for it yet, we MUST track it for "Fair Use" policy.
            const signalSize = JSON.stringify(data).length;
            const estimatedCost = Math.ceil(signalSize / 100); // 1 token per 100 chars for storage/ingest
            await this.commerceService.logUsage(tenantId, estimatedCost, 'rag_ingestion', 'strategy_service_ingest');

        } catch (error) {
            this.logger.warn(`Failed to ingest signal to RAG layer: ${error.message}`);
        }
    }

    async executeStrategy(options: {
        tenantId: string;
        type: 'analyst' | 'creator';
        context: string;
        parameters: any;
    }) {
        this.logger.log(`Executing strategy: ${options.type} for ${options.tenantId}`);

        try {
            // 0. Governance Check
            const limitCheck = await this.commerceService.checkLimit(options.tenantId);
            if (!limitCheck.allowed) {
                this.logger.warn(`Rate limit exceeded for tenant ${options.tenantId}`);
                throw new Error('Rate limit exceeded');
            }

            // 1. Construct System Prompt
            const systemPrompt = `You are an AI Assistant specializing in ${options.context}.
            Task: ${options.parameters.instruction}
            
            Return JSON format if requested.`;

            // 2. Call AI Service
            // Use user input text if provided, otherwise generic prompt
            const userMessage = options.parameters.text || "Execute analysis.";

            const result = await this.aiService.generateCompletion(
                process.env.OPENAI_API_KEY || 'local-fallback',
                userMessage,
                {
                    provider: AiProvider.LOCAL,
                    model: AiModel.LOCAL_MISTRAL,
                    systemPrompt
                }
            );

            // 3. Log Tokens
            const estimatedTokens = Math.ceil((userMessage.length + (result.content?.length || 0)) / 4);
            await this.commerceService.logUsage(options.tenantId, estimatedTokens, 'execute_strategy', 'strategy_service');

            return result;

        } catch (error) {
            this.logger.error(`Strategy Execution Failed: ${error.message}`);
            // Return failure object that StrategyService consumer expects
            return { content: JSON.stringify({ score: 0, label: 'NEUTRAL', error: true }) };
        }
    }

    async recordFeedback(tenantId: string, feedbackDto: CreateFeedbackDto) {
        this.logger.log(`[Feedback] Tenant: ${tenantId}, Action: ${feedbackDto.action}, Context: ${feedbackDto.contextId}`);

        // 0. Governance Check (Rate Limiting for Feedback - Lighter limit)
        // We use a different key or weight for feedback to encourage interaction but prevent spam.
        // Assuming 'feedback_submission' is a tracked operation type.
        const estimatedCost = 1; // Very cheap to submit feedback
        await this.commerceService.logUsage(tenantId, estimatedCost, 'feedback_submission', 'strategy_service_feedback');

        try {
            // 1. Calculate Score Impact
            let score = 0;
            switch (feedbackDto.action) {
                case FeedbackAction.THUMBS_UP: score = 1.0; break;
                case FeedbackAction.THUMBS_DOWN: score = -1.0; break;
                case FeedbackAction.COPY: score = 0.5; break; // Implicit positive
                case FeedbackAction.EDIT: score = 0.2; break; // Engagement, but mixed signal
            }

            // 2. Persist Feedback (Log for training)
            // Ideally, we would update the weight of the specific RAG chunk in Qdrant if signalId is provided.
            // For now, we log it to Qdrant as a 'training_example' for future fine-tuning.

            await this.vectorStore.upsert(this.COLLECTION_NAME, [{
                id: Date.now(),
                vector: new Array(1024).fill(0), // Dummy vector
                payload: {
                    tenantId,
                    type: 'FEEDBACK_SIGNAL',
                    relatedSignalId: feedbackDto.signalId,
                    contextId: feedbackDto.contextId,
                    action: feedbackDto.action,
                    score: score,
                    comment: feedbackDto.comment,
                    timestamp: new Date().toISOString()
                }
            }]);

            this.logger.log(`Feedback recorded with score: ${score}`);
            return { success: true, score };

        } catch (error) {
            this.logger.error(`Failed to record feedback: ${error.message}`);
            // Don't block the user for a feedback failure, but log it.
            return { success: false, error: error.message };
        }
    }
}
