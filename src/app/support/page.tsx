"use client";

import { useEffect, useRef, useState } from "react";
import { Bot, Send, User, Sparkles, Trash2, AlertTriangle, Copy, Check, RefreshCw } from "lucide-react";
import { AiOrb, AiThinking } from "@/lib/ui/ai-effects";

/* ─── Types ─────────────────────────────────────────────── */
type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
  ts: Date;
}

/* ─── Suggested starter prompts ─────────────────────────── */
/* ─── Suggested starter topics ───────────────────────────── */
const STARTER_TOPICS = [
  { label: "🌐 Internet & Wi-Fi", prompt: "My internet keeps disconnecting. How do I fix it?" },
  { label: "🔑 Account & Password", prompt: "I forgot my password and can't log in." },
  { label: "⚡ App Crash & Speed", prompt: "My phone app keeps crashing on startup." },
  { label: "💳 Billing & Charges", prompt: "I was charged twice for my subscription." },
  { label: "🖨️ Printer & Hardware", prompt: "My printer shows as offline and won't print." },
  { label: "🔒 Security & Hacking", prompt: "I think my account was compromised. What steps should I take?" },
];

const STARTERS = [
  "My internet keeps disconnecting. How do I fix it?",
  "I forgot my password and can't log in.",
  "My phone app keeps crashing on startup.",
  "I was charged twice for my subscription.",
  "My laptop is running very slowly. What should I do?",
  "I think my account was hacked. What steps should I take?",
];

