import { IntentAnalysis, ExecutionMode, ResearchDepth } from "@/lib/ai/models/intent-analysis";
import type { ComplaintClassificationResult } from "@/lib/ai/models/intent-analysis";
import { classifyComplaint } from "@/lib/ai/complaint/complaint-classifier";
import { analyzeIntentWithLLM } from "@/lib/ai/intent-analyzer";
import type { LLMProvider } from "@/lib/ai/providers/types";

export interface RouterDecision {
  mode: ExecutionMode;
  intentAnalysis: IntentAnalysis;
  complaintResult: ComplaintClassificationResult | null;
  searchQueries: string[];
  researchDepth: ResearchDepth;
}

export class AIRouter {
  constructor(private readonly llmProvider: LLMProvider) {}

  async route(input: string, context?: Record<string, unknown>): Promise<RouterDecision> {
    const intentAnalysis = await analyzeIntentWithLLM(this.llmProvider, input, context);

    let complaintResult: ComplaintClassificationResult | null = null;
    const searchQueries: string[] = [];

    if (intentAnalysis.requiresComplaintClassification || intentAnalysis.intent === ExecutionMode.COMPLAINT) {
      complaintResult = await classifyComplaint(input, input);
    }

    if (intentAnalysis.intent === ExecutionMode.HYBRID) {
      if (!complaintResult) {
        complaintResult = await classifyComplaint(input, input);
      }
      searchQueries.push(...intentAnalysis.searchQueries);
    } else if (intentAnalysis.intent === ExecutionMode.RESEARCH) {
      searchQueries.push(...intentAnalysis.searchQueries);
    }

    const researchDepth = intentAnalysis.researchDepth || ResearchDepth.STANDARD;

    return {
      mode: intentAnalysis.intent,
      intentAnalysis,
      complaintResult,
      searchQueries,
      researchDepth,
    };
  }

  async classifyOnly(input: string): Promise<ComplaintClassificationResult | null> {
    return classifyComplaint(input, input);
  }
}
