import { AIRouter } from "@/lib/ai/ai-router";
import { ResearchService } from "@/lib/ai/research/research-service";
import { synthesizeAnswer } from "@/lib/ai/ai-synthesizer";
import { planResearch } from "@/lib/ai/research-planner";
import { DuckDuckGoSearchProvider } from "@/lib/ai/research/web-search-provider";
import type { IntentAnalysis, ResolveResponse } from "@/lib/ai/models/intent-analysis";
import { ExecutionMode } from "@/lib/ai/models/intent-analysis";
import type { LLMProvider } from "@/lib/ai/providers/types";
import type { WebSearchProvider } from "@/lib/ai/providers/web-search-provider";

export interface OrchestratorConfig {
  llmProvider: LLMProvider;
  searchProvider?: WebSearchProvider;
  fetchPages?: boolean;
  maxResults?: number;
  crossCheck?: boolean;
}

export class AIOrchestrator {
  private readonly router: AIRouter;
  private readonly researchService: ResearchService;
  private readonly searchProvider: WebSearchProvider;
  private readonly config: OrchestratorConfig;

  constructor(config: OrchestratorConfig) {
    this.config = config;
    this.searchProvider = config.searchProvider || new DuckDuckGoSearchProvider();
    this.router = new AIRouter(config.llmProvider);
    this.researchService = new ResearchService({
      searchProvider: this.searchProvider,
      fetchPages: config.fetchPages ?? true,
      maxResults: config.maxResults ?? 10,
      crossCheck: config.crossCheck ?? true,
    });
  }

  async resolve(input: string, context?: Record<string, unknown>): Promise<ResolveResponse> {
    const startTime = Date.now();

    try {
      const decision = await this.router.route(input, context);
      const intentAnalysis = decision.intentAnalysis;
      const mode = decision.mode;
      const searchQueries = decision.searchQueries;
      const complaintResult = decision.complaintResult;

      let researchResult: ResolveResponse["researchResult"];

      if (mode === ExecutionMode.RESEARCH || mode === ExecutionMode.HYBRID) {
        if (searchQueries.length > 0) {
          const plan = planResearch(
            searchQueries,
            intentAnalysis.researchDepth,
            this.searchProvider
          );
          const result = await this.researchService.research(
            searchQueries[0] || input
          );
          researchResult = result as any;
        }
      }

      const response = await synthesizeAnswer(this.config.llmProvider, {
        userInput: input,
        intentAnalysis,
        complaintResult,
        researchResult: researchResult as any,
        processingTimeMs: Date.now() - startTime,
      });

      return {
        ...response,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (err) {
      const elapsed = Date.now() - startTime;
      console.error("[orchestrator] Failed:", err);
      return {
        answer: "An error occurred while processing your request.",
        mode: ExecutionMode.DIRECT,
        confidence: 0,
        citations: [],
        sources: [],
        researchPerformed: false,
        processingTimeMs: elapsed,
        error: err instanceof Error ? err.message : "Unknown error",
      };
    }
  }

  async classifyOnly(input: string) {
    const decision = await this.router.route(input);
    return decision.complaintResult;
  }
}

export function createOrchestrator(config: OrchestratorConfig): AIOrchestrator {
  return new AIOrchestrator(config);
}
