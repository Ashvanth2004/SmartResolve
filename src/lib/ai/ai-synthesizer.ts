import type { LLMProvider } from "@/lib/ai/providers/types";
import type { IntentAnalysis, ResolveResponse, Citation, SourcePage, ResearchResult, Evidence } from "@/lib/ai/models/intent-analysis";
import type { ComplaintClassificationResult } from "@/lib/ai/models/intent-analysis";
import { ExecutionMode } from "@/lib/ai/models/intent-analysis";
import { formatResearchResultForLLM } from "@/lib/ai/research/research-service";
import { generateCitationMarkdown } from "@/lib/ai/research/citation-service";

interface SynthesizerInput {
  userInput: string;
  intentAnalysis: IntentAnalysis;
  complaintResult: ComplaintClassificationResult | null;
  researchResult: ResearchResult | null;
  processingTimeMs: number;
}

export async function synthesizeAnswer(
  llmProvider: LLMProvider,
  input: SynthesizerInput
): Promise<ResolveResponse> {
  const { userInput, intentAnalysis, complaintResult, researchResult, processingTimeMs } = input;

  const prompt = buildSynthesisPrompt(userInput, intentAnalysis, complaintResult, researchResult);

  try {
    const llmResponse = await llmProvider.generateResponse(prompt);

    const citations = researchResult?.citations || [];
    const sources = researchResult?.results || [];
    const answer = llmResponse || "Unable to generate a response.";

    return {
      answer: formatAnswerWithCitations(answer, citations),
      mode: intentAnalysis.intent,
      confidence: intentAnalysis.confidence,
      citations,
      sources,
      researchPerformed: researchResult !== null && !researchResult.searchFailed,
      complaintClassification: complaintResult || undefined,
      researchResult: researchResult || undefined,
      processingTimeMs,
      error: researchResult?.searchFailed ? researchResult.errorMessage : undefined,
    };
  } catch (err) {
    const citations = researchResult?.citations || [];
    return {
      answer: "Unable to synthesize a response at this time.",
      mode: intentAnalysis.intent,
      confidence: 0,
      citations,
      sources: researchResult?.results || [],
      researchPerformed: false,
      complaintClassification: complaintResult || undefined,
      processingTimeMs,
      error: err instanceof Error ? err.message : "Synthesis failed",
    };
  }
}

function buildSynthesisPrompt(
  userInput: string,
  intentAnalysis: IntentAnalysis,
  complaintResult: ComplaintClassificationResult | null,
  researchResult: ResearchResult | null
): string {
  let prompt = `Based on the following analysis and evidence, provide a comprehensive answer to the user's question.

USER INPUT:
${userInput}

INTENT ANALYSIS:
- Mode: ${intentAnalysis.intent}
- Confidence: ${(intentAnalysis.confidence * 100).toFixed(1)}%
- Reasoning: ${intentAnalysis.reasoning}

`;

  if (complaintResult) {
    prompt += `COMPLAINT CLASSIFICATION:
- Category: ${complaintResult.categoryName}
- Subcategory: ${complaintResult.subcategory}
- Priority: ${complaintResult.priority}
- Sentiment: ${complaintResult.sentiment}
- Department: ${complaintResult.department}
- Confidence: ${(complaintResult.confidence * 100).toFixed(1)}%
- Suggested Resolution: ${complaintResult.suggestedResolution}

`;
  }

  if (researchResult && !researchResult.searchFailed) {
    prompt += `RESEARCH EVIDENCE:
${formatResearchResultForLLM(researchResult)}

CITATIONS:
${generateCitationMarkdown(researchResult.citations || [])}

`;
  } else if (researchResult && researchResult.searchFailed) {
    prompt += `⚠️ Web research was not available. ${researchResult.errorMessage || ""}\n`;
  }

  prompt += `RESPONSE GUIDELINES:
1. Answer the user's question directly and clearly.
2. If complaint classification was performed, acknowledge it and use the classification to inform the answer.
3. If research was performed, base the answer on the retrieved evidence and include citations.
4. If research failed, clearly state the limitation without fabricating sources.
5. Be helpful, accurate, and cite all external information used.
6. Do not invent facts, sources, URLs, or citations.`;

  return prompt;
}

function formatAnswerWithCitations(answer: string, citations: Citation[]): string {
  if (citations.length === 0) return answer;
  return answer + generateCitationMarkdown(citations);
}