/* ─── Extract suggested follow-up questions from markdown ── */
function extractSuggestedQuestions(content: string): string[] {
  const match =
    content.match(/(?:\*\*|)?You (?:may|could) (?:also |)ask:(?:\*\*|)?[\s\S]*/i) ||
    content.match(/You could ask me things like:[\s\S]*/i);
  if (!match) return [];
  const lines = match[0].split("\n");
  const questions: string[] = [];
  for (const line of lines) {
    const qMatch = line.match(/^[-*]\s*"?([^"\n]+)"?/);
    if (qMatch && qMatch[1].length > 3) {
      questions.push(qMatch[1].replace(/^["']|["']$/g, "").trim());
    }
  }
  return questions;
}

/* ─── Minimal markdown renderer ─────────────────────────── */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<h3 class='font-semibold text-foreground mt-3 mb-1'>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2 class='font-bold text-foreground mt-4 mb-1 text-base'>$1</h2>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4 list-decimal'><strong>$1.</strong> $2</li>")
    .replace(/(<li.*<\/li>\n?)+/g, (m) => `<ul class='space-y-1 my-2'>${m}</ul>`)
    .replace(/\n---\n/g, "<hr class='border-border my-3'>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-surface-2 px-1 rounded text-xs font-mono'>$1</code>")
    .replace(/\n/g, "<br>");
}

/* ─── Single message bubble ─────────────────────────────── */
function Bubble({ msg, onSelectQuestion }: { msg: Message; onSelectQuestion: (q: string) => void }) {
  const isUser = msg.role === "user";
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(msg.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const suggestedQuestions = !isUser ? extractSuggestedQuestions(msg.content) : [];

  return (
    <div className={`flex gap-3 group ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      {isUser ? (
        <div className="flex items-center justify-center shrink-0 h-8 w-8 rounded-full bg-red-600 text-white">
          <User size={14} />
        </div>
      ) : (
        <AiOrb size={32} />
      )}

      {/* Bubble */}
      <div className={`relative max-w-[85%] sm:max-w-[78%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed ${
            isUser
              ? "bg-red-600 text-white rounded-tr-sm"
              : "bg-surface border border-app text-foreground rounded-tl-sm shadow-sm"
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap">{msg.content}</p>
          ) : (
            <div
              className="prose-sm"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
            />
          )}
        </div>

        {/* Interactive follow-up pills for next topic looping */}
        {!isUser && suggestedQuestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            <p className="w-full text-[10px] font-semibold uppercase tracking-wider text-muted flex items-center gap-1">
              <Sparkles size={10} className="text-red-500" /> Select next topic to explore:
            </p>
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => onSelectQuestion(q)}
                className="text-xs px-3 py-1.5 rounded-xl border border-red-200 dark:border-red-800/60 bg-red-50/80 dark:bg-red-950/40 text-red-700 dark:text-red-300 hover:bg-red-600 hover:text-white dark:hover:bg-red-600 dark:hover:text-white transition-all shadow-xs text-left flex items-center gap-1.5 group/pill"
              >
                <span className="text-red-500 group-hover/pill:text-white">↳</span>
                <span>{q}</span>
              </button>
            ))}
          </div>
        )}

        {/* Timestamp + copy */}
        <div
          className={`flex items-center gap-2 text-[10px] text-muted opacity-0 group-hover:opacity-100 transition-opacity ${
            isUser ? "flex-row-reverse" : "flex-row"
          }`}
        >
          <span>
            {msg.ts.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
          {!isUser && (
            <button onClick={copy} className="hover:text-foreground transition-colors" title="Copy response">
              {copied ? <Check size={11} /> : <Copy size={11} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Typing indicator ───────────────────────────────────── */
function TypingDots() {
  return (
    <div className="flex gap-3">
      <div className="bg-surface border border-red-500/20 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <AiThinking compact />
      </div>
    </div>
  );
}

/* ─── Main page ──────────────────────────────────────────── */
export default function SupportChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastAssistantIdRef = useRef<string | null>(null);

  // Welcome message on mount
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content:
          "**Hi there! 👋 I'm the ResolveAI Support Assistant.**\n\nI can help you troubleshoot technical issues, account problems, billing questions, device issues, and more.\n\n**To get started**, click any topic below or describe your problem in plain language — no technical knowledge needed!\n\n**You could also ask:**\n- \"My internet keeps disconnecting. How do I fix it?\"\n- \"I forgot my password and can't log in.\"\n- \"My phone app keeps crashing on startup.\"\n- \"I was charged twice for my subscription.\"",
        ts: new Date(),
      },
    ]);
  }, []);

  // Auto-scroll on new messages
  /* Scroll: your message -> bottom; assistant answer (e.g. after picking a suggestion) -> show its TOP */
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;
    if (last.role === "assistant" && last.id !== lastAssistantIdRef.current) {
      lastAssistantIdRef.current = last.id;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById("msg-" + last.id);
          const container = scrollContainerRef.current;
          if (el && container) {
            const top =
              el.getBoundingClientRect().top -
              container.getBoundingClientRect().top +
              container.scrollTop;
            container.scrollTo({ top: Math.max(0, top - 12), behavior: "smooth" });
          } else {
            el?.scrollIntoView({ behavior: "smooth", block: "start" });
          }
        });
      });
      return;
    }
    if (last.role === "user") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setInput("");
    setError(null);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
      ts: new Date(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      // Build conversation history (exclude welcome msg)
      const history = [...messages.filter((m) => m.id !== "welcome"), userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      const aiMsg: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.content,
        ts: new Date(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    // Restart the conversation — keep only the welcome message
    setMessages((prev) => prev.filter((m) => m.id === "welcome"));
    setError(null);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "42px";
    inputRef.current?.focus();
  }

  const isEmpty = messages.length <= 1; // only welcome msg

  return (
    <div className="flex flex-col h-[calc(100vh-7.5rem)]">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-app bg-surface relative overflow-hidden">
        <div className="float-blobs" aria-hidden>
          <span className="float-blob h-24 w-24 -top-8 left-1/4" style={{ background: "#f87171" }} />
          <span className="float-blob h-20 w-20 top-0 right-1/3" style={{ background: "#ef4444", animationDelay: "-4s" }} />
        </div>
        <div className="flex items-center gap-3 relative">
          <span className="bounce-soft inline-flex"><AiOrb size={36} /></span>
          <div>
            <h1 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Support Assistant
              <span className="pop-in inline-flex items-center gap-1 text-[10px] font-medium bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 px-1.5 py-0.5 rounded-full pulse-glow">
                <Sparkles size={9} className="spin-slow" /> AI-powered
              </span>
            </h1>
            <p className="text-[11px] text-muted">Automated topic navigation & technical guidance</p>
          </div>
        </div>
        {!isEmpty && (
          <button
            onClick={clearChat}
            title="Clear chat"
            className="relative flex items-center gap-1.5 text-xs text-muted hover:text-red-500 transition-all px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 hover:scale-105 active:scale-95 animate-wiggle-hover"
          >
            <Trash2 size={13} />
            Clear
          </button>
        )}
      </div>

      {/* ── Topic Selector Bar (Looping Quick Bar) ──────────── */}
      <div className="px-4 py-2 border-b border-app bg-surface-2/60 overflow-x-auto flex items-center gap-2 text-xs">
        <span className="text-[11px] font-semibold text-muted shrink-0 uppercase tracking-wider heartbeat">Topics:</span>
        {STARTER_TOPICS.map((topic, i) => (
          <button
            key={topic.label}
            onClick={() => send(topic.prompt)}
            disabled={loading}
            className="ai-msg-in shrink-0 px-2.5 py-1 rounded-lg border border-app bg-surface hover:bg-red-50 dark:hover:bg-red-950/50 hover:border-red-300 dark:hover:border-red-700 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95 text-foreground transition-all duration-150 text-[12px] font-medium flex items-center gap-1 disabled:opacity-50"
            style={{ animationDelay: `${i * 0.05}s` }}
          >
            {topic.label}
          </button>
        ))}
      </div>

      {/* ── Messages area ────────────────────────────────────── */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto px-4 py-6 space-y-6 relative">
        {messages.map((m) => (
          <div key={m.id} id={"msg-" + m.id} className={m.role === "user" ? "scroll-mt-4 ai-msg-in-right" : "scroll-mt-4 ai-msg-in"}>
            <Bubble msg={m} onSelectQuestion={(q) => send(q)} />
          </div>
        ))}

        {loading && <div className="pop-in rounded-2xl border border-red-500/20 bg-surface px-4 py-3 shadow-sm neon-ring max-w-md"><TypingDots /></div>}

        {/* Error banner */}
        {error && (
          <div className="pop-in flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 jiggle">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 heartbeat" />
            <span>{error}</span>
          </div>
        )}

        {/* Starter suggestions — shown only when chat is fresh */}
        {isEmpty && !loading && (
          <div className="mt-4 space-y-3 fade-in">
            <p className="text-xs font-semibold text-muted uppercase tracking-wider">Quick Automated Topic Loops</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 stagger-children">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="card-shine text-left text-sm px-3.5 py-3 rounded-xl border border-app bg-surface hover:bg-surface-2 hover:border-red-400 hover:-translate-y-0.5 hover:shadow-card active:translate-y-0 active:scale-[0.99] text-foreground transition-all duration-150 group shadow-xs"
                >
                  <span className="text-red-500 group-hover:text-red-600 mr-1.5 font-bold group-hover:translate-x-1 inline-block transition-transform">→</span>
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Input bar ────────────────────────────────────────── */}
      <div className="border-t border-app bg-surface px-4 py-3">
        <div className="flex items-end gap-3 max-w-4xl mx-auto">
          {/* Restart chat button — resets conversation to the welcome state */}
          {!isEmpty && (
            <button
              onClick={clearChat}
              disabled={loading}
              title="Restart chat"
              aria-label="Restart chat"
              className="pop-in h-10 px-3 rounded-xl border border-app bg-surface-2 flex items-center justify-center gap-1.5 text-xs font-medium text-muted hover:text-red-600 dark:hover:text-red-300 hover:border-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:-translate-y-0.5 hover:shadow-sm active:translate-y-0 active:scale-95 transition-all duration-150 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
            >
              <RefreshCw size={14} />
              Restart
            </button>
          )}
          <textarea
            ref={inputRef}
            id="support-chat-input"
            rows={1}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              // Auto-grow (max 5 rows)
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Describe your problem or click any suggested topic above…"
            className="ai-input-glow flex-1 resize-none rounded-xl border border-app bg-surface-2 px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:outline-none disabled:opacity-50 leading-relaxed"
            style={{ minHeight: "42px", height: "42px" }}
          />
          <button
            id="support-chat-send"
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="pop-in h-10 w-10 rounded-xl btn-gradient btn-shimmer text-white flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0 hover:scale-110 hover:rotate-6 active:scale-90 animate-wiggle-hover"
            aria-label="Send message"
          >
            {loading ? <span className="ai-wave" aria-hidden><span /><span /><span /><span /><span /></span> : <Send size={16} />}
          </button>
        </div>
        <p className="text-[10px] text-muted text-center mt-2">
          Clicking any suggested follow-up pill automatically requests the next topic details.
        </p>
      </div>
    </div>
  );
}
