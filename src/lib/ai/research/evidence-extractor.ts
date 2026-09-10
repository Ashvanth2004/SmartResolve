import { Evidence, Citation, SourcePage, SourceType } from "@/lib/ai/models/intent-analysis";

export function crossCheckClaims(evidence: Evidence[]): {
  verified: Evidence[];
  unverified: Evidence[];
  conflicts: Array<{ claim1: string; claim2: string; source1: string; source2: string }>;
} {
  const verified: Evidence[] = [];
  const unverified: Evidence[] = [];
  const conflicts: Array<{ claim1: string; claim2: string; source1: string; source2: string }> = [];

  const claimSources = new Map<string, string[]>();

  for (const ev of evidence) {
    const key = normalizeClaim(ev.text);
    const sources = claimSources.get(key) || [];
    sources.push(ev.sourceUrl);
    claimSources.set(key, sources);
  }

  for (const [claim, sources] of claimSources) {
    if (sources.length >= 2) {
      verified.push(evidence.find((e) => e.text.includes(claim))!);
    } else {
      unverified.push(evidence.find((e) => e.text.includes(claim))!);
    }
  }

  return { verified, unverified, conflicts };
}

function normalizeClaim(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
}

export function formatEvidenceForLLM(evidence: Evidence[]): string {
  return evidence
    .map((ev, i) => `[Evidence ${i + 1} | ${ev.sourceType} | ${ev.sourceTitle}] ${ev.text}`)
    .join("\n\n");
}

export function formatCitationsForDisplay(citations: Citation[]): string {
  return citations
    .map((c) => `[${c.id}] ${c.title} (${c.sourceType}) — ${c.url}`)
    .join("\n");
}

export function validateCitations(citations: Citation[]): boolean {
  return citations.every((c) => c.url.startsWith("http://") || c.url.startsWith("https://"));
}
