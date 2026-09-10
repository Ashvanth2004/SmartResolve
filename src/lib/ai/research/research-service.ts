import { DuckDuckGoSearchProvider } from "@/lib/ai/research/web-search-provider";
import { fetchPageContent } from "@/lib/ai/research/web-page-reader";
import { buildSourcePage, extractContentFromHtml } from "@/lib/ai/research/content-extractor";
import { rankSources, removeDuplicates, extractEvidence, generateCitations } from "@/lib/ai/research/source-ranker";
import { crossCheckClaims } from "@/lib/ai/research/evidence-extractor";
import { generateCitationMarkdown } from "@/lib/ai/research/citation-service";
import type { SearchResult, ResearchResult, Evidence, Citation, SourcePage } from "@/lib/ai/models/intent-analysis";
import type { WebSearchProvider } from "@/lib/ai/providers/types";
import { SearchProviderError } from "@/lib/ai/providers/types";

export interface ResearchConfig {
  searchProvider: WebSearchProvider;
  fetchPages: boolean;
  maxResults: number;
  crossCheck: boolean;
  timeout: number;
}

const DEFAULT_CONFIG: ResearchConfig = {
  searchProvider: new DuckDuckGoSearchProvider(),
  fetchPages: true,
  maxResults: 10,
  crossCheck: true,
  timeout: 15000,
};

export class ResearchService {
  constructor(private readonly config: Partial<ResearchConfig> = {}) {}

  async research(query: string): Promise<ResearchResult> {
    const cfg = { ...DEFAULT_CONFIG, ...this.config };
    const searchQueries = [query];
    const allResults: SearchResult[] = [];
    const errorMessages: string[] = [];

    for (const q of searchQueries) {
      try {
        const results = await cfg.searchProvider.search(q, { numResults: cfg.maxResults });
        allResults.push(...results);
      } catch (err) {
        if (err instanceof SearchProviderError) {
          errorMessages.push(`Search provider "${err.provider}" failed: ${err.message}`);
        } else {
          errorMessages.push(`Search failed: ${err instanceof Error ? err.message : "Unknown"}`);
        }
      }
    }

    const uniqueResults = removeDuplicates(
      allResults.map((r) => ({
        url: r.url,
        title: r.title,
        domain: r.domain,
        content: r.snippet ?? "",
        publishedAt: r.publishedAt,
        sourceType: r.sourceType,
        fetchedAt: Date.now(),
        relevanceScore: 0,
      }))
    );
    const rankedSources = rankSources(uniqueResults, query);

    let fetchedPages: SourcePage[] = rankedSources;
    if (cfg.fetchPages) {
      fetchedPages = await this.fetchAllPages(rankedSources.slice(0, cfg.maxResults), cfg.timeout);
    }

    const evidence = extractEvidence(fetchedPages, query);

    if (cfg.crossCheck) {
      crossCheckClaims(evidence);
    }

    const citations = generateCitations(evidence);
    const researchCompleted = allResults.length > 0 || fetchedPages.length > 0;

    return {
      query,
      results: fetchedPages,
      evidence,
      citations,
      researchCompleted,
      searchFailed: allResults.length === 0 && fetchedPages.length === 0,
      errorMessage: errorMessages.length > 0 ? errorMessages.join("; ") : undefined,
    };
  }

  private async fetchAllPages(
    sources: Array<{ url: string; title: string; domain: string; content: string; sourceType: any; fetchedAt: number; relevanceScore: number }>,
    timeout: number
  ): Promise<SourcePage[]> {
    const fetched: SourcePage[] = [];
    for (const source of sources) {
      try {
        const page = await fetchPageContent(source.url, timeout);
        const fullSource = buildSourcePage(source.url, page.title, page.html, { sourceType: source.sourceType });
        fetched.push(fullSource);
      } catch {
        fetched.push({ ...source, content: source.content || "Could not fetch full content." });
      }
    }
    return fetched;
  }
}

export function formatResearchResultForLLM(result: ResearchResult): string {
  if (result.searchFailed) {
    return `⚠️ Web search was not available. ${result.errorMessage || "No results were retrieved."}`;
  }
  if (result.results.length === 0) {
    return "No external sources were found for this query.";
  }
  const sections = result.results
    .slice(0, 10)
    .map((r, i) => `[Source ${i + 1}: ${r.title}] (${r.domain})\n${r.content || ""}`);
  return sections.join("\n\n---\n\n");
}
