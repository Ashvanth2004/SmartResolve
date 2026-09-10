export enum ExecutionMode {
  DIRECT = "DIRECT",
  COMPLAINT = "COMPLAINT",
  RESEARCH = "RESEARCH",
  HYBRID = "HYBRID",
}

export enum InformationRequirement {
  NONE = "none",
  CURRENT = "current",
  SPECIFIC = "specific",
  COMPLEX = "complex",
}

export enum ResearchDepth {
  QUICK = "quick",
  STANDARD = "standard",
  MULTI_SOURCE = "multi_source",
}

export enum SourceType {
  OFFICIAL = "official",
  NEWS = "news",
  RESEARCH = "research",
  COMMUNITY = "community",
  OTHER = "other",
}

export interface IntentAnalysis {
  intent: ExecutionMode;
  confidence: number;
  requiresWeb: boolean;
  requiresCurrentInformation: boolean;
  requiresExternalSources: boolean;
  requiresComplaintClassification: boolean;
  requiresInternalData: boolean;
  requiresCalculation: boolean;
  researchDepth: ResearchDepth;
  searchQueries: string[];
  reasoning: string;
  summary: string;
}

export interface SearchOptions {
  numResults?: number;
  region?: string;
  freshness?: string;
}

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  publishedAt?: string;
  sourceType: SourceType;
}

export interface SourcePage {
  url: string;
  title: string;
  domain: string;
  content: string;
  publishedAt?: string;
  sourceType: SourceType;
  fetchedAt: number;
  relevanceScore: number;
}

export interface Evidence {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
  sourceType: SourceType;
  relevanceScore: number;
  publishedAt?: string;
}

export interface ResearchResult {
  query: string;
  results: SourcePage[];
  evidence: Evidence[];
  citations: Citation[];
  researchCompleted: boolean;
  searchFailed: boolean;
  errorMessage?: string;
}

export interface Citation {
  id: string;
  text: string;
  url: string;
  title: string;
  sourceType: SourceType;
}

export interface ResolveResponse {
  answer: string;
  mode: ExecutionMode;
  confidence: number;
  citations: Citation[];
  sources: SourcePage[];
  researchPerformed: boolean;
  complaintClassification?: ComplaintClassificationResult;
  researchResult?: ResearchResult;
  processingTimeMs: number;
  error?: string;
}

export interface ComplaintClassificationResult {
  category: string;
  categoryName: string;
  subcategory: string;
  priority: string;
  severity: string;
  sentiment: string;
  department: string;
  confidence: number;
  suggestedResolution: string;
  model: string;
}

export interface ConversationContext {
  previousIntent?: ExecutionMode;
  userRole: string;
  messages: Array<{ role: string; content: string }>;
}
