import { NextResponse } from "next/server";
import { z } from "zod";
import { ResearchService } from "@/lib/ai/research/research-service";
import { DuckDuckGoSearchProvider } from "@/lib/ai/research/web-search-provider";

const BodySchema = z.object({
  query: z.string().min(1).max(2000),
  maxResults: z.number().min(1).max(20).optional().default(10),
  fetchPages: z.boolean().optional().default(true),
  crossCheck: z.boolean().optional().default(true),
});

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
    }

    const { query, maxResults, fetchPages, crossCheck } = parsed.data;

    const searchProvider = new DuckDuckGoSearchProvider();
    const service = new ResearchService({
      searchProvider,
      fetchPages,
      maxResults,
      crossCheck,
      timeout: 15000,
    });

    const result = await service.research(query);

    return NextResponse.json(result);
  } catch (e) {
    console.error("[api/research]", e);
    return NextResponse.json({ error: "Research failed." }, { status: 500 });
  }
}
