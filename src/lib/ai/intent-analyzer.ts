import type { LLMProvider } from "@/lib/ai/providers/types";
import type { IntentAnalysis } from "@/lib/ai/models/intent-analysis";
import { ExecutionMode, ResearchDepth } from "@/lib/ai/models/intent-analysis";

const INTENT_ANALYSIS_PROMPT = `You are an AI Intent Analyzer. Your job is to analyze a user's input and determine what type of action they need.

Return a JSON object with these exact fields:

{
  "intent": "DIRECT" | "COMPLAINT" | "RESEARCH" | "HYBRID",
  "confidence": 0.0 to 1.0,
  "requiresWeb": true/false,
  "requiresCurrentInformation": true/false,
  "requiresExternalSources": true/false,
  "requiresComplaintClassification": true/false,
  "requiresInternalData": true/false,
  "requiresCalculation": true/false,
  "researchDepth": "quick" | "standard" | "multi_source",
  "searchQueries": ["array of suggested search queries"],
  "reasoning": "Brief explanation of why you classified the intent this way",
  "summary": "One-line summary of the analysis"
}

Rules:
- INTENT "DIRECT": The user can be answered without external information.
- INTENT "COMPLAINT": The user is describing a problem or issue that needs classification.
- INTENT "RESEARCH": The user needs current, external, or factual information.
- INTENT "HYBRID": The request needs BOTH complaint classification AND external research.
- Always return valid JSON. No markdown formatting, no code blocks.

User input to analyze:
"{input}"

Previous conversation context:
{context}`;

export function buildIntentAnalysisPrompt(input: string, context?: Record<string, unknown>): string {
  const ctxStr = context ? JSON.stringify(context, null, 2) : "None";
  return INTENT_ANALYSIS_PROMPT.replace("{input}", input).replace("{context}", ctxStr);
}

export async function analyzeIntentWithLLM(
  llmProvider: LLMProvider,
  input: string,
  context?: Record<string, unknown>
): Promise<IntentAnalysis> {
  try {
    const response = await llmProvider.generateResponse(buildIntentAnalysisPrompt(input, context));
    const parsed = parseIntentResponse(response);

    return {
      intent: validateIntent(String(parsed.intent ?? "DIRECT")),
      confidence: clampConfidence(Number(parsed.confidence ?? 0.5)),
      requiresWeb: parsed.requiresWeb ?? false,
      requiresCurrentInformation: parsed.requiresCurrentInformation ?? false,
      requiresExternalSources: parsed.requiresExternalSources ?? false,
      requiresComplaintClassification: parsed.requiresComplaintClassification ?? false,
      requiresInternalData: parsed.requiresInternalData ?? false,
      requiresCalculation: parsed.requiresCalculation ?? false,
      researchDepth: validDepth(parsed.researchDepth) || ResearchDepth.STANDARD,
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries : [],
      reasoning: parsed.reasoning || "AI analysis completed.",
      summary: parsed.summary || `Classified as ${parsed.intent}`,
    };
  } catch (err) {
    console.error("[intent-analyzer] LLM failed, falling back:", err);
    return fallbackIntentAnalysis(input);
  }
}

function parseIntentResponse(response: string): Partial<IntentAnalysis> {
  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {};
    }
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {};
  }
}

function validDepth(depth: unknown): ResearchDepth | undefined {
  return Object.values(ResearchDepth).includes(depth as ResearchDepth)
    ? (depth as ResearchDepth)
    : undefined;
}

function validateIntent(intent: string): ExecutionMode {
  const valid: ExecutionMode[] = [ExecutionMode.DIRECT, ExecutionMode.COMPLAINT, ExecutionMode.RESEARCH, ExecutionMode.HYBRID];
  const match = valid.find((m) => m === intent);
  return match || ExecutionMode.DIRECT;
}

function clampConfidence(confidence: number): number {
  const num = Number(confidence);
  if (isNaN(num)) return 0.5;
  return Math.max(0, Math.min(1, num));
}

function fallbackIntentAnalysis(input: string): IntentAnalysis {
  const lower = input.toLowerCase();
  const complaintWords = ["problem", "issue", "not working", "broken", "error", "failed", "can't", "cannot", "help", "support"];
  const researchWords = ["price", "cost", "latest", "news", "how much", "what is", "recommendation", "compare", "best", "trending"];

  const isComplaint = complaintWords.some((w) => lower.includes(w)) && input.length > 10;
  const isResearch = researchWords.some((w) => lower.includes(w)) && input.length > 5;

  if (isComplaint && isResearch) {
    return {
      intent: ExecutionMode.HYBRID,
      confidence: 0.7,
      requiresWeb: true,
      requiresCurrentInformation: false,
      requiresExternalSources: false,
      requiresComplaintClassification: true,
      requiresInternalData: false,
      requiresCalculation: false,
      researchDepth: ResearchDepth.STANDARD,
      searchQueries: [],
      reasoning: "Input appears to require both classification and some information lookup.",
      summary: "Hybrid: complaint classification + information lookup",
    };
  }
  if (isComplaint) {
    return {
      intent: ExecutionMode.COMPLAINT,
      confidence: 0.75,
      requiresWeb: false,
      requiresCurrentInformation: false,
      requiresExternalSources: false,
      requiresComplaintClassification: true,
      requiresInternalData: false,
      requiresCalculation: false,
      researchDepth: ResearchDepth.QUICK,
      searchQueries: [],
      reasoning: "Input appears to describe a problem requiring classification.",
      summary: "Complaint classification needed",
    };
  }
  if (isResearch) {
    return {
      intent: ExecutionMode.RESEARCH,
      confidence: 0.7,
      requiresWeb: true,
      requiresCurrentInformation: true,
      requiresExternalSources: true,
      requiresComplaintClassification: false,
      requiresInternalData: false,
      requiresCalculation: false,
      researchDepth: ResearchDepth.STANDARD,
      searchQueries: [input],
      reasoning: "Input appears to request current or external information.",
      summary: "Research needed for external information",
    };
  }

  return {
    intent: ExecutionMode.DIRECT,
    confidence: 0.8,
    requiresWeb: false,
    requiresCurrentInformation: false,
    requiresExternalSources: false,
    requiresComplaintClassification: false,
    requiresInternalData: false,
    requiresCalculation: false,
    researchDepth: ResearchDepth.QUICK,
    searchQueries: [],
    reasoning: "Input appears answerable from existing knowledge.",
    summary: "Direct answer possible without external info",
  };
}
