import { SourcePage, SourceType } from "@/lib/ai/models/intent-analysis";

export function extractContentFromHtml(html: string): string {
  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

  return text.slice(0, 20000);
}

export function extractMetadataFromHtml(html: string): {
  description?: string;
  keywords?: string[];
  publishedTime?: string;
  author?: string;
} {
  const descriptionMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["']/i);
  const publishedMatch = html.match(/<meta[^>]*property=["']article:published_time["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*name=["']publishdate["'][^>]*content=["']([^"']*)["']/i)
    || html.match(/<meta[^>]*name=["']date["'][^>]*content=["']([^"']*)["']/i);
  const authorMatch = html.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']*)["']/i);

  return {
    description: descriptionMatch?.[1],
    publishedTime: publishedMatch?.[1],
    author: authorMatch?.[1],
  };
}

export function buildSourcePage(
  url: string,
  title: string,
  html: string,
  options?: { publishedAt?: string; sourceType?: SourceType }
): SourcePage {
  const content = extractContentFromHtml(html);
  const domain = extractDomain(url);

  return {
    url,
    title,
    domain,
    content,
    publishedAt: options?.publishedAt,
    sourceType: options?.sourceType || classifySourceType(domain),
    fetchedAt: Date.now(),
    relevanceScore: 0,
  };
}

function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "unknown";
  }
}

function classifySourceType(domain: string): SourceType {
  const lower = domain.toLowerCase();
  const official = ["gov", "edu", ".gov", ".edu"];
  const news = ["news", "reuters", "bbc", "nytimes", "washingtonpost", "guardian", "cnn"];
  const research = ["arxiv", "nature", "scientific", "research", "ieee", "springer", "pubmed"];
  const community = ["reddit", "stackexchange", "medium", "quora", "wikipedia", "wordpress"];

  if (official.some((d) => lower.includes(d))) return SourceType.OFFICIAL;
  if (news.some((d) => lower.includes(d))) return SourceType.NEWS;
  if (research.some((d) => lower.includes(d))) return SourceType.RESEARCH;
  if (community.some((d) => lower.includes(d))) return SourceType.COMMUNITY;
  return SourceType.OTHER;
}
