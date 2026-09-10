import { ResearchDepth } from "@/lib/ai/models/intent-analysis";
import type { SearchOptions } from "@/lib/ai/models/intent-analysis";
import type { WebSearchProvider } from "@/lib/ai/providers/web-search-provider";

export interface ResearchPlan {
  queries: string[];
  depth: ResearchDepth;
  maxResults: number;
  fetchPages: boolean;
  crossCheck: boolean;
  explanation: string;
}

export function planResearch(
  queries: string[],
  intentDepth: ResearchDepth,
  provider: WebSearchProvider
): ResearchPlan {
  const depthConfig = getDepthConfig(intentDepth);

  return {
    queries,
    depth: intentDepth,
    maxResults: depthConfig.maxResults,
    fetchPages: depthConfig.fetchPages,
    crossCheck: depthConfig.crossCheck,
    explanation: `Research plan: ${queries.length} queries at ${intentDepth} depth using ${provider.name}. ${depthConfig.explanation}`,
  };
}

function getDepthConfig(depth: ResearchDepth): {
  maxResults: number;
  fetchPages: boolean;
  crossCheck: boolean;
  explanation: string;
} {
  switch (depth) {
    case ResearchDepth.QUICK:
      return {
        maxResults: 5,
        fetchPages: false,
        crossCheck: false,
        explanation: "Quick lookup - search only, no page fetching.",
      };
    case ResearchDepth.STANDARD:
      return {
        maxResults: 10,
        fetchPages: true,
        crossCheck: true,
        explanation: "Standard research - search and fetch top pages with cross-checking.",
      };
    case ResearchDepth.MULTI_SOURCE:
      return {
        maxResults: 20,
        fetchPages: true,
        crossCheck: true,
        explanation: "Multi-source research - extensive search, page fetching, and cross-verification.",
      };
  }
}

export function generateSearchQueries(intentAnalysis: {
  input: string;
  reasoning: string;
}): string[] {
  const queries: string[] = [];
  const input = intentAnalysis.input.toLowerCase();

  queries.push(input);

  if (input.includes("latest") || input.includes("current") || input.includes("2024") || input.includes("2025")) {
    queries.push(`${input} latest 2025`);
  }

  if (input.includes("best") || input.includes("recommend") || input.includes("compare")) {
    queries.push(`${input} review comparison`);
    queries.push(`${input} top rated`);
  }

  queries.push(`${input} guide tutorial`);
  queries.push(`${input} how to fix solve`);

  return [...new Set(queries)];
}
