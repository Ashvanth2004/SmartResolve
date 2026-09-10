import type { SearchResult, SearchOptions } from "@/lib/ai/models/intent-analysis";

export interface WebSearchProvider {
  name: string;
  search(query: string, options?: SearchOptions): Promise<SearchResult[]>;
  isAvailable(): boolean | Promise<boolean>;
}

export interface WebSearchConfig {
  provider: "duckduckgo" | "serper" | "tavily";
  apiKey?: string;
  baseUrl?: string;
  maxResults: number;
  timeout: number;
}

export class SearchProviderError extends Error {
  constructor(
    message: string,
    public readonly provider: string,
    public readonly originalError?: Error
  ) {
    super(message);
    this.name = "SearchProviderError";
  }
}
