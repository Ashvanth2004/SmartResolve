import { Citation, SourcePage, Evidence } from "@/lib/ai/models/intent-analysis";
import { generateCitations } from "./source-ranker";
import { formatEvidenceForLLM } from "./evidence-extractor";

export function formatCitations(citations: Citation[]): string {
  return citations
    .map((c) => `${c.id}. **${c.title}** (${c.sourceType}): ${c.url}`)
    .join("\n");
}

export function generateCitationMarkdown(citations: Citation[]): string {
  if (citations.length === 0) return "";

  let md = "\n\n**Sources:**\n";
  for (const c of citations) {
    md += `\n- [${c.id}] ${c.title}: ${c.url}`;
  }
  return md;
}

export function generateEvidenceSection(evidence: Evidence[]): string {
  if (evidence.length === 0) return "";
  return formatEvidenceForLLM(evidence);
}

export function buildResearchSummary(
  citations: Citation[],
  evidenceCount: number,
  researchCompleted: boolean
): string {
  if (!researchCompleted) {
    return "⚠️ Research was not fully completed due to search failures.";
  }
  if (citations.length === 0) {
    return "No external sources were found for this query.";
  }
  return `Based on ${evidenceCount} evidence items from ${citations.length} external sources.`;
}

export function formatCitationsForDisplay(citations: Citation[]): string {
  return citations
    .map((c) => `[${c.id}] ${c.title} (${c.sourceType}) — ${c.url}`)
    .join("\n");
}
