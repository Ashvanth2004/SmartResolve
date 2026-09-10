import { type SearchResult, type SearchOptions, SourceType } from "@/lib/ai/models/intent-analysis";
import { type WebSearchProvider, SearchProviderError } from "@/lib/ai/providers/types";

export class DuckDuckGoSearchProvider implements WebSearchProvider {
    name = "DuckDuckGo";
  private readonly baseUrl = "https://html.duckduckgo.com/html";

  constructor(
    private readonly maxResults: number = 10,
    private readonly timeout: number = 15000
  ) {}

  async isAvailable(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}?q=test`, {
        method: "GET",
        signal: AbortSignal.timeout(5000),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      return res.ok;
    } catch {
      return false;
    }
  }

  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    const numResults = options?.numResults || this.maxResults;
    const params = new URLSearchParams({
      q: query,
      kl: "us-en",
    });

    try {
      const res = await fetch(`${this.baseUrl}?${params}`, {
        method: "GET",
        signal: AbortSignal.timeout(this.timeout),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Accept": "text/html",
        },
      });

      if (!res.ok) {
        throw new SearchProviderError(
          `DuckDuckGo returned ${res.status}`,
          this.name
        );
      }

      const html = await res.text();
      const results = this.parseHtml(html, query);
      return results.slice(0, numResults);
    } catch (err) {
      if (err instanceof SearchProviderError) throw err;
      throw new SearchProviderError(
        `DuckDuckGo search failed: ${err instanceof Error ? err.message : "Unknown error"}`,
        this.name,
        err instanceof Error ? err : undefined
      );
    }
  }

  private parseHtml(html: string, query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const linkRegex = /<a rel="nofollow" class="result__a" href="([^"]+)"[^>]*>([^<]+)<\/a>/gi;
    const snippetRegex = /<a class="result__snippet"[^>]*>([^<]+)<\/a>/gi;

    const links: Array<{ url: string; title: string }> = [];
    const snippets: string[] = [];

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      links.push({ url: match[1], title: match[2].trim() });
    }

    let snipMatch;
    while ((snipMatch = snippetRegex.exec(html)) !== null) {
      snippets.push(snipMatch[1].trim());
    }

    for (let i = 0; i < Math.min(links.length, snippets.length, this.maxResults); i++) {
      const url = links[i].url;
      const domain = this.extractDomain(url);
      results.push({
        title: links[i].title,
        url,
        snippet: snippets[i] || "",
        domain,
        sourceType: this.classifySourceType(domain),
      });
    }

    return results;
  }

  private extractDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "unknown";
    }
  }

  private classifySourceType(domain: string): SourceType {
    const lower = domain.toLowerCase();
    const official = ["gov", "edu", ".gov", ".edu"];
    const news = ["news", "reuters", "bbc", "nytimes", "washingtonpost", "guardian"];
    const research = ["arxiv", "nature", "scientific", "research", "ieee", "springer"];
    const community = ["reddit", "stackexchange", "medium", "quora", "wikipedia"];

    if (official.some((d) => lower.includes(d))) return SourceType.OFFICIAL;
    if (news.some((d) => lower.includes(d))) return SourceType.NEWS;
    if (research.some((d) => lower.includes(d))) return SourceType.RESEARCH;
    if (community.some((d) => lower.includes(d))) return SourceType.COMMUNITY;
    return SourceType.OTHER;
  }
}
