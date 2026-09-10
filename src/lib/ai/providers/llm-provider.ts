import type { LLMProvider, LLMProviderConfig } from "./types";
import type { IntentAnalysis } from "@/lib/ai/models/intent-analysis";
import { ExecutionMode, ResearchDepth } from "@/lib/ai/models/intent-analysis";
import { buildIntentAnalysisPrompt } from "@/lib/ai/intent-analyzer";

export function createOpenAIProvider(config: LLMProviderConfig): LLMProvider {
  return {
    name: config.name || "openai",
    isAvailable: () => Boolean(config.apiKey),
    async analyzeIntent(input: string, context?: Record<string, unknown>): Promise<IntentAnalysis> {
      const prompt = buildIntentAnalysisPrompt(input, context);
      const response = await this.generateResponse(prompt);
      return parseIntentResponse(response);
    },
    async generateResponse(prompt: string): Promise<string> {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature ?? 0.3,
          max_tokens: config.maxTokens ?? 1024,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`LLM request failed (${res.status})`);
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || "";
    },
  };
}

export function createOllamaProvider(config: LLMProviderConfig): LLMProvider {
  return {
    name: config.name || "ollama",
    isAvailable: () => true,
    async analyzeIntent(input: string, context?: Record<string, unknown>): Promise<IntentAnalysis> {
      const prompt = buildIntentAnalysisPrompt(input, context);
      const response = await this.generateResponse(prompt);
      return parseIntentResponse(response);
    },
    async generateResponse(prompt: string): Promise<string> {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: config.model,
          temperature: config.temperature ?? 0.4,
          max_tokens: config.maxTokens ?? 1024,
          messages: [{ role: "user", content: prompt }],
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        throw new Error(`Ollama request failed (${res.status})`);
      }

      const data = await res.json();
      return data?.choices?.[0]?.message?.content || "";
    },
  };
}

async function parseIntentResponse(response: string): Promise<IntentAnalysis> {
  const validIntents: string[] = Object.values(ExecutionMode);
  const validDepths: string[] = Object.values(ResearchDepth);
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackIntent();
    }
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      intent: validIntents.includes(parsed.intent) ? (parsed.intent as ExecutionMode) : ExecutionMode.DIRECT,
      confidence: typeof parsed.confidence === "number" && !isNaN(parsed.confidence)
        ? Math.max(0, Math.min(1, parsed.confidence))
        : 0.5,
      requiresWeb: parsed.requiresWeb ?? false,
      requiresCurrentInformation: parsed.requiresCurrentInformation ?? false,
      requiresExternalSources: parsed.requiresExternalSources ?? false,
      requiresComplaintClassification: parsed.requiresComplaintClassification ?? false,
      requiresInternalData: parsed.requiresInternalData ?? false,
      requiresCalculation: parsed.requiresCalculation ?? false,
      researchDepth: validDepths.includes(parsed.researchDepth) ? (parsed.researchDepth as ResearchDepth) : ResearchDepth.STANDARD,
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
      reasoning: parsed.reasoning || "AI analysis completed.",
      summary: parsed.summary || "Classified as DIRECT",
    };
  } catch {
    return fallbackIntent();
  }
}

function fallbackIntent(): IntentAnalysis {
  return {
    intent: ExecutionMode.DIRECT,
    confidence: 0.5,
    requiresWeb: false,
    requiresCurrentInformation: false,
    requiresExternalSources: false,
    requiresComplaintClassification: false,
    requiresInternalData: false,
    requiresCalculation: false,
    researchDepth: ResearchDepth.STANDARD,
    searchQueries: [],
    reasoning: "Could not parse the AI response; defaulted to direct answer.",
    summary: "Direct answer (fallback)",
  };
}
