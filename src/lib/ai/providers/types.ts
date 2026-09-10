export interface LLMProvider {
  name: string;
  analyzeIntent(input: string, context?: Record<string, unknown>): Promise<import("@/lib/ai/models/intent-analysis").IntentAnalysis>;
  generateResponse(prompt: string, systemPrompt?: string): Promise<string>;
  isAvailable(): boolean;
}

export interface LLMProviderConfig {
  name: string;
  baseUrl: string;
  apiKey?: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
  };
}

export interface WebSearchProvider {
  name: string;
  search(query: string, options?: import("@/lib/ai/models/intent-analysis").SearchOptions): Promise<import("@/lib/ai/models/intent-analysis").SearchResult[]>;
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
