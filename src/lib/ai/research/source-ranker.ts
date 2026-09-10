import { SourcePage, Evidence, Citation, SourceType } from "@/lib/ai/models/intent-analysis";

export function rankSources(sources: SourcePage[], query: string): SourcePage[] {
  const queryTerms = extractQueryTerms(query);

  return sources
    .map((source) => {
      const score = calculateRelevanceScore(source, queryTerms);
      return { ...source, relevanceScore: score };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}

function extractQueryTerms(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-zA-Z0-9]+/)
    .filter((w) => w.length > 2);
}

function calculateRelevanceScore(source: SourcePage, queryTerms: string[]): number {
  let score = 0;
  const contentLower = source.content.toLowerCase();
  const titleLower = source.title.toLowerCase();
  const domainLower = source.domain.toLowerCase();

  for (const term of queryTerms) {
    if (titleLower.includes(term)) score += 3;
    if (contentLower.includes(term)) score += 1;
    if (domainLower.includes(term)) score += 2;
  }

  if (source.sourceType === SourceType.OFFICIAL) score += 2;
  if (source.sourceType === SourceType.RESEARCH) score += 1.5;
  if (source.sourceType === SourceType.NEWS) score += 1;

  if (source.publishedAt) {
    const pubDate = new Date(source.publishedAt);
    const ageDays = (Date.now() - pubDate.getTime()) / (1000 * 60 * 60 * 24);
    if (ageDays < 7) score += 2;
    else if (ageDays < 30) score += 1;
    else if (ageDays > 365) score -= 1;
  }

  return Math.max(0, Math.min(10, score));
}

export function extractEvidence(sources: SourcePage[], query: string): Evidence[] {
  const queryTerms = extractQueryTerms(query);
  const evidence: Evidence[] = [];

  for (const source of sources) {
    if (source.relevanceScore < 1) continue;

    const sentences = source.content.split(/[.!?]+/).filter((s) => s.trim().length > 10);

    for (const sentence of sentences) {
      const sentenceLower = sentence.toLowerCase();
      const termMatches = queryTerms.filter((term) => sentenceLower.includes(term));

      if (termMatches.length >= 1) {
        evidence.push({
          text: sentence.trim() + ".",
          sourceUrl: source.url,
          sourceTitle: source.title,
          sourceType: source.sourceType,
          relevanceScore: source.relevanceScore,
          publishedAt: source.publishedAt,
        });
      }
    }
  }

  evidence.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return evidence.slice(0, 20);
}

export function removeDuplicates(sources: SourcePage[]): SourcePage[] {
  const seen = new Set<string>();
  return sources.filter((source) => {
    const key = source.url;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function generateCitations(evidence: Evidence[]): Citation[] {
  const citations: Citation[] = [];
  const seenUrls = new Set<string>();
  let id = 1;

  for (const ev of evidence) {
    if (seenUrls.has(ev.sourceUrl)) continue;
    seenUrls.add(ev.sourceUrl);
    citations.push({
      id: `cite-${id++}`,
      text: ev.text.slice(0, 200),
      url: ev.sourceUrl,
      title: ev.sourceTitle,
      sourceType: ev.sourceType,
    });
  }

  return citations;
}
