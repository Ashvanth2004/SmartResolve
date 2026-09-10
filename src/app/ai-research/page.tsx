"use client";

import { useState } from "react";
import { Send, Search, Wrench, Lightbulb, ExternalLink } from "lucide-react";
import { AiOrb } from "@/lib/ui/ai-effects";

interface Citation {
  id: string;
  text: string;
  url: string;
  title: string;
  sourceType: string;
}

interface ResearchResult {
  query: string;
  results: Array<{
    title: string;
    url: string;
    domain: string;
    snippet: string;
    sourceType: string;
  }>;
  citations: Citation[];
  researchCompleted: boolean;
  searchFailed: boolean;
  errorMessage?: string;
}

interface ResolveResponse {
  answer: string;
  mode: string;
  confidence: number;
  citations: Citation[];
  sources: any[];
  researchPerformed: boolean;
  complaintClassification?: any;
  researchResult?: ResearchResult;
  processingTimeMs: number;
  error?: string;
}

export default function AIResearchPage() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ResolveResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(prompt?: string) {
    const content = (prompt ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);
    setResult(null);
    setLoading(true);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: content, mode: "auto" }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setResult(data);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-4 md:p-6 space-y-5 max-w-6xl mx-auto ai-hero-in relative">
      <div className="float-blobs" aria-hidden>
        <span className="float-blob h-48 w-48 -top-10 right-10" style={{ background: "#fca5a5" }} />
        <span className="float-blob h-40 w-40 top-32 -left-10" style={{ background: "#fecaca", animationDelay: "-3s" }} />
      </div>
      <div className="relative">
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <AiOrb size={28} /> <span className="gradient-shift">AI Research & Analysis</span>
        </h1>
        <p className="text-sm text-muted">
          Enter any question or problem. The system automatically determines whether to classify it, research it, or both.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-4 stagger-in relative">
        <div className="card-shine border rounded-xl p-4 bg-surface hover:-translate-y-1 hover:shadow-card transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={16} className="text-red-500 jiggle" />
            <h3 className="font-semibold text-sm">COMPLAINT</h3>
          </div>
          <p className="text-xs text-muted">Describe a problem or issue. The system classifies it automatically.</p>
        </div>
        <div className="card-shine border rounded-xl p-4 bg-surface hover:-translate-y-1 hover:shadow-card transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Search size={16} className="text-rose-500 bounce-soft" />
            <h3 className="font-semibold text-sm">RESEARCH</h3>
          </div>
          <p className="text-xs text-muted">Ask about current info, prices, news, regulations. Web search is automatic.</p>
        </div>
        <div className="card-shine border rounded-xl p-4 bg-surface hover:-translate-y-1 hover:shadow-card transition-all duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Lightbulb size={16} className="text-yellow-500 animate-wiggle-hover" />
            <h3 className="font-semibold text-sm">HYBRID</h3>
          </div>
          <p className="text-xs text-muted">Both classification and research. Example: &quot;My router broke — what are the latest fixes?&quot;</p>
        </div>
      </div>

      <div className="border rounded-xl bg-surface">
        <div className="p-4 border-b border-app">
          <div className="flex gap-3">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask anything... e.g. 'My internet keeps disconnecting' or 'What are the latest Wi-Fi 7 router recommendations?'"
              className="flex-1 rounded-lg border border-app bg-surface-2 px-4 py-3 text-sm text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-red-500/50 resize-none"
              rows={3}
            />
            <button
              onClick={() => send()}
              disabled={loading || !input.trim()}
              className="h-12 w-12 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed shrink-0 transition-colors"
              aria-label="Send"
            >
              {loading ? <span className="ai-wave" aria-hidden><span /><span /><span /><span /><span /></span> : <Send size={16} />}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 mt-2">
            {[
              'My internet keeps disconnecting',
              'What are the latest Wi-Fi 7 router recommendations?',
              'My router broke — classify this complaint and find latest fixes',
              'How much does a MacBook Pro M4 cost?',
            ].map((s) => (
              <button
                key={s}
                onClick={() => { setInput(s); send(s); }}
                disabled={loading}
                className="text-xs px-3 py-1 rounded-full border border-app bg-surface hover:bg-red-50 dark:hover:bg-red-950/50 text-muted transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="p-4 border-b border-red-200 bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {result && (
          <div className="p-4 space-y-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="font-mono text-xs bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-2 py-0.5 rounded">
                {result.mode}
              </span>
              <span className="text-muted">
                Confidence: {(result.confidence * 100).toFixed(1)}% · {result.processingTimeMs}ms
              </span>
            </div>

            <div className="prose-sm text-sm text-foreground whitespace-pre-wrap">
              {result.answer}
            </div>

            {result.complaintClassification && (
              <div className="border rounded-lg p-3 bg-surface-2">
                <h4 className="font-semibold text-sm mb-1">Classification:</h4>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  <span>Category: <strong>{result.complaintClassification.categoryName}</strong></span>
                  <span>Priority: <strong>{result.complaintClassification.priority}</strong></span>
                  <span>Department: <strong>{result.complaintClassification.department}</strong></span>
                  <span>Confidence: <strong>{(result.complaintClassification.confidence * 100).toFixed(1)}%</strong></span>
                </div>
              </div>
            )}

            {result.researchResult && !result.researchResult.searchFailed && (
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Sources ({result.researchResult.citations.length}):</h4>
                {result.researchResult.results.slice(0, 5).map((r, i) => (
                  <div key={i} className="border rounded-lg p-3 bg-surface-2 text-xs">
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="font-medium text-red-600 dark:text-red-400 hover:underline flex items-center gap-1">
                      {r.title} <ExternalLink size={10} />
                    </a>
                    <p className="text-muted mt-1">{r.domain}</p>
                    {r.snippet && <p className="mt-1">{r.snippet.slice(0, 150)}...</p>}
                  </div>
                ))}
                {result.citations.length > 0 && (
                  <div className="text-xs text-muted space-y-1">
                    {result.citations.map((c) => (
                      <p key={c.id}>
                        <strong>{c.id}.</strong> <a href={c.url} target="_blank" rel="noopener noreferrer" className="text-red-600 hover:underline">{c.title}</a>
                      </p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {result.researchResult?.searchFailed && (
              <div className="border rounded-lg p-3 bg-yellow-50 dark:bg-yellow-900/20 text-xs text-yellow-700 dark:text-yellow-300">
                ⚠️ Web search was unavailable. {result.researchResult.errorMessage}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
