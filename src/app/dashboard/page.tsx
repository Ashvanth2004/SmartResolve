"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { ArrowUp, AlertTriangle, Sparkles, Zap } from "lucide-react";
import { AiOrb, AiThinking, Typewriter, SparkleField, Tilt, Ripple, Confetti } from "@/lib/ui/ai-effects";

type Role = "user" | "assistant";
interface Message {
  id: string;
  role: Role;
  content: string;
}

/* Suggestion chips — clicking one auto-sends it and the assistant answers */
const SUGGESTIONS = [
  { label: "🌐 Internet & Wi-Fi", prompt: "My internet keeps disconnecting. How do I fix it?" },
  { label: "🔑 Account & Password", prompt: "I forgot my password and can't log in." },
  { label: "⚡ App Crash & Speed", prompt: "My phone app keeps crashing on startup." },
  { label: "💳 Billing & Charges", prompt: "I was charged twice for my subscription." },
];

const FOLLOWUP_SUGGESTIONS = [
  "What exact error message do you see?",
  "Which device are you using?",
  "When did this issue start?",
  "Did this happen after an update?",
  "Have you already tried restarting the device?",
];

/* ── Minimal markdown renderer ── */
function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^### (.+)$/gm, "<h3 class='font-semibold text-foreground mt-3 mb-1'>$1</h3>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4 list-decimal'><strong>$1.</strong> $2</li>")
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class='space-y-1 my-2'>${m}</ul>`)
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class='bg-surface-2 px-1 rounded text-xs font-mono'>$1</code>")
    .replace(/\n/g, "<br>");
}

/* ── Extract follow-up suggestion questions from the answer ── */
function extractFollowUps(content: string): string[] {
  const match = content.match(/You may also ask:[\s\S]*/i);
  if (!match) return [];
  const questions: string[] = [];
  for (const line of match[0].split("\n")) {
    const q = line.match(/^[-*]\s*"?([^"\n]+)"?/);
    if (q && q[1].length > 3) questions.push(q[1].replace(/^["']|["']$/g, "").trim());
  }
  return questions.slice(0, 5);
}

function id() {
  return Math.random().toString(36).slice(2);
}

export default function ChatPage() {
  const { status } = useSession();
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [sendPulse, setSendPulse] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const lastAssistantIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") router.replace("/login");
  }, [status, router]);

  /* ── Scroll behaviour ──
     When YOU send a message → scroll to bottom (your message is visible).
     When the ASSISTANT answers (esp. after picking a suggestion) → scroll
     so the TOP of the answer is visible instead of jumping to its end. */
  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last) return;

    // Assistant reply (new one) → align its top with the container top
    if (last.role === "assistant" && last.id !== lastAssistantIdRef.current) {
      lastAssistantIdRef.current = last.id;
      // Wait a tick so the DOM has painted the long answer
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          const el = document.getElementById(`msg-${last.id}`);
          el?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      return;
    }

    // Your own message → keep it in view at the bottom
    if (last.role === "user") {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  /* ── Send: the selected suggestion / typed text is auto-understood & answered ── */
  async function send(text?: string) {
    const content = (text ?? input).trim();
    if (!content || loading) return;
    setError(null);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "42px";
    setMessages((m) => [...m, { id: id(), role: "user", content }]);
    setLoading(true);
    setSendPulse((p) => p + 1);
    setCelebrate(false);
    try {
      const history = [...messages, { id: id(), role: "user" as Role, content }].slice(-12).map((m) => ({
        role: m.role,
        content: m.content,
      }));
      const res = await fetch("/api/support-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Something went wrong.");
      setMessages((m) => [...m, { id: id(), role: "assistant", content: data.content || "…" }]);
      // Celebrate every assistant answer with a confetti burst at the input
      setCelebrate(true);
      setTimeout(() => setCelebrate(false), 200);
    } catch (e: any) {
      setError(e.message || "Unable to get an answer. Please try again.");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  const isEmpty = messages.length === 0 && !loading;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] relative">
      {isEmpty ? (
        /* ── AI-model welcome screen ── */
        <div className="flex-1 flex flex-col items-center justify-center px-4 relative overflow-hidden">
          <SparkleField count={18} />
          <div className="ai-hero-in flex flex-col items-center max-w-2xl w-full">
            <div className="animate-float-slow"><AiOrb size={76} /></div>
            <div className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-[11px] font-semibold text-red-600 dark:text-red-300 pulse-glow">
              <span className="ai-wave" aria-hidden><span /><span /><span /><span /><span /></span>
              ResolveAI engine online
            </div>
            <h1 className="text-2xl md:text-4xl font-bold tracking-tight text-center mt-3 min-h-[1.4em]">
              <span className="gradient-shift"><Typewriter phrases={["What can I help with?", "Describe any complaint...", "Ask. Classify. Resolve."]} /></span>
            </h1>
            <p className="text-sm text-muted mt-2 text-center">
              Pick a suggestion below or type your question — I&apos;ll understand it automatically.
            </p>

            <div className="flex flex-wrap justify-center gap-2 mt-4 text-[11px] stagger-children">
              {["Instant classify", "SLA guarded", "Web research", "Smart routing"].map((b) => (
                <span key={b} className="inline-flex items-center gap-1.5 rounded-full border border-app bg-surface px-2.5 py-1 text-muted shadow-sm card-shine">
                  <Sparkles size={11} className="text-red-500 animate-wiggle-hover" /> {b}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6 w-full max-w-lg stagger-in">
              {SUGGESTIONS.map((s) => (
                <Tilt key={s.label} max={5}>
                  <Ripple>
                  <button
                    onClick={() => send(s.prompt)}
                    className="card-shine w-full text-left text-sm px-4 py-3.5 rounded-2xl border border-app bg-surface hover:bg-surface-2 hover:border-red-400 dark:hover:border-red-500 hover:shadow-card hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] transition-all duration-150 group"
                  >
                    <span className="font-medium group-hover:text-red-600 dark:group-hover:text-red-300 transition-colors"><Zap size={12} className="inline mr-1 text-red-400" />{s.label}</span>
                    <span className="block text-xs text-muted mt-0.5 line-clamp-2">{s.prompt}</span>
                  </button>
                  </Ripple>
                </Tilt>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* ── Conversation ── */
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-6">
            {messages.map((m) => (
              <div key={m.id} id={"msg-" + m.id} className={m.role === "user" ? "scroll-mt-4 ai-msg-in-right" : "scroll-mt-4 ai-msg-in"}>
                <ChatMessage msg={m} onPick={(q) => send(q)} />
              </div>
            ))}
            {loading && (
              <div className="rounded-2xl border border-red-500/20 bg-surface px-4 py-3 shadow-sm pop-in neon-ring">
                <AiThinking />
              </div>
            )}
            {error && (
              <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3 text-sm text-red-700 dark:text-red-300 fade-in max-w-3xl mx-auto">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>
      )}

      {/* ── Input bar ── */}
      <div className="px-4 pb-4 pt-2">
        <div className="max-w-3xl mx-auto relative">
          <Confetti fire={celebrate} />
          <div className="flex items-end gap-2 ai-input-glow rounded-3xl border border-app bg-surface shadow-card px-3 py-2 transition-all">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Ask anything…"
              className="flex-1 resize-none bg-transparent px-2 py-1.5 text-sm text-foreground placeholder:text-muted focus:outline-none leading-relaxed"
              style={{ minHeight: "32px", maxHeight: "120px" }}
            />
            <button
              key={sendPulse}
              onClick={() => send()}
              disabled={!input.trim() || loading}
              className="pop-in h-9 w-9 rounded-full btn-gradient btn-shimmer flex items-center justify-center disabled:opacity-40 transition-all shrink-0 hover:scale-110 hover:rotate-6 active:scale-90 animate-wiggle-hover"
              aria-label="Send"
            >
              {loading ? <span className="ai-wave" aria-hidden><span /><span /><span /><span /><span /></span> : <ArrowUp size={16} />}
            </button>
          </div>
          <p className="text-[10px] text-muted text-center mt-2">
            Selecting a suggestion sends it automatically — the assistant understands and answers.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── One AI-model message row ── */
function ChatMessage({ msg, onPick }: { msg: Message; onPick: (q: string) => void }) {
  const isUser = msg.role === "user";
  const followUps = !isUser ? extractFollowUps(msg.content) : [];

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="rounded-3xl rounded-br-lg bg-surface-2 border border-app px-4 py-2.5 text-sm max-w-[80%] card-shine hover:scale-[1.02] transition-transform">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3">
      <AiOrb size={28} className="mt-0.5 bounce-soft" />
      <div className="min-w-0 flex-1">
        <div
          className="text-sm leading-relaxed [&_ul]:my-2"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
        />
        {/* Auto follow-up suggestions — clicking one sends it automatically */}
        {followUps.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3 stagger-children">
            {(followUps.length ? followUps : FOLLOWUP_SUGGESTIONS).map((q) => (
              <button
                key={q}
                onClick={() => onPick(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-red-500/25 bg-red-500/5 text-muted hover:text-red-700 dark:hover:text-red-200 hover:bg-red-500/15 hover:border-red-400 hover:-translate-y-px hover:shadow-sm active:translate-y-0 active:scale-[0.98] transition-all duration-150 jiggle"
              >
                {q}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}