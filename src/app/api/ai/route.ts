import { NextResponse } from "next/server";
import { z } from "zod";
import { createOrchestrator } from "@/lib/ai/ai-orchestrator";
import { createOpenAIProvider, createOllamaProvider } from "@/lib/ai/providers/llm-provider";
import { DuckDuckGoSearchProvider } from "@/lib/ai/research/web-search-provider";

const BodySchema = z.object({
  input: z.string().min(1).max(4000),
  mode: z.enum(["auto", "direct", "complaint", "research", "hybrid"]).optional().default("auto"),
  context: z.record(z.unknown()).optional(),
});

export const dynamic = "force-dynamic";

function getLLMProvider() {
  const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || "http://localhost:11434/v1";
  const ollamaModel = process.env.OLLAMA_MODEL?.trim() || "llama3";
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim();
  const openaiBaseUrl = process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1";
  const openaiModel = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

  if (ollamaBaseUrl && ollamaModel) {
    return createOllamaProvider({ name: "ollama", baseUrl: ollamaBaseUrl, model: ollamaModel });
  }

  if (openaiApiKey) {
    return createOpenAIProvider({
      name: "openai",
      baseUrl: openaiBaseUrl,
      apiKey: openaiApiKey,
      model: openaiModel,
    });
  }

  return createOllamaProvider({ name: "ollama-fallback", baseUrl: ollamaBaseUrl, model: ollamaModel });
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { input, mode, context } = parsed.data;

    const provider = getLLMProvider();
    const searchProvider = new DuckDuckGoSearchProvider();

    const orchestrator = createOrchestrator({
      llmProvider: provider,
      searchProvider,
      fetchPages: true,
      maxResults: 10,
      crossCheck: true,
    });

    const result = await orchestrator.resolve(input, context);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/ai]", e);
    return NextResponse.json(
      { error: "AI resolution failed. Please try again." },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const input = sp.get("input");

  if (!input) {
    return NextResponse.json({ error: "Query parameter 'input' is required." }, { status: 400 });
  }

  const bodySchema = z.object({
    input: z.string(),
    mode: z.enum(["auto", "direct", "complaint", "research", "hybrid"]).optional(),
  });

  const parsed = bodySchema.safeParse({ input, mode: "auto" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input." }, { status: 400 });
  }

  try {
    const provider = getLLMProvider();
    const searchProvider = new DuckDuckGoSearchProvider();
    const orchestrator = createOrchestrator({
      llmProvider: provider,
      searchProvider,
      fetchPages: true,
      maxResults: 10,
      crossCheck: true,
    });

    const result = await orchestrator.resolve(input);
    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/ai:GET]", e);
    return NextResponse.json({ error: "AI resolution failed." }, { status: 500 });
  }
}
